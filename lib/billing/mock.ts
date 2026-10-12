import "server-only";
import { randomBytes } from "node:crypto";
import type { BillingProvider, VerifiedPayment } from "@/lib/billing";
import { CURRENCY, PLANS, type Interval, type PlanId } from "@/lib/plans";

const BANKS = [
  { name: "Access Bank", code: "044" },
  { name: "GTBank", code: "058" },
  { name: "First Bank", code: "011" },
  { name: "Zenith Bank", code: "057" },
  { name: "UBA", code: "033" },
  { name: "Kuda Bank", code: "50211" },
];

export class MockProvider implements BillingProvider {
  readonly id = "mock" as const;

  async checkout({ org, plan, interval }: Parameters<BillingProvider["checkout"]>[0]) {
    const reference = `mock.${org.id}.${plan}.${interval}.${randomBytes(6).toString("hex")}`;
    return { url: `/billing/mock?ref=${encodeURIComponent(reference)}&org=${org.slug}`, reference };
  }

  async verify(reference: string): Promise<VerifiedPayment | null> {
    const [tag, orgId, plan, interval] = reference.split(".");
    if (tag !== "mock" || !orgId || (plan !== "pro" && plan !== "business") || (interval !== "monthly" && interval !== "yearly")) return null;
    return {
      reference,
      amount: PLANS[plan as PlanId].price[interval as Interval] * 100,
      currency: CURRENCY,
      paidAt: new Date(),
      plan,
      interval,
      orgId,
      customerCode: null,
    };
  }

  async chargeTicket(i: Parameters<BillingProvider["chargeTicket"]>[0]) {
    return { url: `/checkout/mock?ref=${encodeURIComponent(i.reference)}` };
  }
  async verifyTicket(_reference: string, expected: { amountMinor: number }) {
    return { ok: true, amountMinor: expected.amountMinor, currency: CURRENCY };
  }
  async refund() {}
  async createSubaccount(i: Parameters<BillingProvider["createSubaccount"]>[0]) {
    return { code: `RS_mock_${i.accountNumber.slice(-4)}`, accountName: i.businessName, bankName: BANKS.find((b) => b.code === i.bankCode)?.name ?? i.bankCode };
  }
  async listBanks() {
    return BANKS;
  }

  async cancelSubscription() {}
}
