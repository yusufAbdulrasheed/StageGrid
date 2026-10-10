"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/auth";
import { applyPayment, getBillingProvider, markOrgBilling } from "@/lib/billing";
import { isPlanId, type Interval } from "@/lib/plans";
import { siteUrl } from "@/lib/utils";
import { listOrgNotifyEmails } from "@/lib/orgs";
import { notify } from "@/lib/notify";
import { PLANS, formatNaira } from "@/lib/plans";

export async function startCheckoutAction(orgSlug: string, fd: FormData) {
  const { user, org } = await requireOrg(orgSlug, "billing");
  const plan = fd.get("plan");
  const interval: Interval = fd.get("interval") === "yearly" ? "yearly" : "monthly";
  if (!isPlanId(plan) || plan === "free") return;

  const provider = getBillingProvider();
  if (!provider) redirect(`/app/${orgSlug}/billing?error=not_configured`);

  let url: string;
  try {
    ({ url } = await provider.checkout({
      org,
      email: user.email,
      plan,
      interval,
      callbackUrl: siteUrl(`/api/billing/callback?org=${org.slug}`),
    }));
  } catch (err) {
    console.error("[billing] checkout failed", err);
    redirect(`/app/${orgSlug}/billing?error=checkout`);
  }
  redirect(url);
}

export async function cancelSubscriptionAction(orgSlug: string) {
  const { org } = await requireOrg(orgSlug, "billing");
  const provider = getBillingProvider();
  if (org.subscriptionCode && org.subscriptionToken && provider) {
    try {
      await provider.cancelSubscription(org.subscriptionCode, org.subscriptionToken);
    } catch (err) {
      console.error("[billing] cancel failed", err);
      redirect(`/app/${orgSlug}/billing?error=cancel`);
    }
  }
  // Access continues until the paid period ends (see effectivePlan).
  await markOrgBilling(org.id, { cancelAtPeriodEnd: true, planStatus: "canceled" });
  revalidatePath(`/app/${orgSlug}`, "layout");
  redirect(`/app/${orgSlug}/billing?canceled=1`);
}

/** Dev-only: completes a mock checkout. */
export async function confirmMockPaymentAction(orgSlug: string, reference: string) {
  const { org } = await requireOrg(orgSlug, "billing");
  const provider = getBillingProvider();
  if (!provider || provider.id !== "mock") redirect(`/app/${orgSlug}/billing`);
  const verified = await provider.verify(reference);
  if (verified && verified.orgId === org.id) {
    const res = await applyPayment(verified, "mock");
    if (res.applied) {
      notify.subscriptionReceipt(await listOrgNotifyEmails(org.id), {
        org: org.name,
        plan: PLANS[verified.plan].name,
        amount: formatNaira(verified.amount / 100),
        renews: new Date(Date.now() + (verified.interval === "yearly" ? 365 : 30) * 86_400_000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
        billingPath: `/app/${org.slug}/billing`,
      });
    }
  }
  revalidatePath(`/app/${orgSlug}`, "layout");
  redirect(`/app/${orgSlug}/billing?upgraded=1`);
}
