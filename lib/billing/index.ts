import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { organizations, payments } from "@/lib/db/schema";
import { toOrg, type OrgRecord } from "@/lib/orgs";
import type { Interval, PlanId } from "@/lib/plans";
import { PaystackProvider } from "@/lib/billing/paystack";
import { MockProvider } from "@/lib/billing/mock";

export interface VerifiedPayment {
  reference: string;
  /** Minor units (kobo). */
  amount: number;
  currency: string;
  paidAt: Date;
  plan: PlanId;
  interval: Interval;
  orgId: string;
  customerCode: string | null;
  subscriptionCode?: string | null;
}

export interface BillingProvider {
  id: "paystack" | "mock";
  checkout(input: { org: OrgRecord; email: string; plan: Exclude<PlanId, "free">; interval: Interval; callbackUrl: string }): Promise<{ url: string; reference: string }>;
  verify(reference: string): Promise<VerifiedPayment | null>;
  cancelSubscription(code: string, token: string): Promise<void>;
  manageUrl(subscriptionCode: string): Promise<string | null>;

  /* ---- attendee ticket payments (marketplace: money settles to the organizer's subaccount) ---- */
  chargeTicket(input: TicketCharge): Promise<{ url: string }>;
  verifyTicket(reference: string, expected: { amountMinor: number }): Promise<{ ok: boolean; amountMinor: number; currency: string } | null>;
  refund(reference: string): Promise<void>;
  createSubaccount(input: { businessName: string; bankCode: string; accountNumber: string }): Promise<{ code: string; accountName: string; bankName: string }>;
  listBanks(): Promise<{ name: string; code: string }[]>;
}

export interface TicketCharge {
  email: string;
  amountMinor: number;
  /** Platform's cut in minor units; the remainder settles to the organizer. */
  feeMinor: number;
  reference: string;
  callbackUrl: string;
  subaccount: string | null;
  metadata: Record<string, unknown>;
}

/**
 * To add Flutterwave: implement `BillingProvider` in lib/billing/flutterwave.ts
 * (payment plans + /v3/payments + verify_by_reference), add a webhook route that
 * calls `applyPayment`, and return it here when FLW_SECRET_KEY is set.
 */
export function getBillingProvider(): BillingProvider | null {
  if (process.env.PAYSTACK_SECRET_KEY) return new PaystackProvider(process.env.PAYSTACK_SECRET_KEY);
  if (process.env.NODE_ENV !== "production") return new MockProvider();
  return null;
}

const PERIOD_DAYS: Record<Interval, number> = { monthly: 30, yearly: 365 };

/**
 * Record a successful payment and extend the subscription. Idempotent on `reference`:
 * returns the previous subscription (for cancellation) when this payment switched plans.
 */
export async function applyPayment(
  p: VerifiedPayment,
  provider: BillingProvider["id"],
): Promise<{ applied: boolean; previous?: { code: string; token: string } }> {
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
    const switched = org.plan !== "free" && org.plan !== p.plan && org.subscriptionCode && org.subscriptionToken;

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
      previous: switched ? { code: org.subscriptionCode!, token: org.subscriptionToken! } : undefined,
    };
  });
}

export async function setSubscription(orgId: string, sub: { code: string; token: string; customerCode?: string | null }) {
  const db = await getDb();
  await db
    .update(organizations)
    .set({
      subscriptionCode: sub.code,
      subscriptionToken: sub.token,
      billingProvider: "paystack",
      ...(sub.customerCode ? { billingCustomerCode: sub.customerCode } : {}),
    })
    .where(eq(organizations.id, orgId));
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
