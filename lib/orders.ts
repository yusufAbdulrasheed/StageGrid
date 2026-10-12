import "server-only";
import { randomBytes } from "node:crypto";
import { and, count, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { bookings, orders, ticketTypes } from "@/lib/db/schema";
import { bookEvent, getEventById, ticketAvailability, type BookFailure } from "@/lib/events";
import { getBillingProvider } from "@/lib/billing";
import { getOrgById, limitsFor, listOrgNotifyEmails, type OrgRecord } from "@/lib/orgs";
import { getUserById, type User } from "@/lib/users";
import { notify, ticketMail } from "@/lib/notify";
import { CURRENCY } from "@/lib/plans";
import { siteUrl } from "@/lib/utils";

export function payoutsReady(org: OrgRecord): boolean {
  const provider = getBillingProvider();
  return provider?.id === "mock" || !!org.subaccountCode;
}

export function platformFee(org: OrgRecord, amountMinor: number): number {
  return Math.round((amountMinor * limitsFor(org).ticketFeePercent) / 100);
}

export type CheckoutResult = { ok: true; url: string } | { ok: false; error: string };

const FAILURE_COPY: Record<BookFailure, string> = {
  not_found: "This event is no longer available.",
  ended: "This event has already ended.",
  sold_out: "Sorry, this event is sold out.",
  tier_sold_out: "That ticket type is sold out. Pick another.",
  duplicate: "You already have a ticket for this event.",
  plan_limit: "Registration for this event is closed.",
  payment_required: "This ticket needs payment first.",
};
export const failureCopy = (r: BookFailure) => FAILURE_COPY[r];

export async function startTicketCheckout(eventId: string, ticketTypeId: string, user: User): Promise<CheckoutResult> {
  const unavailable = await ticketAvailability(eventId, ticketTypeId);
  if (unavailable) return { ok: false, error: FAILURE_COPY[unavailable] };

  const event = await getEventById(eventId);
  const tier = event?.tickets.find((t) => t.id === ticketTypeId);
  if (!event || !tier || tier.price === 0) return { ok: false, error: "That ticket isn't available." };

  const db = await getDb();
  const org = await getOrgById(event.orgId);
  const provider = getBillingProvider();
  if (!org || !provider) return { ok: false, error: "Payments aren't available right now." };
  if (!payoutsReady(org)) return { ok: false, error: "The organizer hasn't finished setting up payouts yet." };

  const reference = `tkt_${randomBytes(10).toString("hex")}`;
  const fee = platformFee(org, tier.price);
  const [order] = await db
    .insert(orders)
    .values({ reference, eventId, ticketTypeId, userId: user.id, amount: tier.price, platformFee: fee, currency: CURRENCY })
    .returning({ id: orders.id });

  try {
    const { url } = await provider.chargeTicket({
      email: user.email,
      amountMinor: tier.price,
      feeMinor: fee,
      reference,
      callbackUrl: siteUrl("/api/checkout/callback"),
      subaccount: org.subaccountCode,
      metadata: { kind: "ticket", orderId: order.id, eventId, ticketTypeId, userId: user.id },
    });
    return { ok: true, url };
  } catch (err) {
    console.error("[orders] charge init failed", err);
    await db.update(orders).set({ status: "failed" }).where(eq(orders.id, order.id));
    return { ok: false, error: "We couldn't start the payment. Please try again." };
  }
}

export type FulfillResult =
  | { status: "paid"; eventSlug: string }
  | { status: "refunded"; eventSlug: string; reason: string }
  | { status: "processing" | "failed" | "unknown"; eventSlug?: string };

export async function fulfillOrder(reference: string): Promise<FulfillResult> {
  const db = await getDb();
  const [order] = await db.select().from(orders).where(eq(orders.reference, reference)).limit(1);
  if (!order) return { status: "unknown" };
  const event = await getEventById(order.eventId);
  const eventSlug = event?.slug;
  if (order.status === "paid") return { status: "paid", eventSlug: eventSlug! };
  if (order.status === "refunded") return { status: "refunded", eventSlug: eventSlug!, reason: "sold out" };
  if (order.status === "processing") return { status: "processing", eventSlug };

  const provider = getBillingProvider();
  if (!provider || !event) return { status: "failed", eventSlug };

  const verified = await provider.verifyTicket(reference, { amountMinor: order.amount }).catch(() => null);
  if (!verified?.ok || verified.amountMinor < order.amount || verified.currency !== order.currency) {
    return { status: "failed", eventSlug };
  }

  const [claimed] = await db
    .update(orders)
    .set({ status: "processing" })
    .where(and(eq(orders.id, order.id), eq(orders.status, "pending")))
    .returning({ id: orders.id });
  if (!claimed) return { status: "processing", eventSlug };

  try {
    const user = await getUserById(order.userId);
    if (!user) throw new Error("buyer no longer exists");

    const booked = await bookEvent(order.eventId, { name: user.name, email: user.email, userId: user.id }, {
      ticketTypeId: order.ticketTypeId ?? undefined,
      orderId: order.id,
      amountPaid: order.amount,
    });

    if (booked.ok) {
      await db.update(orders).set({ status: "paid", paidAt: new Date() }).where(eq(orders.id, order.id));
      const [tier] = order.ticketTypeId
        ? await db.select({ name: ticketTypes.name }).from(ticketTypes).where(eq(ticketTypes.id, order.ticketTypeId)).limit(1)
        : [];
      notify.ticket(ticketMail(event, user, booked.booking.code, { ticketName: tier?.name, paidMinor: order.amount, reference }));
      const recipients = await listOrgNotifyEmails(event.orgId);
      const [{ n }] = await db.select({ n: count() }).from(bookings).where(eq(bookings.eventId, event.id));
      notify.organizerSale(recipients, {
        org: event.orgName,
        eventTitle: event.title,
        attendee: user.name,
        ticket: tier?.name ?? "Ticket",
        amount: `₦${(order.amount / 100).toLocaleString("en-NG")}`,
        total: Number(n),
        dashboardPath: `/app/${event.orgSlug}/events/${event.slug}`,
      });
      return { status: "paid", eventSlug: event.slug };
    }

    await provider.refund(reference).catch((e) => console.error("[orders] refund failed", reference, e));
    await db.update(orders).set({ status: "refunded" }).where(eq(orders.id, order.id));
    const reason =
      booked.reason === "duplicate"
        ? "you already had a ticket for this event."
        : "the event sold out while your payment was processing.";
    notify.refund(user.email, user.name, event.title, order.amount, reason.charAt(0).toUpperCase() + reason.slice(1));
    return { status: "refunded", eventSlug: event.slug, reason };
  } catch (err) {
    console.error("[orders] fulfil failed", reference, err);
    await db.update(orders).set({ status: "pending" }).where(eq(orders.id, order.id));
    return { status: "failed", eventSlug };
  }
}
