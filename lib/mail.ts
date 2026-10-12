import "server-only";
import { siteUrl } from "@/lib/utils";

export interface Email {
  to: string;
  subject: string;
  text: string;
  html?: string;
  idempotencyKey?: string;
  tags?: Record<string, string>;
}

const FROM = () => process.env.MAIL_FROM ?? "StageGrid <no-reply@stagegrid.app>";

export async function sendMail(msg: Email): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "development") {
      console.log(`\n[mail → ${msg.to}] ${msg.subject}\n${msg.text}\n`);
    }
    return false;
  }

  const body = JSON.stringify({
    from: FROM(),
    to: msg.to,
    subject: msg.subject,
    text: msg.text,
    html: msg.html,
    reply_to: process.env.MAIL_REPLY_TO || undefined,
    tags: msg.tags ? Object.entries(msg.tags).map(([name, value]) => ({ name, value })) : undefined,
  });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          ...(msg.idempotencyKey ? { "Idempotency-Key": msg.idempotencyKey } : {}),
        },
        body,
      });
      if (res.ok) return true;
      if (res.status !== 429 && res.status < 500) {
        console.error("[mail] rejected", res.status, await res.text());
        return false;
      }
    } catch (err) {
      console.error("[mail] network error", err);
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  return false;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

interface Layout {
  preheader: string;
  heading: string;
  paragraphs: string[];
  details?: [string, string][];
  cta?: { label: string; path: string };
  footnote?: string;
}

function render(l: Layout): { html: string; text: string } {
  const details = l.details?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border-top:1px solid #e7e2d8;border-bottom:1px solid #e7e2d8">${l.details
        .map(
          ([k, v]) =>
            `<tr><td style="padding:10px 0;color:#8a847a;font-size:13px;width:38%;vertical-align:top">${esc(k)}</td><td style="padding:10px 0;font-size:14px;color:#1a1814;font-weight:500">${esc(v)}</td></tr>`,
        )
        .join("")}</table>`
    : "";
  const cta = l.cta
    ? `<p style="margin:28px 0 0"><a href="${esc(siteUrl(l.cta.path))}" style="display:inline-block;background:#ff5a2d;color:#1a0a04;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:999px">${esc(l.cta.label)}</a></p>`
    : "";

  const html = `<!doctype html><html><body style="margin:0;background:#f4f1ea;padding:32px 12px;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(l.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:10px;border:1px solid #e7e2d8">
<tr><td style="padding:28px 32px 0"><span style="font-weight:700;font-size:16px;color:#1a1814;letter-spacing:-0.01em"><span style="color:#ff5a2d">&#9632;</span>&nbsp; StageGrid</span></td></tr>
<tr><td style="padding:20px 32px 32px">
<h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#1a1814;font-weight:600;letter-spacing:-0.02em">${esc(l.heading)}</h1>
${l.paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3d3932">${esc(p)}</p>`).join("")}
${details}${cta}
${l.footnote ? `<p style="margin:28px 0 0;font-size:12px;line-height:1.5;color:#8a847a">${esc(l.footnote)}</p>` : ""}
</td></tr></table>
<p style="margin:18px 0 0;font-size:12px;color:#8a847a">© ${new Date().getFullYear()} StageGrid</p>
</td></tr></table></body></html>`;

  const text = [
    l.heading,
    "",
    ...l.paragraphs,
    ...(l.details ? ["", ...l.details.map(([k, v]) => `${k}: ${v}`)] : []),
    ...(l.cta ? ["", `${l.cta.label}: ${siteUrl(l.cta.path)}`] : []),
    ...(l.footnote ? ["", l.footnote] : []),
  ].join("\n");

  return { html, text };
}

function email(to: string, subject: string, l: Layout, extra?: Pick<Email, "idempotencyKey" | "tags">): Email {
  const { html, text } = render(l);
  return { to, subject, html, text, ...extra };
}

export interface TicketMail {
  to: string;
  name: string;
  eventTitle: string;
  eventPath: string;
  when: string;
  where: string;
  code: string;
  ticketName?: string | null;
  paid?: string;
  reference?: string;
}

export const templates = {
  welcome: (to: string, name: string, organizer: boolean) =>
    email(to, "Welcome to StageGrid", {
      preheader: "Your account is ready.",
      heading: `Welcome, ${name.split(" ")[0]}.`,
      paragraphs: organizer
        ? ["Your account is ready. Next, set up your workspace and publish your first event. It takes a couple of minutes."]
        : ["Your account is ready. Browse what's on, pick something you like and book your seat. Your tickets will always be in your history."],
      cta: organizer ? { label: "Set up your workspace", path: "/onboarding" } : { label: "Browse events", path: "/events" },
    }, { tags: { type: "welcome" } }),

  invite: (to: string, org: string, inviter: string, path: string) =>
    email(to, `${inviter} invited you to ${org} on StageGrid`, {
      preheader: `Join ${org} on StageGrid.`,
      heading: `Join ${org}`,
      paragraphs: [`${inviter} invited you to help run events for ${org}.`],
      cta: { label: "Accept invitation", path },
      footnote: "This invitation expires in 7 days.",
    }, { tags: { type: "invite" } }),

  reset: (to: string, path: string) =>
    email(to, "Reset your StageGrid password", {
      preheader: "Choose a new password.",
      heading: "Reset your password",
      paragraphs: ["We received a request to reset your password. Choose a new one with the button below."],
      cta: { label: "Choose a new password", path },
      footnote: "The link expires in one hour. If you didn't ask for this, you can safely ignore this email.",
    }, { tags: { type: "password_reset" } }),

  ticket: (t: TicketMail) =>
    email(t.to, t.paid ? `Your ticket: ${t.eventTitle}` : `You're booked: ${t.eventTitle}`, {
      preheader: `Ticket code ${t.code}`,
      heading: t.paid ? "Payment received. See you there." : "You're booked.",
      paragraphs: [
        `Hi ${t.name.split(" ")[0]}, here are the details for ${t.eventTitle}. Show your ticket code at the entrance.`,
      ],
      details: [
        ["Event", t.eventTitle],
        ["When", t.when],
        ["Where", t.where],
        ...(t.ticketName ? ([["Ticket", t.ticketName]] as [string, string][]) : []),
        ...(t.paid ? ([["Paid", t.paid]] as [string, string][]) : []),
        ["Ticket code", t.code],
        ...(t.reference ? ([["Reference", t.reference]] as [string, string][]) : []),
      ],
      cta: { label: "View event", path: t.eventPath },
    }, { idempotencyKey: `ticket-${t.code}`, tags: { type: t.paid ? "ticket_paid" : "ticket_free" } }),

  organizerSale: (to: string, i: { org: string; eventTitle: string; attendee: string; ticket: string; amount?: string; total: number; dashboardPath: string }) =>
    email(to, `New registration: ${i.eventTitle}`, {
      preheader: `${i.attendee} just booked.`,
      heading: i.amount ? "You made a sale." : "New registration.",
      paragraphs: [`${i.attendee} booked ${i.eventTitle}. You now have ${i.total} registration${i.total === 1 ? "" : "s"}.`],
      details: [["Ticket", i.ticket], ...(i.amount ? ([["Amount", i.amount]] as [string, string][]) : [])],
      cta: { label: "Open attendee list", path: i.dashboardPath },
    }, { tags: { type: "organizer_registration" } }),

  reminder: (t: TicketMail) =>
    email(t.to, `Tomorrow: ${t.eventTitle}`, {
      preheader: `${t.eventTitle} starts soon.`,
      heading: "It's almost time.",
      paragraphs: [`Hi ${t.name.split(" ")[0]}, ${t.eventTitle} is coming up. Have your ticket code ready at the door.`],
      details: [
        ["When", t.when],
        ["Where", t.where],
        ["Ticket code", t.code],
      ],
      cta: { label: "Event details", path: t.eventPath },
    }, { idempotencyKey: `reminder-${t.code}`, tags: { type: "reminder" } }),

  eventCancelled: (to: string, name: string, title: string) =>
    email(to, `Cancelled: ${title}`, {
      preheader: `${title} has been cancelled.`,
      heading: "This event was cancelled.",
      paragraphs: [`Hi ${name.split(" ")[0]}, the organizer has cancelled ${title}. Your booking has been released. We're sorry for the change of plans.`],
      cta: { label: "Find something else", path: "/events" },
    }, { tags: { type: "event_cancelled" } }),

  refund: (to: string, name: string, title: string, amount: string, reason: string) =>
    email(to, `Refund issued: ${title}`, {
      preheader: `We've refunded ${amount}.`,
      heading: "We've refunded your payment.",
      paragraphs: [`Hi ${name.split(" ")[0]}, ${reason} We've refunded ${amount} to your original payment method. It can take a few business days to show up.`],
      cta: { label: "Browse events", path: "/events" },
    }, { tags: { type: "refund" } }),

  subscriptionReceipt: (to: string, i: { org: string; plan: string; amount: string; renews: string; billingPath: string }) =>
    email(to, `Receipt: ${i.plan} plan for ${i.org}`, {
      preheader: `${i.amount} received.`,
      heading: "Payment received. Thank you.",
      paragraphs: [`${i.org} is on the ${i.plan} plan.`],
      details: [["Amount", i.amount], ["Plan", i.plan], ["Next renewal", i.renews]],
      cta: { label: "View billing", path: i.billingPath },
    }, { tags: { type: "subscription_receipt" } }),

  paymentFailed: (to: string, org: string, billingPath: string) =>
    email(to, `Payment failed for ${org}`, {
      preheader: "Update your payment method.",
      heading: "We couldn't take your payment.",
      paragraphs: [`The latest renewal for ${org} didn't go through. Update your payment method to keep your plan features.`],
      cta: { label: "Update billing", path: billingPath },
    }, { tags: { type: "payment_failed" } }),
};
