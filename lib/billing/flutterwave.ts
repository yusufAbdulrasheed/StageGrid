import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import type { BillingProvider, SubscriptionRef, VerifiedPayment } from "@/lib/billing";
import { CURRENCY, PLANS, isPlanId, type Interval, type PlanId } from "@/lib/plans";

const API = "https://api.flutterwave.com/v3";

export function planId(plan: PlanId, interval: Interval): string | undefined {
  return process.env[`FLUTTERWAVE_PLAN_${plan.toUpperCase()}_${interval.toUpperCase()}`];
}

export function planFromId(id: string | number | undefined | null): { plan: Exclude<PlanId, "free">; interval: Interval } | null {
  if (id === undefined || id === null || id === "") return null;
  for (const plan of ["pro", "business"] as const) {
    for (const interval of ["monthly", "yearly"] as const) {
      if (planId(plan, interval) === String(id)) return { plan, interval };
    }
  }
  return null;
}

export function verifyFlutterwaveHash(header: string | null): boolean {
  const secret = process.env.FLUTTERWAVE_SECRET_HASH;
  if (!secret || !header) return false;
  const given = Buffer.from(header);
  const want = Buffer.from(secret);
  return given.length === want.length && timingSafeEqual(given, want);
}

export interface FlwTransaction {
  id?: number;
  tx_ref?: string;
  status?: string;
  amount?: number;
  currency?: string;
  created_at?: string;
  payment_plan?: number | string | null;
  customer?: { email?: string };
  meta?: unknown;
}

export function readMeta(meta: unknown): Record<string, unknown> {
  if (Array.isArray(meta)) {
    const out: Record<string, unknown> = {};
    for (const m of meta as { metaname?: string; metavalue?: unknown }[]) if (m?.metaname) out[m.metaname] = m.metavalue;
    return out;
  }
  return meta && typeof meta === "object" ? (meta as Record<string, unknown>) : {};
}

const toMinor = (naira: number) => Math.round(naira * 100);
const toMajor = (minor: number) => Math.round(minor) / 100;

export function toVerified(
  d: FlwTransaction,
  fallback?: { orgId: string; plan: PlanId; interval: Interval },
): VerifiedPayment | null {
  if (d.status !== "successful" || !d.tx_ref || typeof d.amount !== "number") return null;
  const meta = readMeta(d.meta);
  const fromPlan = planFromId(d.payment_plan);
  const metaPlan = typeof meta.plan === "string" && isPlanId(meta.plan) ? meta.plan : undefined;
  const metaInterval = meta.interval === "yearly" || meta.interval === "monthly" ? meta.interval : undefined;
  const plan = fromPlan?.plan ?? metaPlan ?? fallback?.plan;
  const interval = fromPlan?.interval ?? metaInterval ?? fallback?.interval;
  const orgId = typeof meta.orgId === "string" ? meta.orgId : fallback?.orgId;
  if (!plan || plan === "free" || !interval || !orgId) return null;
  const amount = toMinor(d.amount);
  if (d.currency !== CURRENCY || amount < PLANS[plan].price[interval] * 100) return null;
  return {
    reference: d.tx_ref,
    amount,
    currency: d.currency,
    paidAt: d.created_at ? new Date(d.created_at) : new Date(),
    plan,
    interval,
    orgId,
    customerCode: d.customer?.email?.toLowerCase() ?? null,
  };
}

export class FlutterwaveProvider implements BillingProvider {
  readonly id = "flutterwave" as const;
  constructor(private readonly secret: string) {}

  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${this.secret}`, "Content-Type": "application/json", ...init?.headers },
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as { status?: string; message?: string; data?: T };
    if (!res.ok || json.status !== "success") throw new Error(`Flutterwave ${path}: ${json.message ?? res.status}`);
    return json.data as T;
  }

  private byReference(reference: string) {
    return this.call<FlwTransaction>(`/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`);
  }

  async checkout({ org, email, plan, interval, callbackUrl }: Parameters<BillingProvider["checkout"]>[0]) {
    const id = planId(plan, interval);
    if (!id) throw new Error(`Missing env FLUTTERWAVE_PLAN_${plan.toUpperCase()}_${interval.toUpperCase()}`);
    const reference = `sg_${randomBytes(10).toString("hex")}`;
    const data = await this.call<{ link: string }>("/payments", {
      method: "POST",
      body: JSON.stringify({
        tx_ref: reference,
        amount: PLANS[plan].price[interval],
        currency: CURRENCY,
        redirect_url: callbackUrl,
        payment_plan: Number(id),
        customer: { email, name: org.name },
        meta: { orgId: org.id, plan, interval },
        customizations: { title: "StageGrid", description: `${PLANS[plan].name} plan, billed ${interval}` },
      }),
    });
    return { url: data.link, reference };
  }

  async verify(reference: string, fallback?: { orgId: string; plan: PlanId; interval: Interval }): Promise<VerifiedPayment | null> {
    return toVerified(await this.byReference(reference), fallback);
  }

  async cancelSubscription({ code, customer, plan, interval }: SubscriptionRef) {
    const ids: string[] = [];
    if (code) {
      ids.push(code);
    } else if (customer) {
      const subs = await this.call<{ id: number; status: string; plan: number | string }[]>(`/subscriptions?email=${encodeURIComponent(customer)}`);
      const wanted = plan && interval ? planId(plan, interval) : undefined;
      for (const s of subs) {
        if (s.status === "active" && (!wanted || String(s.plan) === wanted)) ids.push(String(s.id));
      }
    }
    for (const id of ids) await this.call(`/subscriptions/${encodeURIComponent(id)}/cancel`, { method: "PUT" });
  }

  async chargeTicket(i: Parameters<BillingProvider["chargeTicket"]>[0]) {
    const data = await this.call<{ link: string }>("/payments", {
      method: "POST",
      body: JSON.stringify({
        tx_ref: i.reference,
        amount: toMajor(i.amountMinor),
        currency: CURRENCY,
        redirect_url: i.callbackUrl,
        customer: { email: i.email },
        meta: i.metadata,
        customizations: { title: "StageGrid tickets" },
        ...(i.subaccount
          ? {
              subaccounts: [
                {
                  id: i.subaccount,
                  transaction_charge_type: "flat_subaccount",
                  transaction_charge: toMajor(i.amountMinor - i.feeMinor),
                },
              ],
            }
          : {}),
      }),
    });
    return { url: data.link };
  }

  async verifyTicket(reference: string) {
    const d = await this.byReference(reference);
    return { ok: d.status === "successful", amountMinor: toMinor(d.amount ?? 0), currency: d.currency ?? "" };
  }

  async refund(reference: string) {
    const d = await this.byReference(reference);
    if (!d.id) throw new Error(`Flutterwave: no transaction found for ${reference}`);
    await this.call(`/transactions/${d.id}/refund`, { method: "POST", body: JSON.stringify({}) });
  }

  async createSubaccount(i: Parameters<BillingProvider["createSubaccount"]>[0]) {
    const d = await this.call<{ subaccount_id: string; full_name?: string; account_name?: string; bank_name?: string }>("/subaccounts", {
      method: "POST",
      body: JSON.stringify({
        account_bank: i.bankCode,
        account_number: i.accountNumber,
        business_name: i.businessName,
        business_mobile: i.businessMobile,
        country: "NG",
        split_type: "percentage",
        split_value: 0.05,
      }),
    });
    return {
      code: d.subaccount_id,
      accountName: d.account_name ?? d.full_name ?? i.businessName,
      bankName: d.bank_name ?? i.bankCode,
    };
  }

  async listBanks() {
    const d = await this.call<{ name: string; code: string }[]>("/banks/NG");
    return d.map(({ name, code }) => ({ name, code }));
  }
}
