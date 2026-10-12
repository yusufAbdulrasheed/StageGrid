import Link from "next/link";
import { redirect } from "next/navigation";
import EventCard from "@/components/EventCard";
import HeroMosaic from "@/components/HeroMosaic";
import EventImage from "@/components/EventImage";
import PricingTable from "@/components/PricingTable";
import Faq from "@/components/Faq";
import { categoryCounts, getStats, listEvents } from "@/lib/events";
import { getCurrentUser } from "@/lib/auth";
import { listUserOrgs } from "@/lib/orgs";
import { CATEGORIES, categoryImage } from "@/lib/constants";

export const dynamic = "force-dynamic";

const features = [
  {
    n: "01",
    title: "Tickets that fit the night",
    body: "Sell Regular, VIP and Table tickets side by side, each with its own price and allocation. Free events work the same way, no payment step.",
  },
  {
    n: "02",
    title: "Paid straight to you",
    body: "Add your bank account once. Every ticket sale settles to it through Flutterwave, and the platform fee is shown up front. No spreadsheets, no chasing transfers.",
  },
  {
    n: "03",
    title: "A guest list that works at the door",
    body: "Every ticket has a code. Search by name or code and tap to check people in, from as many phones as your team has.",
  },
  {
    n: "04",
    title: "Know what's selling",
    body: "Daily sales, fill rate and check-ins across every event, plus email confirmations and reminders sent for you.",
  },
];

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user && (await listUserOrgs(user.id)).length === 0) redirect("/events");

  const [{ items }, stats, cats] = await Promise.all([listEvents({ pageSize: 8 }), getStats(), categoryCounts()]);
  const counts = new Map(cats.map((c) => [c.category, c.count]));

  return (
    <>
      <style>{":root{--wrap-max:none;--wrap-pad:clamp(1rem,3.5vw,3.5rem)}"}</style>
      <section className="relative overflow-hidden border-b border-line">
        <div className="hairline-grid pointer-events-none absolute inset-0" aria-hidden />
        <div className="wrap relative grid items-center gap-14 pb-16 pt-14 sm:pt-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16 lg:pb-24">
          <div>
            <p className="eyebrow animate-rise flex items-center gap-3">
              <span className="inline-block h-px w-8 bg-accent" aria-hidden />
              Tickets for the nights worth having
            </p>
            <h1 className="display animate-rise mt-6 text-[clamp(2.9rem,5.6vw,5.9rem)] text-balance" style={{ animationDelay: "60ms" }}>
              Find your next night out. Or <em className="text-accent">sell out</em> your own.
            </h1>
            <p className="animate-rise mt-7 max-w-lg text-lg text-muted text-pretty" style={{ animationDelay: "120ms" }}>
              Concerts, pool parties, festivals and workshops, all in one place. Book a seat in a minute, or publish your
              own and get paid straight to your bank.
            </p>

            <form action="/events" className="animate-rise mt-9 flex max-w-lg flex-col gap-3 sm:flex-row" style={{ animationDelay: "180ms" }}>
              <input name="q" type="search" aria-label="Search events" placeholder="Search a city, artist or event" className="input h-12 w-full bg-bg sm:flex-1" />
              <button className="btn btn-primary h-12 px-6" type="submit">Find events</button>
            </form>
            <p className="animate-rise mt-4 text-sm text-muted" style={{ animationDelay: "220ms" }}>
              Organizing something?{" "}
              <Link href="/signup?type=organizer" className="text-ink underline underline-offset-4 hover:text-accent">Host an event free</Link>
            </p>

            <dl className="animate-rise mt-12 grid max-w-lg grid-cols-3 gap-6 border-t border-line pt-6" style={{ animationDelay: "260ms" }}>
              {[
                [stats.upcoming, "events on now"],
                [stats.locations, "places"],
                [stats.bookings, "seats booked"],
              ].map(([n, label]) => (
                <div key={label as string}>
                  <dd className="text-4xl font-semibold tabular-nums leading-none tracking-tight sm:text-5xl">{(n as number).toLocaleString("en-US")}</dd>
                  <dt className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-faint">{label}</dt>
                </div>
              ))}
            </dl>
          </div>

          <HeroMosaic events={items.slice(0, 3)} />
        </div>
      </section>

      <section className="wrap pt-24" aria-labelledby="kinds">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <h2 id="kinds" className="display text-4xl sm:text-5xl">Whatever the occasion.</h2>
          <Link href="/events" className="text-sm text-muted hover:text-ink">All events →</Link>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {CATEGORIES.map((c) => (
            <li key={c}>
              <Link
                href={`/events?category=${encodeURIComponent(c)}`}
                className="group relative block aspect-[4/3] overflow-hidden rounded-[var(--radius-card)] border border-line transition-transform duration-300 hover:-translate-y-0.5"
              >
                <EventImage src={categoryImage(c)} alt="" className="object-cover transition-transform duration-700 group-hover:scale-[1.05]" sizes="(min-width: 1024px) 220px, 33vw" />
                <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" aria-hidden />
                <span className="absolute right-2.5 top-2.5 rounded bg-bg/80 px-2 py-0.5 font-mono text-[10px] text-muted backdrop-blur">
                  {counts.get(c) ?? 0}
                </span>
                <span className="display absolute bottom-2 left-3 right-3 text-2xl leading-none text-white">{c}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="wrap pt-24" aria-labelledby="live">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Coming up</p>
            <h2 id="live" className="display mt-3 text-4xl sm:text-5xl">
              {stats.upcoming} events, {stats.bookings.toLocaleString("en-US")} seats booked.
            </h2>
          </div>
          <Link href="/events" className="text-sm text-muted hover:text-ink">Explore everything →</Link>
        </div>
        <ul className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {items.map((e, i) => (
            <li key={e.id} className={i >= 6 ? "hidden 2xl:block" : undefined}><EventCard event={e} index={i} /></li>
          ))}
        </ul>
      </section>

      <section className="wrap pt-28" aria-labelledby="how">
        <p className="eyebrow">For organizers</p>
        <h2 id="how" className="display mt-3 max-w-2xl text-4xl text-balance sm:text-6xl">
          Everything between &ldquo;let&apos;s throw something&rdquo; and the last guest leaving.
        </h2>
        <dl className="mt-14 grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line sm:grid-cols-2">
          {features.map((f) => (
            <div key={f.n} className="bg-bg p-8 sm:p-10">
              <dt className="flex items-baseline gap-4">
                <span className="font-mono text-xs text-accent">{f.n}</span>
                <span className="text-xl font-medium tracking-tight">{f.title}</span>
              </dt>
              <dd className="mt-4 max-w-md text-muted">{f.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="wrap pt-28" aria-labelledby="pricing">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="eyebrow">Pricing</p>
          <h2 id="pricing" className="display mt-3 text-4xl sm:text-6xl">Start free. Pay when you grow.</h2>
          <p className="mt-4 text-muted">Simple plans in naira. A small fee on paid tickets only, lower on higher plans.</p>
        </div>
        <PricingTable mode="marketing" />
      </section>

      <section className="wrap pt-28" id="faq" aria-labelledby="faq-h">
        <h2 id="faq-h" className="display text-4xl sm:text-5xl">Questions, answered.</h2>
        <div className="mt-10 max-w-3xl"><Faq /></div>
      </section>

      <section className="wrap pt-28">
        <div className="grid items-center gap-8 rounded-[var(--radius-card)] border border-line bg-surface p-8 sm:p-14 md:grid-cols-[1.5fr_1fr]">
          <h2 className="display text-4xl text-balance sm:text-6xl">Your next event deserves a full house.</h2>
          <div className="flex flex-wrap gap-3 md:justify-self-end">
            <Link href={user ? "/app" : "/signup?type=organizer"} className="btn btn-primary btn-lg">{user ? "Open dashboard" : "Host an event"}</Link>
            <Link href="/events" className="btn btn-ghost btn-lg">Browse events</Link>
          </div>
        </div>
      </section>
    </>
  );
}
