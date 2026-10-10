import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import EventCard from "@/components/EventCard";
import EventFilters from "@/components/EventFilters";
import Pagination from "@/components/Pagination";
import { listEvents } from "@/lib/events";
import { CATEGORIES, MODES } from "@/lib/constants";
import { pluralize } from "@/lib/utils";

export const dynamic = "force-dynamic";

type SP = { q?: string; category?: string; mode?: string; price?: string; when?: string; page?: string };

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const sp = await searchParams;
  const parts = [sp.category ?? "Events", sp.q ? `matching “${sp.q}”` : ""].filter(Boolean);
  return {
    title: sp.when === "past" ? "Past events" : parts.join(" "),
    description: "Browse concerts, parties, festivals, workshops, meetups and more.",
    alternates: { canonical: "/events" },
  };
}

export default async function EventsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const category = CATEGORIES.includes(sp.category as never) ? sp.category : undefined;
  const mode = MODES.includes(sp.mode as never) ? sp.mode : undefined;
  const price = sp.price === "free" || sp.price === "paid" ? sp.price : undefined;
  const when = sp.when === "past" ? "past" : "upcoming";
  const page = Math.max(1, Number(sp.page) || 1);

  const { items, total, pageCount } = await listEvents({ q: sp.q, category, mode, price, when, page });
  const filtered = !!(sp.q || category || mode || price);

  return (
    <div className="wrap pb-8 pt-14">
      <header className="mb-10 max-w-2xl">
        <p className="eyebrow">{when === "past" ? "Archive" : "Events near you and online"}</p>
        <h1 className="display mt-3 text-5xl sm:text-6xl">{when === "past" ? "Past events" : "What's on"}</h1>
      </header>

      <Suspense>
        <EventFilters />
      </Suspense>

      <p className="mb-8 mt-8 font-mono text-xs text-faint" aria-live="polite">
        {pluralize(total, "event")}
        {filtered && " match your filters"}
      </p>

      {items.length === 0 ? (
        <div className="card px-6 py-20 text-center">
          <p className="display text-3xl">No events found.</p>
          <p className="mx-auto mt-2 max-w-sm text-muted">
            {filtered ? "Try a broader search or clear a filter." : "Nothing here yet."}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            {filtered && (
              <Link href="/events" className="btn btn-ghost">
                Clear filters
              </Link>
            )}
            <Link href="/events/new" className="btn btn-primary">
              Host an event
            </Link>
          </div>
        </div>
      ) : (
        <ul className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((e, i) => (
            <li key={e.id}>
              <EventCard event={e} index={i} />
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={Math.min(page, pageCount)}
        pageCount={pageCount}
        params={{ q: sp.q, category, mode, price, when: when === "past" ? "past" : undefined }}
      />
    </div>
  );
}
