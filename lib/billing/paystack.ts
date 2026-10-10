import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { BillingProvider, VerifiedPayment } from "@/lib/billing";
import { CURRENCY, PLANS, isPlanId, type Interval, type PlanId } from "@/lib/plans";

const API = "https://api.paystack.co";

/** Paystack plan codes are created in the dashboard; map them via env. */
export function planCode(plan: PlanId, interval: Interval): string | undefined {
  return process.env[`PAYSTACK_PLAN_${plan.toUpperCase()}_${interval.toUpperCase()}`];
}

export function planFromCode(code: string | undefined | null): { plan: Exclude<PlanId, "free">; interval: Interval } | null {
  if (!code) return null;
  for (const plan of ["pro", "business"] as const) {
    for (const interval of ["monthly", "yearly"] as const) {
      if (planCode(plan, interval) === code) return { plan, interval };
    }
  }
  return null;
}

export function verifyPaystackSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !signature) return false;
  const expected = createHmac("sha512", secret).update(rawBody).digest();
  const given = Buffer.from(signature, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export class PaystackProvider implements BillingProvider {
  readonly id = "paystack" as const;
  constructor(private readonly secret: string) {}

  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${this.secret}`, "Content-Type": "application/json", ...init?.headers },
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as { status?: boolean; message?: string; data?: T };
    if (!res.ok || json.status === false) throw new Error(`Paystack ${path}: ${json.message ?? res.status}`);
    return json.data as T;
  }

  async checkout({ org, email, plan, interval, callbackUrl }: Parameters<BillingProvider["checkout"]>[0]) {
    const code = planCode(plan, interval);
    if (!code) throw new Error(`Missing env PAYSTACK_PLAN_${plan.toUpperCase()}_${interval.toUpperCase()}`);
    const reference = `sg_${randomBytes(10).toString("hex")}`;
    const data = await this.call<{ authorization_url: string; reference: string }>("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        email,
        amount: PLANS[plan].price[interval] * 100,
        currency: CURRENCY,
        plan: code,
        reference,
        callback_url: callbackUrl,
        metadata: { orgId: org.id, plan, interval },
      }),
    });
    return { url: data.authorization_url, reference: data.reference };
  }

  async verify(reference: string): Promise<VerifiedPayment | null> {
    const d = await this.call<{
      status: string;
      reference: string;
      amount: number;
      currency: string;
      paid_at?: string;
      metadata?: { orgId?: string; plan?: string; interval?: string } | null;
      plan?: { plan_code?: string } | null;
      customer?: { customer_code?: string };
    }>(`/transaction/verify/${encodeURIComponent(reference)}`);
    return toVerified(d);
  }

  async cancelSubscription(code: string, token: string) {
    await this.call("/subscription/disable", { method: "POST", body: JSON.stringify({ code, token }) });
  }

  async chargeTicket(i: Parameters<BillingProvider["chargeTicket"]>[0]) {
    const data = await this.call<{ authorization_url: string }>("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        email: i.email,
        amount: i.amountMinor,
        currency: CURRENCY,
        reference: i.reference,
        callback_url: i.callbackUrl,
        metadata: i.metadata,
        ...(i.subaccount ? { subaccount: i.subaccount, transaction_charge: i.feeMinor, bearer: "subaccount" } : {}),
      }),
    });
    return { url: data.authorization_url };
  }

  async verifyTicket(reference: string) {
    const d = await this.call<{ status: string; amount: number; currency: string }>(`/transaction/verify/${encodeURIComponent(reference)}`);
    return { ok: d.status === "success", amountMinor: d.amount, currency: d.currency };
  }

  async refund(reference: string) {
    await this.call("/refund", { method: "POST", body: JSON.stringify({ transaction: reference }) });
  }

  async createSubaccount(i: { businessName: string; bankCode: string; accountNumber: string }) {
    const d = await this.call<{ subaccount_code: string; account_name?: string; settlement_bank?: string }>("/subaccount", {
      method: "POST",
      body: JSON.stringify({
        business_name: i.businessName,
        settlement_bank: i.bankCode,
        account_number: i.accountNumber,
        percentage_charge: 0,
      }),
    });
    return { code: d.subaccount_code, accountName: d.account_name ?? i.businessName, bankName: d.settlement_bank ?? i.bankCode };
  }

  async listBanks() {
    const d = await this.call<{ name: string; code: string }[]>("/bank?country=nigeria&perPage=100&use_cursor=false");
    return d.map(({ name, code }) => ({ name, code }));
  }

  async manageUrl(subscriptionCode: string) {
    try {
      const d = await this.call<{ link: string }>(`/subscription/${encodeURIComponent(subscriptionCode)}/manage/link`);
      return d.link;
    } catch {
      return null;
    }
  }
}

/** Shared by verify() and the charge.success webhook (same payload shape). */
export function toVerified(
  d: {
    status: string;
    reference: string;
    amount: number;
    currency: string;
    paid_at?: string;
    metadata?: { orgId?: string; plan?: string; interval?: string } | null;
    plan?: { plan_code?: string } | null;
    customer?: { customer_code?: string };
  },
  fallback?: { orgId: string; plan: PlanId; interval: Interval },
): VerifiedPayment | null {
  if (d.status !== "success") return null;
  const meta = d.metadata ?? {};
  const fromCode = planFromCode(d.plan?.plan_code);
  const plan = fromCode?.plan ?? (isPlanId(meta.plan) ? meta.plan : fallback?.plan);
  const interval = fromCode?.interval ?? (meta.interval === "yearly" || meta.interval === "monthly" ? meta.interval : fallback?.interval);
  const orgId = meta.orgId ?? fallback?.orgId;
  if (!plan || plan === "free" || !interval || !orgId) return null;
  // Guard against underpayment (e.g. a tampered plan/amount pairing).
  if (d.currency !== CURRENCY || d.amount < PLANS[plan].price[interval] * 100) return null;
  return {
    reference: d.reference,
    amount: d.amount,
    currency: d.currency,
    paidAt: d.paid_at ? new Date(d.paid_at) : new Date(),
    plan,
    interval,
    orgId,
    customerCode: d.customer?.customer_code ?? null,
  };
}
