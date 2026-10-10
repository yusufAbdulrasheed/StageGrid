import type { Metadata } from "next";
import Link from "next/link";
import BarChart from "@/components/app/BarChart";
import PageHeader, { Stat, UpgradeNotice } from "@/components/app/PageHeader";
import { requireOrg } from "@/lib/auth";
import { listEvents, orgTotals, registrationsByDay, topEvents } from "@/lib/events";
import { limitsFor } from "@/lib/orgs";
import { formatDay, formatTime } from "@/lib/datetime";
import { can, formatNaira } from "@/lib/plans";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ welcome?: string; denied?: string }>;
}) {
  const [{ org: slug }, sp] = await Promise.all([params, searchParams]);
  const { org, role } = await requireOrg(slug);
  const limits = limitsFor(org);

  const [totals, upcoming, series, top] = await Promise.all([
    orgTotals(org.id),
    listEvents({ orgId: org.id, includeDrafts: true, when: "upcoming", pageSize: 5 }),
    limits.analytics ? registrationsByDay(org.id, 30) : Promise.resolve(null),
    limits.analytics ? topEvents(org.id, 5) : Promise.resolve(null),
  ]);

  const checkInRate = totals.registrations ? Math.round((totals.checkedIn / totals.registrations) * 100) : 0;
  const last30 = series?.reduce((s, d) => s + d.n, 0);

  return (
    <>
      <PageHeader
        title={org.name}
        description="How your events and ticket sales are doing."
        actions={
          <Link href={`/app/${slug}/events/new`} className="btn btn-primary">
            New event
          </Link>
        }
      />

      {sp.denied && (
        <p role="alert" className="mb-6 rounded-[var(--radius-card)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          Your role doesn&apos;t have access to that page. Ask the workspace owner.
        </p>
      )}

      {totals.events === 0 && (
        <section className="mb-8 rounded-[var(--radius-card)] border border-line bg-surface p-6" aria-labelledby="start">
          <h2 id="start" className="text-lg font-semibold tracking-tight">{sp.welcome ? "Your workspace is ready." : "Get started"}</h2>
          <ol className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
            {[
              { n: "1", t: "Create your first event", d: "Add a date, place and cover. Save as a draft or publish.", href: `/app/${slug}/events/new`, a: "Create event" },
              can(role, "settings") && { n: "2", t: "Set up your public page", d: "Add a description and logo for /o/" + slug + ".", href: `/app/${slug}/settings`, a: "Open settings" },
              can(role, "team") && { n: "3", t: "Invite your team", d: "Bring co-organizers in to share the work.", href: `/app/${slug}/team`, a: "Invite people" },
            ]
              .filter(Boolean)
              .map((s) => {
                const step = s as { n: string; t: string; d: string; href: string; a: string };
                return (
                  <li key={step.n} className="rounded border border-line bg-bg p-4">
                    <p className="font-mono text-xs text-accent">0{step.n}</p>
                    <p className="mt-2 font-medium">{step.t}</p>
                    <p className="mt-1 text-muted">{step.d}</p>
                    <Link href={step.href} className="mt-3 inline-block text-accent hover:underline">{step.a} →</Link>
                  </li>
                );
              })}
          </ol>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Registrations" value={totals.registrations.toLocaleString("en-US")} hint={last30 != null ? `${last30} in the last 30 days` : "all time"} />
        <Stat label="Live events" value={String(totals.upcoming)} hint={`${totals.drafts} draft${totals.drafts === 1 ? "" : "s"}`} />
        <Stat label="Gross sales" value={formatNaira(totals.revenue / 100)} hint="paid tickets, all time" />
        <Stat label="Check-in rate" value={`${checkInRate}%`} hint={`${totals.checkedIn.toLocaleString("en-US")} checked in`} />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6" aria-labelledby="reg">
          <h2 id="reg" className="text-[15px] font-medium">Registrations, last 30 days</h2>
          {series ? (
            <div className="mt-6"><BarChart data={series} /></div>
          ) : (
            <div className="mt-6">
              <UpgradeNotice href={`/app/${slug}/billing`}>Daily registration trends and top events are part of Pro.</UpgradeNotice>
            </div>
          )}
        </section>

        <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6" aria-labelledby="top">
          <h2 id="top" className="text-[15px] font-medium">Top events</h2>
          {top ? (
            top.length === 0 ? (
              <p className="mt-4 text-sm text-muted">No registrations yet.</p>
            ) : (
              <ol className="mt-5 space-y-4">
                {top.map((e) => (
                  <li key={e.slug}>
                    <Link href={`/app/${slug}/events/${e.slug}`} className="flex items-baseline justify-between gap-3 text-sm hover:text-accent">
                      <span className="truncate">{e.title}</span>
                      <span className="shrink-0 font-mono text-xs text-muted tabular-nums">{e.booked}{e.capacity ? ` / ${e.capacity}` : ""}</span>
                    </Link>
                    {e.capacity && (
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (e.booked / e.capacity) * 100)}%` }} />
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )
          ) : (
            <p className="mt-4 text-sm text-muted">Available on Pro and above.</p>
          )}
        </section>
      </div>

      <section className="mt-8" aria-labelledby="next">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="next" className="text-[15px] font-medium">Coming up</h2>
          <Link href={`/app/${slug}/events`} className="text-sm text-muted hover:text-ink">All events →</Link>
        </div>
        {upcoming.items.length === 0 ? (
          <p className="rounded-[var(--radius-card)] border border-dashed border-line-strong px-6 py-10 text-center text-sm text-muted">
            Nothing scheduled. <Link href={`/app/${slug}/events/new`} className="text-accent hover:underline">Create an event</Link>.
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
            {upcoming.items.map((e) => (
              <li key={e.id}>
                <Link href={`/app/${slug}/events/${e.slug}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{e.title}</p>
                    <p className="text-xs text-muted">{formatDay(e.startsAt, e.timezone)} · {formatTime(e.startsAt, e.timezone)}</p>
                  </div>
                  {e.status === "draft" && <span className="chip">Draft</span>}
                  <span className="font-mono text-xs text-muted tabular-nums">{e.booked}{e.capacity ? ` / ${e.capacity}` : ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
