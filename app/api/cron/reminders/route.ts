import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { dueReminders, markReminded } from "@/lib/events";
import { notify, ticketMail } from "@/lib/notify";

export const dynamic = "force-dynamic";

function authorised(header: string | null): boolean | "unconfigured" {
  const secret = process.env.CRON_SECRET;
  if (!secret) return "unconfigured";
  const given = Buffer.from(header?.replace(/^Bearer\s+/i, "") ?? "");
  const want = Buffer.from(secret);
  return given.length === want.length && timingSafeEqual(given, want);
}

/**
 * Sends "starts within 24h" reminders. Call hourly from any scheduler
 * (Vercel Cron, GitHub Actions, cron-job.org) with `Authorization: Bearer $CRON_SECRET`.
 * Each ticket is reminded once.
 */
export async function GET(req: Request) {
  const ok = authorised(req.headers.get("authorization"));
  if (ok === "unconfigured") return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const due = await dueReminders(24);
  notify.reminders(
    due.map((d) =>
      ticketMail(
        { title: d.title, slug: d.slug, startsAt: d.startsAt, timezone: d.timezone, venue: d.venue, location: d.location },
        { name: d.name, email: d.email },
        d.code,
        { ticketName: d.ticketName },
      ),
    ),
  );
  await markReminded(due.map((d) => d.bookingId));
  return NextResponse.json({ reminded: due.length });
}
