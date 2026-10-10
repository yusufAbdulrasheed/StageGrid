import type { Metadata } from "next";
import Link from "next/link";
import EventImage from "@/components/EventImage";
import { requireUser } from "@/lib/auth";
import { hasEnded, listBookingHistory } from "@/lib/events";
import { formatDay, formatTime } from "@/lib/datetime";
import { formatMinor, formatNaira } from "@/lib/plans";
import { cn, pluralize } from "@/lib/utils";

export const metadata: Metadata = { title: "My bookings", robots: { index: false } };
export const dynamic = "force-dynamic";

const RANGES = [
  { id: "7d", label: "Past 7 days", days: 7 },
  { id: "30d", label: "Past month", days: 30 },
  { id: "1y", label: "Past year", days: 365 },
] as const;

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ range?: string; booked?: string }> }) {
  const user = await requireUser("/history");
  const sp = await searchParams;
  const range = RANGES.find((r) => r.id === sp.range) ?? RANGES[1];

  const items = await listBookingHistory(user.id, user.email, range.days);
  const spent = items.reduce((s, i) => s + i.amountPaid, 0);

  return (
    <div className="wrap pb-8 pt-14">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow">History</p>
          <h1 className="display mt-3 text-5xl sm:text-6xl">Your bookings.</h1>
        </div>
        <Link href="/events" className="btn btn-ghost">Find events</Link>
      </header>

      {sp.booked && (
        <p role="status" className="mt-8 rounded-[var(--radius-card)] border border-ok/30 bg-ok/10 px-4 py-3 text-sm">
          Payment confirmed. Your ticket is below, and we&apos;ve emailed a copy to {user.email}.
        </p>
      )}

      <nav aria-label="Time range" className="mt-10 flex gap-1 border-b border-line">
        {RANGES.map((r) => (
          <Link
            key={r.id}
            href={`/history?range=${r.id}`}
            aria-current={r.id === range.id ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-4 pb-3 pt-2 text-sm transition-colors",
              r.id === range.id ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {r.label}
          </Link>
        ))}
      </nav>

      <p className="mt-6 font-mono text-xs text-faint">
        {pluralize(items.length, "booking")} · {spent > 0 ? `${formatNaira(spent / 100)} spent` : "nothing spent"}
      </p>

      {items.length === 0 ? (
        <div className="card mt-6 px-6 py-20 text-center">
          <p className="display text-3xl">Nothing booked in this period.</p>
          <p className="mx-auto mt-2 max-w-sm text-muted">Events you book will show up here, newest first.</p>
          <Link href="/events" className="btn btn-primary mt-6">Browse events</Link>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {items.map((e) => {
            const done = hasEnded(e);
            return (
              <li key={`${e.id}-${e.ticketCode}`}>
                <Link href={`/events/${e.slug}`} className="group flex items-center gap-5 py-5">
                  <div className="relative hidden h-20 w-28 shrink-0 overflow-hidden rounded border border-line sm:block">
                    <EventImage src={e.image} alt="" sizes="112px" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-medium tracking-tight group-hover:text-accent">{e.title}</p>
                    <p className="text-sm text-muted">
                      {formatDay(e.startsAt, e.timezone)} · {formatTime(e.startsAt, e.timezone)} · {e.location}
                    </p>
                    <p className="mt-1 font-mono text-xs text-faint">
                      Booked {new Date(e.bookedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      {e.ticketName && ` · ${e.ticketName}`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-sm tabular-nums">{formatMinor(e.amountPaid)}</p>
                    <p className="mt-1 font-mono text-xs tracking-widest text-muted">{e.ticketCode}</p>
                    <span className={cn("chip mt-2", done ? "" : "border-ok/40 text-ok")}>{done ? "Attended" : "Upcoming"}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
