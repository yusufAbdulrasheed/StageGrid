import Link from "next/link";
import EventImage from "@/components/EventImage";
import { MODE_LABEL } from "@/lib/constants";
import { dateParts, formatTime, relativeUntil } from "@/lib/datetime";
import { hasEnded, isFree, spotsLeft, type EventRecord } from "@/lib/events";
import { formatMinor } from "@/lib/plans";

export function AvailabilityBadge({ event }: { event: Pick<EventRecord, "capacity" | "booked" | "startsAt" | "endsAt"> }) {
  if (hasEnded(event)) return <span className="chip">Ended</span>;
  const left = spotsLeft(event);
  if (left === 0) return <span className="chip border-danger/50 text-danger">Sold out</span>;
  if (left !== null && left <= Math.max(5, (event.capacity ?? 0) * 0.1)) {
    return <span className="chip border-accent/50 text-accent">{left} left</span>;
  }
  return null;
}

export function priceLabel(e: Pick<EventRecord, "minPrice" | "maxPrice">) {
  if (e.maxPrice === 0) return "Free";
  return e.minPrice === e.maxPrice ? formatMinor(e.minPrice) : `From ${formatMinor(e.minPrice)}`;
}

export default function EventCard({ event, index = 0 }: { event: EventRecord; index?: number }) {
  const d = dateParts(event.startsAt, event.timezone);
  return (
    <Link
      href={`/events/${event.slug}`}
      className="group animate-rise flex flex-col"
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
        <EventImage
          src={event.image}
          alt=""
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
        />
        <div className="absolute left-3 top-3 flex min-w-12 flex-col items-center rounded bg-bg/90 px-2.5 py-1.5 leading-none backdrop-blur">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted">{d.month}</span>
          <span className="mt-1 text-lg font-semibold tabular-nums">{d.day}</span>
        </div>
        <div className="absolute right-3 top-3">
          <AvailabilityBadge event={event} />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-faint">
        <span>{event.category}</span>
        <span aria-hidden>·</span>
        <span>{MODE_LABEL[event.mode]}</span>
      </div>
      <h3 className="mt-1.5 text-[19px] font-medium leading-snug tracking-tight text-balance group-hover:text-accent">
        {event.title}
      </h3>
      <p className="mt-1 text-sm text-muted">
        {event.location} · {formatTime(event.startsAt, event.timezone, false)}
        {!hasEnded(event) && <span className="text-faint"> · {relativeUntil(event.startsAt)}</span>}
      </p>
      <p className={`mt-2 font-mono text-[13px] tabular-nums ${isFree(event) ? "text-ok" : "text-ink"}`}>{priceLabel(event)}</p>
    </Link>
  );
}
