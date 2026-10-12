import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { organizations, payments } from "@/lib/db/schema";
import { toOrg, type OrgRecord } from "@/lib/orgs";
import type { Interval, PlanId } from "@/lib/plans";
import { FlutterwaveProvider } from "@/lib/billing/flutterwave";
import { MockProvider } from "@/lib/billing/mock";

export interface VerifiedPayment {
  reference: string;
  amount: number;
  currency: string;
  paidAt: Date;
  plan: PlanId;
  interval: Interval;
  orgId: string;
  customerCode: string | null;
  subscriptionCode?: string | null;
}

export interface SubscriptionRef {
  code: string | null;
  customer: string | null;
  plan?: PlanId;
  interval?: Interval;
}

export interface BillingProvider {
  id: "flutterwave" | "mock";
  checkout(input: { org: OrgRecord; email: string; plan: Exclude<PlanId, "free">; interval: Interval; callbackUrl: string }): Promise<{ url: string; reference: string }>;
  verify(reference: string, fallback?: { orgId: string; plan: PlanId; interval: Interval }): Promise<VerifiedPayment | null>;
  cancelSubscription(ref: SubscriptionRef): Promise<void>;

  chargeTicket(input: TicketCharge): Promise<{ url: string }>;
  verifyTicket(reference: string, expected: { amountMinor: number }): Promise<{ ok: boolean; amountMinor: number; currency: string } | null>;
  refund(reference: string): Promise<void>;
  createSubaccount(input: { businessName: string; bankCode: string; accountNumber: string; businessMobile: string }): Promise<{ code: string; accountName: string; bankName: string }>;
  listBanks(): Promise<{ name: string; code: string }[]>;
}

export interface TicketCharge {
  email: string;
  amountMinor: number;
  feeMinor: number;
  reference: string;
  callbackUrl: string;
  subaccount: string | null;
  metadata: Record<string, unknown>;
}

export function getBillingProvider(): BillingProvider | null {
  if (process.env.FLUTTERWAVE_SECRET_KEY) return new FlutterwaveProvider(process.env.FLUTTERWAVE_SECRET_KEY);
  if (process.env.NODE_ENV !== "production") return new MockProvider();
  return null;
}

const PERIOD_DAYS: Record<Interval, number> = { monthly: 30, yearly: 365 };

export async function applyPayment(
  p: VerifiedPayment,
  provider: BillingProvider["id"],
): Promise<{ applied: boolean; previous?: SubscriptionRef }> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(payments)
      .values({
        orgId: p.orgId,
        provider,
        reference: p.reference,
        amount: p.amount,
        currency: p.currency,
        plan: p.plan,
        interval: p.interval,
        status: "success",
        paidAt: p.paidAt,
      })
      .onConflictDoNothing()
      .returning({ id: payments.id });
    if (!inserted) return { applied: false };

    const [row] = await tx.select().from(organizations).where(eq(organizations.id, p.orgId)).for("update");
    if (!row) return { applied: false };
    const org = toOrg(row);

    const start = org.currentPeriodEnd && org.currentPeriodEnd.getTime() > Date.now() && org.plan === p.plan ? org.currentPeriodEnd : new Date();
    const end = new Date(start.getTime() + PERIOD_DAYS[p.interval] * 86_400_000);
    const switched = org.plan !== "free" && org.plan !== p.plan && (org.subscriptionCode || org.billingCustomerCode);

    await tx
      .update(organizations)
      .set({
        plan: p.plan,
        planInterval: p.interval,
        planStatus: "active",
        currentPeriodEnd: end,
        cancelAtPeriodEnd: false,
        billingProvider: provider,
        billingCustomerCode: p.customerCode ?? org.billingCustomerCode,
        ...(switched ? { subscriptionCode: null, subscriptionToken: null } : {}),
      })
      .where(eq(organizations.id, p.orgId));

    return {
      applied: true,
      previous: switched ? { code: org.subscriptionCode, customer: org.billingCustomerCode, plan: org.plan, interval: org.planInterval } : undefined,
    };
  });
}

export async function findOrgByBilling(opts: { customerCode?: string | null; subscriptionCode?: string | null }) {
  const db = await getDb();
  if (opts.subscriptionCode) {
    const [r] = await db.select().from(organizations).where(eq(organizations.subscriptionCode, opts.subscriptionCode)).limit(1);
    if (r) return toOrg(r);
  }
  if (opts.customerCode) {
    const [r] = await db.select().from(organizations).where(eq(organizations.billingCustomerCode, opts.customerCode)).limit(1);
    if (r) return toOrg(r);
  }
  return null;
}

export async function markOrgBilling(orgId: string, patch: Partial<Pick<typeof organizations.$inferInsert, "planStatus" | "cancelAtPeriodEnd">>) {
  const db = await getDb();
  await db.update(organizations).set(patch).where(eq(organizations.id, orgId));
}

export async function listPayments(orgId: string) {
  const db = await getDb();
  return db
    .select()
    .from(payments)
    .where(and(eq(payments.orgId, orgId), eq(payments.status, "success")))
    .orderBy(payments.paidAt)
    .then((rows) => rows.reverse());
}
