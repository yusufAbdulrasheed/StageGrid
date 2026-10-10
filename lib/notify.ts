import "server-only";
import { after } from "next/server";
import { sendMail, templates, type Email, type TicketMail } from "@/lib/mail";
import { formatDay, formatTime } from "@/lib/datetime";
import { formatMinor } from "@/lib/plans";
import type { EventRecord } from "@/lib/events";

/** Run after the response is sent (Next.js `after`); fall back to fire-and-forget outside a request (tests, scripts). */
function queue(...emails: Email[]) {
  const run = async () => {
    await Promise.allSettled(emails.map(sendMail));
  };
  try {
    after(run);
  } catch {
    void run();
  }
}

export function ticketMail(
  event: Pick<EventRecord, "title" | "slug" | "startsAt" | "timezone" | "venue" | "location">,
  attendee: { name: string; email: string },
  code: string,
  extra: { ticketName?: string | null; paidMinor?: number; reference?: string } = {},
): TicketMail {
  return {
    to: attendee.email,
    name: attendee.name,
    eventTitle: event.title,
    eventPath: `/events/${event.slug}`,
    when: `${formatDay(event.startsAt, event.timezone, "long")}, ${formatTime(event.startsAt, event.timezone)}`,
    where: [event.venue, event.location].filter(Boolean).join(", "),
    code,
    ticketName: extra.ticketName,
    paid: extra.paidMinor ? formatMinor(extra.paidMinor) : undefined,
    reference: extra.reference,
  };
}

export const notify = {
  welcome: (to: string, name: string, organizer: boolean) => queue(templates.welcome(to, name, organizer)),
  invite: (to: string, org: string, inviter: string, path: string) => queue(templates.invite(to, org, inviter, path)),
  reset: (to: string, path: string) => queue(templates.reset(to, path)),
  ticket: (t: TicketMail) => queue(templates.ticket(t)),
  reminders: (items: TicketMail[]) => queue(...items.map(templates.reminder)),
  organizerSale: (recipients: string[], i: Parameters<typeof templates.organizerSale>[1]) =>
    queue(...recipients.map((to) => templates.organizerSale(to, i))),
  cancelled: (people: { name: string; email: string }[], title: string) =>
    queue(...people.map((p) => templates.eventCancelled(p.email, p.name, title))),
  refund: (to: string, name: string, title: string, amountMinor: number, reason: string) =>
    queue(templates.refund(to, name, title, formatMinor(amountMinor), reason)),
  subscriptionReceipt: (recipients: string[], i: Parameters<typeof templates.subscriptionReceipt>[1]) =>
    queue(...recipients.map((to) => templates.subscriptionReceipt(to, i))),
  paymentFailed: (recipients: string[], org: string, billingPath: string) =>
    queue(...recipients.map((to) => templates.paymentFailed(to, org, billingPath))),
};
