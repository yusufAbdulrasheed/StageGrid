import "server-only";
import { and, asc, count, desc, eq, gt, gte, isNull, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { events, invitations, memberships, organizations, users } from "@/lib/db/schema";
import { PLANS, isPlanId, type Interval, type PlanId, type Role } from "@/lib/plans";
import { sha256, randomToken } from "@/lib/tokens";
import { slugify } from "@/lib/utils";

export interface OrgRecord {
  id: string;
  name: string;
  slug: string;
  description: string;
  website: string;
  logoUrl: string;
  plan: PlanId;
  planInterval: Interval;
  planStatus: string;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  billingProvider: string | null;
  billingCustomerCode: string | null;
  subscriptionCode: string | null;
  subscriptionToken: string | null;
  payoutBankName: string | null;
  payoutAccountLast4: string | null;
  payoutAccountName: string | null;
  subaccountCode: string | null;
  createdAt: Date;
}

type OrgRow = typeof organizations.$inferSelect;

export function toOrg(r: OrgRow): OrgRecord {
  return {
    ...r,
    plan: isPlanId(r.plan) ? r.plan : "free",
    planInterval: r.planInterval === "yearly" ? "yearly" : "monthly",
  };
}

const GRACE_MS = 3 * 86_400_000;

/** The plan whose limits actually apply right now (lapsed subscriptions fall back to Starter). */
export function effectivePlan(org: Pick<OrgRecord, "plan" | "currentPeriodEnd" | "planStatus">): PlanId {
  if (org.plan === "free") return "free";
  if (org.planStatus === "canceled" && org.currentPeriodEnd && org.currentPeriodEnd.getTime() < Date.now()) return "free";
  if (org.currentPeriodEnd && org.currentPeriodEnd.getTime() + GRACE_MS < Date.now()) return "free";
  return org.plan;
}

export function limitsFor(org: OrgRecord) {
  return PLANS[effectivePlan(org)].limits;
}

const RESERVED = new Set(["new", "app", "api", "admin", "o", "settings", "billing"]);

async function uniqueOrgSlug(name: string): Promise<string> {
  const db = await getDb();
  let root = slugify(name) || "org";
  if (RESERVED.has(root)) root = `${root}-org`;
  let candidate = root;
  for (let i = 2; ; i++) {
    const [hit] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, candidate)).limit(1);
    if (!hit) return candidate;
    candidate = `${root}-${i}`;
  }
}

export async function createOrg(userId: string, name: string): Promise<OrgRecord> {
  const db = await getDb();
  const slug = await uniqueOrgSlug(name);
  return db.transaction(async (tx) => {
    const [org] = await tx.insert(organizations).values({ name, slug }).returning();
    await tx.insert(memberships).values({ orgId: org.id, userId, role: "owner" });
    return toOrg(org);
  });
}

export async function listUserOrgs(userId: string): Promise<{ org: OrgRecord; role: Role }[]> {
  const db = await getDb();
  const rows = await db
    .select({ org: organizations, role: memberships.role })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.orgId))
    .where(eq(memberships.userId, userId))
    .orderBy(asc(organizations.createdAt));
  return rows.map((r) => ({ org: toOrg(r.org), role: r.role as Role }));
}

export async function getOrgContext(userId: string, slug: string): Promise<{ org: OrgRecord; role: Role } | null> {
  const db = await getDb();
  const [row] = await db
    .select({ org: organizations, role: memberships.role })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.orgId))
    .where(and(eq(memberships.userId, userId), eq(organizations.slug, slug)))
    .limit(1);
  return row ? { org: toOrg(row.org), role: row.role as Role } : null;
}

export async function getOrgBySlug(slug: string): Promise<OrgRecord | null> {
  const db = await getDb();
  const [row] = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
  return row ? toOrg(row) : null;
}

export async function getOrgById(id: string): Promise<OrgRecord | null> {
  const db = await getDb();
  const [row] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
  return row ? toOrg(row) : null;
}

export async function updateOrg(
  orgId: string,
  data: Partial<Pick<OrgRow, "name" | "description" | "website" | "logoUrl">>,
) {
  const db = await getDb();
  await db.update(organizations).set(data).where(eq(organizations.id, orgId));
}

/* --------------------------------- members --------------------------------- */

export interface Member {
  userId: string;
  name: string;
  email: string;
  role: Role;
  joinedAt: Date;
}

export async function listMembers(orgId: string): Promise<Member[]> {
  const db = await getDb();
  const rows = await db
    .select({ userId: users.id, name: users.name, email: users.email, role: memberships.role, joinedAt: memberships.createdAt })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(eq(memberships.orgId, orgId))
    .orderBy(asc(memberships.createdAt));
  return rows.map((r) => ({ ...r, role: r.role as Role }));
}

export async function listInvitations(orgId: string) {
  const db = await getDb();
  return db
    .select({ id: invitations.id, email: invitations.email, role: invitations.role, expiresAt: invitations.expiresAt })
    .from(invitations)
    .where(and(eq(invitations.orgId, orgId), gt(invitations.expiresAt, new Date())))
    .orderBy(desc(invitations.createdAt));
}

export async function removeMember(orgId: string, userId: string) {
  const db = await getDb();
  await db.delete(memberships).where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)));
}

export async function setMemberRole(orgId: string, userId: string, role: Role) {
  const db = await getDb();
  await db.update(memberships).set({ role }).where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)));
}

export async function memberSeatsUsed(orgId: string): Promise<number> {
  const db = await getDb();
  const [{ n: m }] = await db.select({ n: count() }).from(memberships).where(eq(memberships.orgId, orgId));
  const [{ n: i }] = await db
    .select({ n: count() })
    .from(invitations)
    .where(and(eq(invitations.orgId, orgId), gt(invitations.expiresAt, new Date())));
  return Number(m) + Number(i);
}

export async function createInvitation(orgId: string, email: string, role: Role, invitedBy: string) {
  const db = await getDb();
  const token = randomToken();
  await db.delete(invitations).where(and(eq(invitations.orgId, orgId), sql`lower(${invitations.email}) = ${email.toLowerCase()}`));
  await db.insert(invitations).values({
    orgId,
    email: email.toLowerCase(),
    role,
    tokenHash: sha256(token),
    invitedBy,
    expiresAt: new Date(Date.now() + 7 * 86_400_000),
  });
  return token;
}

export async function revokeInvitation(orgId: string, id: string) {
  const db = await getDb();
  await db.delete(invitations).where(and(eq(invitations.orgId, orgId), eq(invitations.id, id)));
}

export async function getInvitation(token: string) {
  const db = await getDb();
  const [row] = await db
    .select({ id: invitations.id, email: invitations.email, role: invitations.role, orgId: invitations.orgId, orgName: organizations.name, orgSlug: organizations.slug })
    .from(invitations)
    .innerJoin(organizations, eq(organizations.id, invitations.orgId))
    .where(and(eq(invitations.tokenHash, sha256(token)), gt(invitations.expiresAt, new Date())))
    .limit(1);
  return row ? { ...row, role: row.role as Role } : null;
}

export async function acceptInvitation(token: string, userId: string): Promise<{ orgSlug: string } | null> {
  const inv = await getInvitation(token);
  if (!inv) return null;
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.insert(memberships).values({ orgId: inv.orgId, userId, role: inv.role }).onConflictDoNothing();
    await tx.delete(invitations).where(eq(invitations.id, inv.id));
  });
  return { orgSlug: inv.orgSlug };
}

/* ---------------------------------- usage ---------------------------------- */

export async function activeEventCount(orgId: string): Promise<number> {
  const db = await getDb();
  const [{ n }] = await db
    .select({ n: count() })
    .from(events)
    .where(
      and(
        eq(events.orgId, orgId),
        eq(events.status, "published"),
        or(gte(events.endsAt, new Date()), and(isNull(events.endsAt), gte(events.startsAt, new Date()))),
      ),
    );
  return Number(n);
}

/** Owners and admins: who gets sale notifications and billing emails. */
export async function listOrgNotifyEmails(orgId: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .select({ email: users.email })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.orgId, orgId), or(eq(memberships.role, "owner"), eq(memberships.role, "admin"))));
  return rows.map((r) => r.email);
}
