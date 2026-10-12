import { beforeAll, describe, expect, it } from "vitest";
import {
  bookEvent, cancelBooking, createEvent, duplicateEvent, getEventBySlug, listAttendees, listEvents,
  listOrgAttendees, registrationsByDay, toggleCheckIn, listBookingHistory, validateTicketEdit, updateEvent,
} from "@/lib/events";
import { fulfillOrder, startTicketCheckout } from "@/lib/orders";
import { authenticate, createUser } from "@/lib/users";
import {
  acceptInvitation, activeEventCount, createInvitation, createOrg, effectivePlan, getOrgContext, memberSeatsUsed,
} from "@/lib/orgs";
import { applyPayment, type VerifiedPayment } from "@/lib/billing";
import { eventSchema } from "@/lib/validation";
import type { User } from "@/lib/users";
import type { OrgRecord } from "@/lib/orgs";

function input(over: Record<string, string> = {}) {
  const future = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
  return eventSchema.parse({
    title: "Test Summit",
    summary: "A summit for testing things.",
    description: "Long enough description to pass validation.",
    image: "/images/event1.png",
    mode: "online",
    venue: "",
    location: "Online",
    timezone: "UTC",
    date: future,
    startTime: "10:00",
    endTime: "12:00",
    category: "Conference",
    tags: "a, b",
    agenda: "10:00 — Start\n11:00 — End",
    capacity: "2",
    intent: "publish",
    ...over,
  });
}

let user: User;
let other: User;
let org: OrgRecord;
let otherOrg: OrgRecord;

beforeAll(async () => {
  user = (await createUser({ name: "Host", email: "host@test.dev", password: "password123" }))!;
  other = (await createUser({ name: "Other", email: "other@test.dev", password: "password123" }))!;
  org = await createOrg(user.id, "Test Org");
  otherOrg = await createOrg(other.id, "Other Org");
});

describe("accounts", () => {
  it("authenticates and rejects duplicate emails (case-insensitive)", async () => {
    expect(await createUser({ name: "Dup", email: "HOST@test.dev", password: "password123" })).toBeNull();
    expect((await authenticate("host@test.dev", "password123"))?.id).toBe(user.id);
    expect(await authenticate("host@test.dev", "nope")).toBeNull();
    expect(await authenticate("ghost@test.dev", "password123")).toBeNull();
  });
});

describe("organizations", () => {
  it("creates unique slugs, owner membership and isolates tenants", async () => {
    expect(org.slug).toBe("test-org");
    expect((await createOrg(user.id, "Test Org")).slug).toBe("test-org-2");
    expect((await createOrg(user.id, "New")).slug).toBe("new-org");
    expect((await getOrgContext(user.id, "test-org"))?.role).toBe("owner");
    expect(await getOrgContext(other.id, "test-org")).toBeNull();
  });

  it("accepts invitations once and counts seats", async () => {
    const token = await createInvitation(otherOrg.id, "invitee@test.dev", "member", other.id);
    expect(await memberSeatsUsed(otherOrg.id)).toBe(2);
    const invitee = (await createUser({ name: "Invitee", email: "invitee@test.dev", password: "password123" }))!;
    expect(await acceptInvitation(token, invitee.id)).toEqual({ orgSlug: otherOrg.slug });
    expect(await acceptInvitation(token, invitee.id)).toBeNull();
    expect((await getOrgContext(invitee.id, otherOrg.slug))?.role).toBe("member");
  });
});

describe("events", () => {
  it("creates events with unique slugs, reserved names and joined org data", async () => {
    const a = await createEvent(input(), { orgId: org.id, userId: user.id });
    const b = await createEvent(input(), { orgId: org.id, userId: user.id });
    expect(a.slug).toBe("test-summit");
    expect(b.slug).toBe("test-summit-2");
    expect((await createEvent(input({ title: "New!!!" }), { orgId: org.id, userId: user.id })).slug).toBe("new-event");
    expect(a.tags).toEqual(["a", "b"]);
    expect(a.organizer).toBe("Test Org");
    expect((await getEventBySlug(a.slug))?.agenda).toHaveLength(2);
  });

  it("hides drafts from public queries and counts live events", async () => {
    const draft = await createEvent(input({ title: "Secret Draft", intent: "draft" }), { orgId: org.id, userId: user.id });
    expect(draft.status).toBe("draft");
    expect((await listEvents({ q: "Secret" })).total).toBe(0);
    expect((await listEvents({ q: "Secret", orgId: org.id, includeDrafts: true })).total).toBe(1);
    expect(await activeEventCount(org.id)).toBeGreaterThanOrEqual(3);
  });

  it("duplicates as a draft in the same org", async () => {
    const src = (await getEventBySlug("test-summit"))!;
    const copy = (await duplicateEvent(src.id, user.id))!;
    expect(copy.status).toBe("draft");
    expect(copy.orgId).toBe(org.id);
    expect(copy.title).toBe("Test Summit (copy)");
  });

  it("searches without treating wildcards literally", async () => {
    expect((await listEvents({ q: "Summit" })).items.length).toBeGreaterThan(0);
    expect((await listEvents({ q: "100%_" })).total).toBe(0);
  });
});

describe("bookings", () => {
  it("enforces capacity, duplicates and cancellation", async () => {
    const e = await createEvent(input({ title: "Capacity Test" }), { orgId: org.id, userId: user.id });
    expect((await bookEvent(e.id, { name: "A", email: "a@x.com", userId: null })).ok).toBe(true);
    expect(await bookEvent(e.id, { name: "A", email: "A@x.com", userId: null })).toEqual({ ok: false, reason: "duplicate" });
    expect((await bookEvent(e.id, { name: "B", email: "b@x.com", userId: user.id })).ok).toBe(true);
    expect(await bookEvent(e.id, { name: "C", email: "c@x.com", userId: null })).toEqual({ ok: false, reason: "sold_out" });
    await cancelBooking(e.id, user.id, user.email);
    expect((await bookEvent(e.id, { name: "C", email: "c@x.com", userId: null })).ok).toBe(true);
  });

  it("never oversells under concurrent requests", async () => {
    const e = await createEvent(input({ title: "Race Test", capacity: "3" }), { orgId: org.id, userId: user.id });
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => bookEvent(e.id, { name: `P${i}`, email: `p${i}@x.com`, userId: null })),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(3);
    expect((await getEventBySlug(e.slug))?.booked).toBe(3);
  });

  it("applies the free-plan attendee cap even when capacity is unlimited", async () => {
    const e = await createEvent(input({ title: "Cap Plan Test", capacity: "" }), { orgId: org.id, userId: user.id });
    for (let i = 0; i < 50; i++) await bookEvent(e.id, { name: `Q${i}`, email: `q${i}@x.com`, userId: null });
    expect(await bookEvent(e.id, { name: "Late", email: "late@x.com", userId: null })).toEqual({ ok: false, reason: "plan_limit" });
  });

  it("refuses bookings for ended events and drafts", async () => {
    const old = await createEvent(input({ title: "Old Meetup", date: "2020-01-01" }), { orgId: org.id, userId: user.id });
    expect(await bookEvent(old.id, { name: "A", email: "a@x.com", userId: null })).toEqual({ ok: false, reason: "ended" });
    const draft = await createEvent(input({ title: "Draft Only", intent: "draft" }), { orgId: org.id, userId: user.id });
    expect(await bookEvent(draft.id, { name: "A", email: "a@x.com", userId: null })).toEqual({ ok: false, reason: "not_found" });
  });

  it("scopes check-in and attendee lists to the organization", async () => {
    const e = (await getEventBySlug("capacity-test"))!;
    const [first] = await listAttendees(e.id);
    await toggleCheckIn(first.id, otherOrg.id);
    expect((await listAttendees(e.id))[0].checkedInAt).toBeNull();
    await toggleCheckIn(first.id, org.id);
    expect((await listAttendees(e.id))[0].checkedInAt).not.toBeNull();
    expect((await listOrgAttendees(otherOrg.id)).total).toBe(0);
    expect((await listOrgAttendees(org.id, { q: first.code })).total).toBe(1);
  });

  it("aggregates daily registrations", async () => {
    const series = await registrationsByDay(org.id, 7);
    expect(series).toHaveLength(7);
    expect(series.reduce((s, d) => s + d.n, 0)).toBeGreaterThan(0);
  });
});

describe("billing", () => {
  const payment = (orgId: string, ref: string): VerifiedPayment => ({
    reference: ref,
    amount: 15_000_00,
    currency: "NGN",
    paidAt: new Date(),
    plan: "pro",
    interval: "monthly",
    orgId,
    customerCode: "CUS_test",
  });

  it("upgrades once per reference (idempotent) and extends the period", async () => {
    expect((await applyPayment(payment(org.id, "ref_1"), "flutterwave")).applied).toBe(true);
    expect((await applyPayment(payment(org.id, "ref_1"), "flutterwave")).applied).toBe(false);
    const ctx = (await getOrgContext(user.id, org.slug))!;
    expect(ctx.org.plan).toBe("pro");
    expect(effectivePlan(ctx.org)).toBe("pro");
    expect(ctx.org.currentPeriodEnd!.getTime()).toBeGreaterThan(Date.now() + 25 * 86_400_000);
  });

  it("lifts the attendee cap after upgrading", async () => {
    const e = (await getEventBySlug("cap-plan-test"))!;
    expect((await bookEvent(e.id, { name: "Late", email: "late@x.com", userId: null })).ok).toBe(true);
  });

  it("falls back to Starter limits once a canceled period lapses", () => {
    const base = { plan: "pro" as const, planStatus: "canceled" };
    expect(effectivePlan({ ...base, currentPeriodEnd: new Date(Date.now() + 86_400_000) })).toBe("pro");
    expect(effectivePlan({ ...base, currentPeriodEnd: new Date(Date.now() - 86_400_000) })).toBe("free");
    expect(effectivePlan({ plan: "pro", planStatus: "active", currentPeriodEnd: new Date(Date.now() - 10 * 86_400_000) })).toBe("free");
  });
});

describe("paid tickets", () => {
  const tiers = JSON.stringify([
    { name: "Regular", price: 5000, quantity: 2 },
    { name: "VIP", price: 20000, quantity: null },
  ]);

  it("stores tiers in minor units and exposes the price range", async () => {
    const e = await createEvent(input({ title: "Paid Night", capacity: "", tickets: tiers }), { orgId: org.id, userId: user.id });
    expect(e.tickets.map((t) => [t.name, t.price])).toEqual([["Regular", 500_000], ["VIP", 2_000_000]]);
    const listed = (await listEvents({ q: "Paid Night" })).items[0];
    expect([listed.minPrice, listed.maxPrice]).toEqual([500_000, 2_000_000]);
    expect((await listEvents({ q: "Paid Night", price: "free" })).total).toBe(0);
    expect((await listEvents({ q: "Paid Night", price: "paid" })).total).toBe(1);
  });

  it("refuses to seat a paid tier without a settled order", async () => {
    const e = (await getEventBySlug("paid-night"))!;
    expect(await bookEvent(e.id, { name: "Cheat", email: "cheat@x.com", userId: null }, { ticketTypeId: e.tickets[0].id })).toEqual({
      ok: false,
      reason: "payment_required",
    });
  });

  it("runs checkout -> fulfilment, issues one ticket and is idempotent", async () => {
    const buyer = (await createUser({ name: "Buyer One", email: "buyer1@test.dev", password: "password123" }))!;
    const e = (await getEventBySlug("paid-night"))!;
    const started = await startTicketCheckout(e.id, e.tickets[0].id, buyer);
    expect(started.ok).toBe(true);
    const ref = decodeURIComponent((started as { url: string }).url.split("ref=")[1]);

    const [a, b] = await Promise.all([fulfillOrder(ref), fulfillOrder(ref)]);
    expect([a.status, b.status].filter((s) => s === "paid")).toHaveLength(1 + (b.status === "paid" && a.status === "paid" ? 1 : 0));
    expect((await fulfillOrder(ref)).status).toBe("paid");

    const history = await listBookingHistory(buyer.id, buyer.email, 7);
    expect(history).toHaveLength(1);
    expect(history[0].amountPaid).toBe(500_000);
    expect(history[0].ticketName).toBe("Regular");
  });

  it("enforces per-tier quantity and refunds a buyer who loses the race", async () => {
    const e = (await getEventBySlug("paid-night"))!;
    const regular = e.tickets[0];
    const second = (await createUser({ name: "Buyer Two", email: "buyer2@test.dev", password: "password123" }))!;
    const third = (await createUser({ name: "Buyer Three", email: "buyer3@test.dev", password: "password123" }))!;

    const o2 = await startTicketCheckout(e.id, regular.id, second);
    const o3 = await startTicketCheckout(e.id, regular.id, third);
    expect(o2.ok && o3.ok).toBe(true);
    const ref = (r: unknown) => decodeURIComponent((r as { url: string }).url.split("ref=")[1]);

    expect((await fulfillOrder(ref(o2))).status).toBe("paid");
    const lost = await fulfillOrder(ref(o3));
    expect(lost.status).toBe("refunded");

    const after = await startTicketCheckout(e.id, regular.id, (await createUser({ name: "Late", email: "late2@test.dev", password: "password123" }))!);
    expect(after).toEqual({ ok: false, error: "That ticket type is sold out. Pick another." });
  });

  it("protects tiers that already have sales from edits", async () => {
    const e = (await getEventBySlug("paid-night"))!;
    expect(await validateTicketEdit(e.id, [{ name: "VIP", price: 20000, quantity: null }])).toMatch(/can't be removed/);
    expect(await validateTicketEdit(e.id, [{ name: "Regular", price: 9000, quantity: 2 }, { name: "VIP", price: 20000, quantity: null }])).toMatch(/price can't change/);
    expect(await validateTicketEdit(e.id, [{ name: "Regular", price: 5000, quantity: 1 }, { name: "VIP", price: 20000, quantity: null }])).toMatch(/quantity can't go lower/);
    expect(await validateTicketEdit(e.id, [{ name: "Regular", price: 5000, quantity: 5 }, { name: "VIP", price: 25000, quantity: null }, { name: "Table", price: 90000, quantity: 3 }])).toBeNull();
    void updateEvent;
  });
});
