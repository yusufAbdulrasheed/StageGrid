import Link from "next/link";
import EventImage from "@/components/EventImage";
import { priceLabel } from "@/components/EventCard";
import { dateParts, formatTime } from "@/lib/datetime";
import type { EventRecord } from "@/lib/events";
import { cn } from "@/lib/utils";

type Size = "lg" | "tall" | "wide";

const SLOT: Record<Size, string> = {
  lg: "col-span-2 aspect-[16/10] lg:col-span-4 lg:row-span-4 lg:aspect-auto",
  tall: "aspect-[4/5] lg:col-span-2 lg:row-span-6 lg:aspect-auto",
  wide: "aspect-[4/5] lg:col-span-4 lg:row-span-2 lg:aspect-auto",
};

function Tile({ event, size, delay, priority }: { event: EventRecord; size: Size; delay: number; priority?: boolean }) {
  const d = dateParts(event.startsAt, event.timezone);
  const free = event.maxPrice === 0;
  return (
    <Link
      href={`/events/${event.slug}`}
      className={cn(
        "group animate-rise relative isolate block overflow-hidden rounded-[var(--radius-card)] border border-line-strong bg-surface",
        SLOT[size],
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <EventImage
        src={event.image}
        alt=""
        priority={priority}
        sizes={size === "lg" ? "(min-width: 1024px) 40vw, 100vw" : "(min-width: 1024px) 20vw, 50vw"}
        className="object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.04]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10" aria-hidden />

      <div className="absolute left-3 top-3 flex min-w-12 flex-col items-center rounded bg-bg/90 px-2.5 py-1.5 leading-none backdrop-blur">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted">{d.month}</span>
        <span className="mt-1 text-lg font-semibold tabular-nums">{d.day}</span>
      </div>
      <span
        className={cn(
          "absolute right-3 top-3 rounded-full border px-2.5 py-1 font-mono text-[11px] backdrop-blur",
          free ? "border-ok/50 bg-black/40 text-ok" : "border-white/25 bg-black/40 text-white",
        )}
      >
        {priceLabel(event)}
      </span>

      <div className="absolute inset-x-4 bottom-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/65">{event.category}</p>
        <p
          className={cn(
            "display mt-1.5 text-balance text-white",
            size === "lg" ? "text-3xl leading-[1.05] sm:text-4xl xl:text-5xl" : "text-2xl leading-[1.08]",
          )}
        >
          {event.title}
        </p>
        <p className="mt-2 truncate text-[13px] text-white/75">
          {event.location} · {formatTime(event.startsAt, event.timezone, false)}
        </p>
      </div>
    </Link>
  );
}

export default function HeroMosaic({ events }: { events: EventRecord[] }) {
  const [a, b, c] = events;
  if (!a) return null;
  return (
    <div className="grid grid-cols-2 gap-3 lg:h-[640px] lg:grid-cols-6 lg:grid-rows-6">
      <Tile event={a} size="lg" delay={160} priority />
      {b && <Tile event={b} size="tall" delay={260} />}
      {c && <Tile event={c} size="wide" delay={360} />}
    </div>
  );
}
