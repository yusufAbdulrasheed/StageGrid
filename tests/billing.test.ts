import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { can, atLeast, PLANS, monthlyEquivalent } from "@/lib/plans";
import { FlutterwaveProvider, planFromId, readMeta, toVerified, verifyFlutterwaveHash } from "@/lib/billing/flutterwave";
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

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ status: status === 200 ? "success" : "error", message: "msg", data }), { status });

describe("flutterwave helpers", () => {
  beforeEach(() => {
    process.env.FLUTTERWAVE_SECRET_HASH = "my-secret-hash";
    process.env.FLUTTERWAVE_PLAN_PRO_MONTHLY = "1001";
    process.env.FLUTTERWAVE_PLAN_BUSINESS_YEARLY = "1002";
  });

  it("checks the webhook verif-hash header", () => {
    expect(verifyFlutterwaveHash("my-secret-hash")).toBe(true);
    expect(verifyFlutterwaveHash("my-secret-hasX")).toBe(false);
    expect(verifyFlutterwaveHash("short")).toBe(false);
    expect(verifyFlutterwaveHash(null)).toBe(false);
    delete process.env.FLUTTERWAVE_SECRET_HASH;
    expect(verifyFlutterwaveHash("my-secret-hash")).toBe(false);
  });

  it("maps payment plan ids both ways, accepting numbers or strings", () => {
    expect(planFromId(1001)).toEqual({ plan: "pro", interval: "monthly" });
    expect(planFromId("1002")).toEqual({ plan: "business", interval: "yearly" });
    expect(planFromId(9999)).toBeNull();
    expect(planFromId(null)).toBeNull();
  });

  it("reads meta whether it arrives as an object or as name/value pairs", () => {
    expect(readMeta({ orgId: "o1" })).toEqual({ orgId: "o1" });
    expect(readMeta([{ metaname: "orgId", metavalue: "o1" }, { metaname: "plan", metavalue: "pro" }])).toEqual({ orgId: "o1", plan: "pro" });
    expect(readMeta(null)).toEqual({});
  });

  it("converts naira to minor units and rejects failed, underpaid or unattributable charges", () => {
    const ok = { status: "successful", tx_ref: "sg_1", amount: 15000, currency: "NGN", customer: { email: "Owner@Test.dev" }, meta: { orgId: "o1", plan: "pro", interval: "monthly" } };
    const v = toVerified(ok)!;
    expect(v.amount).toBe(1_500_000);
    expect(v.customerCode).toBe("owner@test.dev");
    expect(v.plan).toBe("pro");
    expect(toVerified({ ...ok, status: "failed" })).toBeNull();
    expect(toVerified({ ...ok, amount: 1000 })).toBeNull();
    expect(toVerified({ ...ok, currency: "USD" })).toBeNull();
    expect(toVerified({ ...ok, meta: {} })).toBeNull();
    expect(toVerified({ ...ok, meta: null, payment_plan: 1001 }, { orgId: "o9", plan: "pro", interval: "monthly" })?.orgId).toBe("o9");
  });
});

describe("FlutterwaveProvider requests", () => {
  const provider = new FlutterwaveProvider("FLWSECK_TEST-key");
  beforeEach(() => {
    process.env.FLUTTERWAVE_PLAN_PRO_MONTHLY = "1001";
  });
  afterEach(() => vi.unstubAllGlobals());

  const lastCall = (m: ReturnType<typeof vi.fn>, i = 0) => {
    const [url, init] = m.mock.calls[i];
    return { url: url as string, init, body: init?.body ? JSON.parse(init.body) : undefined };
  };

  it("creates a subscription checkout in naira with the payment plan attached", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ link: "https://checkout.flutterwave.com/v3/hosted/pay/abc" }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await provider.checkout({
      org: { id: "org-1", name: "Lagos Nights" } as never,
      email: "owner@test.dev",
      plan: "pro",
      interval: "monthly",
      callbackUrl: "https://stagegrid.test/api/billing/callback?org=lagos-nights",
    });
    const { url, init, body } = lastCall(fetchMock);
    expect(url).toBe("https://api.flutterwave.com/v3/payments");
    expect(init.headers.Authorization).toBe("Bearer FLWSECK_TEST-key");
    expect(body).toMatchObject({ amount: 15000, currency: "NGN", payment_plan: 1001, meta: { orgId: "org-1", plan: "pro", interval: "monthly" } });
    expect(body.tx_ref).toBe(out.reference);
    expect(out.url).toContain("flutterwave.com");
  });

  it("splits ticket money to the organizer's subaccount with a flat share", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ link: "https://pay.example/x" }));
    vi.stubGlobal("fetch", fetchMock);
    await provider.chargeTicket({
      email: "buyer@test.dev",
      amountMinor: 1_500_000,
      feeMinor: 75_000,
      reference: "tkt_abc",
      callbackUrl: "https://stagegrid.test/api/checkout/callback",
      subaccount: "RS_123",
      metadata: { kind: "ticket" },
    });
    const { body } = lastCall(fetchMock);
    expect(body.amount).toBe(15000);
    expect(body.subaccounts).toEqual([{ id: "RS_123", transaction_charge_type: "flat_subaccount", transaction_charge: 14250 }]);
  });

  it("verifies by reference and reports the amount in minor units", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ id: 77, status: "successful", amount: 15000, currency: "NGN" }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await provider.verifyTicket("tkt_abc")).toEqual({ ok: true, amountMinor: 1_500_000, currency: "NGN" });
    expect(lastCall(fetchMock).url).toBe("https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=tkt_abc");
  });

  it("refunds by looking up the transaction id first", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json({ id: 77, status: "successful" })).mockResolvedValueOnce(json({}));
    vi.stubGlobal("fetch", fetchMock);
    await provider.refund("tkt_abc");
    expect(lastCall(fetchMock, 1).url).toBe("https://api.flutterwave.com/v3/transactions/77/refund");
    expect(lastCall(fetchMock, 1).init.method).toBe("POST");
  });

  it("cancels only the subscription that matches the old plan", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json([{ id: 5, status: "active", plan: 1001 }, { id: 6, status: "active", plan: 2002 }, { id: 7, status: "cancelled", plan: 1001 }]))
      .mockResolvedValue(json({}));
    vi.stubGlobal("fetch", fetchMock);
    await provider.cancelSubscription({ code: null, customer: "owner@test.dev", plan: "pro", interval: "monthly" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(lastCall(fetchMock, 1).url).toBe("https://api.flutterwave.com/v3/subscriptions/5/cancel");
    expect(lastCall(fetchMock, 1).init.method).toBe("PUT");
  });

  it("creates a subaccount with the contact number Flutterwave requires", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ subaccount_id: "RS_9", full_name: "LAGOS NIGHTS LTD", bank_name: "GTBANK" }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await provider.createSubaccount({ businessName: "Lagos Nights", bankCode: "058", accountNumber: "0123456789", businessMobile: "08012345678" });
    expect(lastCall(fetchMock).body).toMatchObject({ account_bank: "058", account_number: "0123456789", business_mobile: "08012345678", country: "NG" });
    expect(out).toEqual({ code: "RS_9", accountName: "LAGOS NIGHTS LTD", bankName: "GTBANK" });
  });

  it("throws on API errors so callers can surface them", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({}, 400)));
    await expect(provider.listBanks()).rejects.toThrow(/Flutterwave/);
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
