"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/auth";
import {
  attendeeEmails, createEvent, deleteEvent, duplicateEvent, getEventById, hasEnded, paidOrderCount,
  setEventStatus, updateEvent, validateTicketEdit,
} from "@/lib/events";
import { activeEventCount, limitsFor, type OrgRecord } from "@/lib/orgs";
import { payoutsReady } from "@/lib/orders";
import { eventSchema, flattenErrors, type TicketInput } from "@/lib/validation";
import { formValues, type FormState } from "@/lib/action-types";
import { rateLimit } from "@/lib/rate-limit";
import { notify } from "@/lib/notify";

/** Returns an error message if publishing one more live event would exceed the plan. */
async function publishLimitError(org: OrgRecord, alreadyLive: boolean): Promise<string | null> {
  const max = limitsFor(org).activeEvents;
  if (max == null || alreadyLive) return null;
  return (await activeEventCount(org.id)) >= max
    ? `Your plan allows ${max} live events at a time. Save this as a draft, or upgrade to publish more.`
    : null;
}

function capacityError(org: OrgRecord, capacity: number | null): string | null {
  const max = limitsFor(org).attendeesPerEvent;
  return max != null && capacity != null && capacity > max
    ? `Your plan supports up to ${max.toLocaleString("en-US")} attendees per event.`
    : null;
}

/** Selling tickets needs somewhere to send the money. */
function payoutError(org: OrgRecord, tickets: Pick<TicketInput, "price">[]): string | null {
  return tickets.some((t) => t.price > 0) && !payoutsReady(org)
    ? "Add your payout account before selling paid tickets. You can still save this as a draft."
    : null;
}

export async function createEventAction(orgSlug: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { user, org } = await requireOrg(orgSlug, "events");
  const values = formValues(fd);

  const parsed = eventSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: flattenErrors(parsed.error), values };

  const capErr = capacityError(org, parsed.data.capacity);
  if (capErr) return { fieldErrors: { capacity: [capErr] }, upgrade: true, values };

  if (parsed.data.intent === "publish") {
    const payErr = payoutError(org, parsed.data.tickets);
    if (payErr) return { error: payErr, payouts: true, values };
    const err = await publishLimitError(org, false);
    if (err) return { error: err, upgrade: true, values };
  }

  const limit = rateLimit(`create:${user.id}`, 30, 60 * 60_000);
  if (!limit.ok) return { error: "You're creating events too quickly. Try again shortly.", values };

  const event = await createEvent(parsed.data, { orgId: org.id, userId: user.id });
  revalidatePath("/", "layout");
  redirect(`/app/${org.slug}/events/${event.slug}?${event.status === "published" ? "created=1" : "saved=1"}`);
}

export async function updateEventAction(orgSlug: string, id: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const { org } = await requireOrg(orgSlug, "events");
  const values = formValues(fd);

  const existing = await getEventById(id);
  if (!existing || existing.orgId !== org.id) return { error: "That event doesn't belong to this workspace.", values };

  const parsed = eventSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { fieldErrors: flattenErrors(parsed.error), values };

  const capErr = capacityError(org, parsed.data.capacity);
  if (capErr) return { fieldErrors: { capacity: [capErr] }, upgrade: true, values };
  if (parsed.data.capacity != null && parsed.data.capacity < existing.booked) {
    return {
      fieldErrors: { capacity: [`${existing.booked} people have already booked, so capacity can't go below that`] },
      values,
    };
  }

  const ticketErr = await validateTicketEdit(id, parsed.data.tickets);
  if (ticketErr) return { fieldErrors: { tickets: [ticketErr] }, values };

  if (parsed.data.intent === "publish") {
    const payErr = payoutError(org, parsed.data.tickets);
    if (payErr) return { error: payErr, payouts: true, values };
    const err = await publishLimitError(org, existing.status === "published" && !hasEnded(existing));
    if (err) return { error: err, upgrade: true, values };
  }

  const event = await updateEvent(id, parsed.data);
  revalidatePath("/", "layout");
  redirect(`/app/${org.slug}/events/${event.slug}?updated=1`);
}

export async function setStatusAction(orgSlug: string, id: string, status: "draft" | "published"): Promise<void> {
  const { org } = await requireOrg(orgSlug, "events");
  const ev = await getEventById(id);
  if (!ev || ev.orgId !== org.id) return;
  if (status === "published") {
    if (payoutError(org, ev.tickets.map((t) => ({ price: t.price })))) redirect(`/app/${org.slug}/events/${ev.slug}?payouts=1`);
    const err = await publishLimitError(org, ev.status === "published");
    if (err) redirect(`/app/${org.slug}/events/${ev.slug}?limit=1`);
  }
  await setEventStatus(id, status);
  revalidatePath("/", "layout");
}

export async function duplicateEventAction(orgSlug: string, id: string): Promise<void> {
  const { user, org } = await requireOrg(orgSlug, "events");
  const ev = await getEventById(id);
  if (!ev || ev.orgId !== org.id) return;
  const copy = await duplicateEvent(id, user.id);
  if (copy) redirect(`/app/${org.slug}/events/${copy.slug}/edit`);
}

export async function deleteEventAction(orgSlug: string, id: string): Promise<void> {
  const { org } = await requireOrg(orgSlug, "events");
  const ev = await getEventById(id);
  if (!ev || ev.orgId !== org.id) redirect(`/app/${org.slug}/events`);

  // Deleting would orphan payments; sold events are unpublished (and refunded in Paystack) instead.
  if ((await paidOrderCount(id)) > 0) redirect(`/app/${org.slug}/events/${ev.slug}?delete=blocked`);

  const people = await attendeeEmails(id);
  await deleteEvent(id);
  if (ev.status === "published" && !hasEnded(ev)) notify.cancelled(people, ev.title);
  revalidatePath("/", "layout");
  redirect(`/app/${org.slug}/events`);
}
