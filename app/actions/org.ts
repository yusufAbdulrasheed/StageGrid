"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser, requireOrg, requireUser } from "@/lib/auth";
import {
  acceptInvitation, createInvitation, createOrg, getInvitation, limitsFor, listMembers, memberSeatsUsed, removeMember,
  revokeInvitation, setMemberRole, updateOrg,
} from "@/lib/orgs";
import { createApiKey, revokeApiKey } from "@/lib/api-keys";
import { apiKeySchema, flattenErrors, inviteSchema, orgSchema, orgSettingsSchema, payoutSchema } from "@/lib/validation";
import { getBillingProvider } from "@/lib/billing";
import { getDb } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { formValues, type FormState } from "@/lib/action-types";
import { notify } from "@/lib/notify";
import { getUserByEmail } from "@/lib/users";
import { rateLimit } from "@/lib/rate-limit";
import { atLeast, type Role } from "@/lib/plans";

export async function createOrgAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser("/onboarding");
  const values = formValues(fd);
  const parsed = orgSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: flattenErrors(parsed.error), values };

  const limit = rateLimit(`org:${user.id}`, 5, 60 * 60_000);
  if (!limit.ok) return { error: "You're creating workspaces too quickly.", values };

  const org = await createOrg(user.id, parsed.data.name);
  const plan = fd.get("plan");
  redirect(plan === "pro" || plan === "business" ? `/app/${org.slug}/billing?plan=${plan}` : `/app/${org.slug}?welcome=1`);
}

export async function updateOrgAction(slug: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { org } = await requireOrg(slug, "settings");
  const values = formValues(fd);
  const parsed = orgSettingsSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: flattenErrors(parsed.error), values };
  await updateOrg(org.id, parsed.data);
  revalidatePath(`/app/${slug}`, "layout");
  revalidatePath(`/o/${slug}`);
  return { ok: true, message: "Settings saved.", values };
}

export async function inviteMemberAction(slug: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { user, org } = await requireOrg(slug, "team");
  const values = formValues(fd);
  const parsed = inviteSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: flattenErrors(parsed.error), values };

  const seats = await memberSeatsUsed(org.id);
  if (seats >= limitsFor(org).members) {
    return { error: "Your plan's team limit is reached. Upgrade to invite more people.", upgrade: true, values };
  }
  const existing = await getUserByEmail(parsed.data.email);
  if (existing?.email === user.email) return { fieldErrors: { email: ["That's you"] }, values };

  const token = await createInvitation(org.id, parsed.data.email, parsed.data.role as Role, user.id);
  notify.invite(parsed.data.email, org.name, user.name, `/invite/${token}`);
  revalidatePath(`/app/${slug}/team`);
  return {
    ok: true,
    message: process.env.RESEND_API_KEY
      ? `Invitation sent to ${parsed.data.email}.`
      : `Invitation created for ${parsed.data.email}. Email isn't configured here, so share this link: /invite/${token}`,
  };
}

export async function revokeInviteAction(slug: string, id: string) {
  const { org } = await requireOrg(slug, "team");
  await revokeInvitation(org.id, id);
  revalidatePath(`/app/${slug}/team`);
}

export async function removeMemberAction(slug: string, userId: string) {
  const { user, org, role } = await requireOrg(slug, "team");
  const target = (await listMembers(org.id)).find((m) => m.userId === userId);
  if (!target || target.role === "owner") return; // owners can't be removed
  if (target.userId !== user.id && !atLeast(role, target.role === "admin" ? "owner" : "admin")) return;
  await removeMember(org.id, userId);
  revalidatePath(`/app/${slug}/team`);
}

export async function changeRoleAction(slug: string, userId: string, fd: FormData) {
  const { org } = await requireOrg(slug, "billing"); // owner-only
  const role = fd.get("role");
  if (role !== "admin" && role !== "member") return;
  const target = (await listMembers(org.id)).find((m) => m.userId === userId);
  if (!target || target.role === "owner") return;
  await setMemberRole(org.id, userId, role);
  revalidatePath(`/app/${slug}/team`);
}

export async function acceptInviteAction(token: string) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  const inv = await getInvitation(token);
  if (!inv) redirect("/invite/invalid");
  if (inv.email.toLowerCase() !== user.email.toLowerCase()) redirect(`/invite/${token}?mismatch=1`);
  const res = await acceptInvitation(token, user.id);
  redirect(res ? `/app/${res.orgSlug}` : "/invite/invalid");
}

export async function createApiKeyAction(slug: string, _prev: FormState & { key?: string }, fd: FormData): Promise<FormState & { key?: string }> {
  const { user, org } = await requireOrg(slug, "api-keys");
  const parsed = apiKeySchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: flattenErrors(parsed.error) };
  if (!limitsFor(org).apiAccess) return { error: "API access is part of the Business plan.", upgrade: true };
  const key = await createApiKey(org.id, parsed.data.name, user.id);
  revalidatePath(`/app/${slug}/settings`);
  return { ok: true, key };
}

export async function revokeApiKeyAction(slug: string, id: string) {
  const { org } = await requireOrg(slug, "api-keys");
  await revokeApiKey(org.id, id);
  revalidatePath(`/app/${slug}/settings`);
}

export async function savePayoutsAction(slug: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { org } = await requireOrg(slug, "billing"); // owner only: this is where the money goes
  const parsed = payoutSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: flattenErrors(parsed.error) };

  const provider = getBillingProvider();
  if (!provider) return { error: "Payments aren't configured on this deployment." };

  try {
    const sub = await provider.createSubaccount({ businessName: org.name, bankCode: parsed.data.bankCode, accountNumber: parsed.data.accountNumber });
    const db = await getDb();
    await db
      .update(organizations)
      .set({
        subaccountCode: sub.code,
        payoutBankName: sub.bankName,
        payoutAccountName: sub.accountName,
        payoutAccountLast4: parsed.data.accountNumber.slice(-4),
      })
      .where(eq(organizations.id, org.id));
  } catch (err) {
    console.error("[payouts] subaccount failed", err);
    return { error: "We couldn't verify that bank account. Check the details and try again." };
  }
  revalidatePath(`/app/${slug}`, "layout");
  return { ok: true, message: "Payout account saved. You can now sell paid tickets." };
}
