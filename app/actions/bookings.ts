"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser, requireOrg } from "@/lib/auth";
import { bookEvent, cancelBooking, getEventById, removeBooking, toggleCheckIn } from "@/lib/events";
import { failureCopy, fulfillOrder, startTicketCheckout } from "@/lib/orders";
import { listOrgNotifyEmails } from "@/lib/orgs";
import { notify, ticketMail } from "@/lib/notify";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getBillingProvider } from "@/lib/billing";
import type { FormState } from "@/lib/action-types";

export async function bookEventAction(eventId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in to book a seat." };

  const ticketTypeId = String(fd.get("ticketTypeId") ?? "");
  if (!ticketTypeId) return { error: "Choose a ticket first." };

  const limit = rateLimit(`book:${user.id}:${await clientIp()}`, 15, 10 * 60_000);
  if (!limit.ok) return { error: "Too many booking attempts. Please wait a few minutes." };

  const event = await getEventById(eventId);
  const tier = event?.tickets.find((t) => t.id === ticketTypeId);
  if (!event || event.status !== "published" || !tier) return { error: "This ticket is no longer available." };

  // Paid: hand off to hosted checkout. The seat is only issued once payment is verified.
  if (tier.price > 0) {
    const res = await startTicketCheckout(eventId, ticketTypeId, user);
    if (!res.ok) return { error: res.error };
    redirect(res.url);
  }

  const result = await bookEvent(eventId, { name: user.name, email: user.email, userId: user.id }, { ticketTypeId });
  if (!result.ok) return { error: failureCopy(result.reason) };

  notify.ticket(ticketMail(event, user, result.booking.code, { ticketName: tier.name }));
  notify.organizerSale(await listOrgNotifyEmails(event.orgId), {
    org: event.orgName,
    eventTitle: event.title,
    attendee: user.name,
    ticket: tier.name,
    total: event.booked + 1,
    dashboardPath: `/app/${event.orgSlug}/events/${event.slug}`,
  });
  revalidatePath(`/events/${event.slug}`);
  revalidatePath("/history");
  return { ok: true, message: `You're booked. Your ticket code is ${result.booking.code}. We've emailed the details to ${user.email}.` };
}

export async function cancelBookingAction(eventId: string) {
  const user = await getCurrentUser();
  if (!user) return;
  await cancelBooking(eventId, user.id, user.email);
  const event = await getEventById(eventId);
  if (event) revalidatePath(`/events/${event.slug}`);
  revalidatePath("/history");
}

/** Dev-only: completes the simulated ticket checkout. */
export async function confirmMockTicketAction(reference: string) {
  const provider = getBillingProvider();
  if (provider?.id !== "mock") redirect("/events");
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const res = await fulfillOrder(reference);
  redirect(res.status === "paid" ? `/history?booked=${res.eventSlug}` : res.eventSlug ? `/events/${res.eventSlug}?payment=${res.status}` : "/events");
}

/* ---- organizer-side attendee tools ---- */

export async function checkInAction(orgSlug: string, bookingId: string) {
  const { org } = await requireOrg(orgSlug, "events");
  await toggleCheckIn(bookingId, org.id);
  revalidatePath(`/app/${orgSlug}`, "layout");
}

export async function removeAttendeeAction(orgSlug: string, bookingId: string) {
  const { org } = await requireOrg(orgSlug, "events");
  await removeBooking(bookingId, org.id);
  revalidatePath(`/app/${orgSlug}`, "layout");
}
