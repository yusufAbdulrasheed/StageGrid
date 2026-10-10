import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { can, atLeast, PLANS, monthlyEquivalent } from "@/lib/plans";
import { planFromCode, toVerified, verifyPaystackSignature } from "@/lib/billing/paystack";
import { csvCell, attendeesCsv } from "@/lib/csv";

describe("permissions", () => {
  it("scopes actions by role", () => {
    expect(can("member", "events")).toBe(true);
    expect(can("member", "team")).toBe(false);
    expect(can("admin", "team")).toBe(true);
    expect(can("admin", "billing")).toBe(false);
    expect(can("owner", "billing")).toBe(true);
    expect(atLeast("admin", "member")).toBe(true);
  });
});

describe("plans", () => {
  it("gives yearly a 20% discount", () => {
    for (const id of ["pro", "business"] as const) {
      expect(PLANS[id].price.yearly).toBe(PLANS[id].price.monthly * 12 * 0.8);
      expect(monthlyEquivalent(PLANS[id], "yearly")).toBeLessThan(PLANS[id].price.monthly);
    }
  });
});

describe("paystack", () => {
  beforeEach(() => {
    process.env.PAYSTACK_SECRET_KEY = "sk_test_secret";
    process.env.PAYSTACK_PLAN_PRO_MONTHLY = "PLN_pro_m";
    process.env.PAYSTACK_PLAN_BUSINESS_YEARLY = "PLN_biz_y";
  });

  it("verifies webhook signatures over the raw body", () => {
    const body = JSON.stringify({ event: "charge.success", data: { id: 1 } });
    const sig = createHmac("sha512", "sk_test_secret").update(body).digest("hex");
    expect(verifyPaystackSignature(body, sig)).toBe(true);
    expect(verifyPaystackSignature(body + " ", sig)).toBe(false);
    expect(verifyPaystackSignature(body, "deadbeef")).toBe(false);
    expect(verifyPaystackSignature(body, null)).toBe(false);
  });

  it("maps plan codes both ways", () => {
    expect(planFromCode("PLN_pro_m")).toEqual({ plan: "pro", interval: "monthly" });
    expect(planFromCode("PLN_biz_y")).toEqual({ plan: "business", interval: "yearly" });
    expect(planFromCode("PLN_unknown")).toBeNull();
  });

  it("rejects failed, underpaid and unattributable charges", () => {
    const ok = { status: "success", reference: "r1", amount: 15_000_00, currency: "NGN", metadata: { orgId: "o1", plan: "pro", interval: "monthly" } };
    expect(toVerified(ok)?.plan).toBe("pro");
    expect(toVerified({ ...ok, status: "failed" })).toBeNull();
    expect(toVerified({ ...ok, amount: 1_000_00 })).toBeNull();
    expect(toVerified({ ...ok, currency: "USD" })).toBeNull();
    expect(toVerified({ ...ok, metadata: {} })).toBeNull();
    // Renewals carry no metadata; fall back to the known subscription.
    expect(toVerified({ ...ok, metadata: null, plan: { plan_code: "PLN_pro_m" } }, { orgId: "o9", plan: "pro", interval: "monthly" })?.orgId).toBe("o9");
  });
});

describe("csv", () => {
  it("neutralises spreadsheet formulas and escapes quotes", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell("Ada \"AJ\" Obi")).toBe(`"Ada ""AJ"" Obi"`);
    const out = attendeesCsv([{ name: "+evil", email: "e@x.com", code: "K7QM2XRD", checkedInAt: null, createdAt: "2026-01-01" }]);
    expect(out.split("\n")[1]).toContain(`"'+evil"`);
  });
});
