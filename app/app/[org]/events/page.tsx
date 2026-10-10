import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/app/PageHeader";
import { requireOrg } from "@/lib/auth";
import { listEvents, hasEnded } from "@/lib/events";
import { formatDay, formatTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Events" };

const FILTERS = [
  { id: "all", label: "All" },
  { id: "live", label: "Live" },
  { id: "draft", label: "Drafts" },
  { id: "past", label: "Past" },
] as const;

export default async function OrgEventsPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ f?: string; q?: string }>;
}) {
  const [{ org: slug }, sp] = await Promise.all([params, searchParams]);
  const { org } = await requireOrg(slug);
  const f = FILTERS.some((x) => x.id === sp.f) ? sp.f! : "all";

  const { items, total } = await listEvents({
    orgId: org.id,
    includeDrafts: true,
    q: sp.q,
    pageSize: 100,
    when: f === "live" ? "upcoming" : f === "past" ? "past" : "all",
    status: f === "live" ? "published" : f === "draft" ? "draft" : undefined,
  });

  return (
    <>
      <PageHeader
        title="Events"
        description={`${total} ${f === "all" ? "in this workspace" : f}`}
        actions={<Link href={`/app/${slug}/events/new`} className="btn btn-primary">New event</Link>}
      />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filter" className="flex gap-1 rounded-md border border-line p-0.5 text-sm">
          {FILTERS.map((x) => (
            <Link
              key={x.id}
              href={`/app/${slug}/events${x.id === "all" ? "" : `?f=${x.id}`}`}
              aria-current={f === x.id ? "page" : undefined}
              className={cn("rounded px-3.5 py-1.5 transition-colors", f === x.id ? "bg-surface-2 text-ink" : "text-muted hover:text-ink")}
            >
              {x.label}
            </Link>
          ))}
        </nav>
        <form className="w-full sm:w-64">
          {f !== "all" && <input type="hidden" name="f" value={f} />}
          <input type="search" name="q" defaultValue={sp.q} placeholder="Search events" aria-label="Search events" className="input h-9 text-sm" />
        </form>
      </div>

      {items.length === 0 ? (
        <div className="rounded-[var(--radius-card)] border border-dashed border-line-strong px-6 py-16 text-center">
          <p className="font-medium">No events here</p>
          <p className="mt-1 text-sm text-muted">{sp.q || f !== "all" ? "Try another filter." : "Create your first event to get started."}</p>
          <Link href={`/app/${slug}/events/new`} className="btn btn-primary mt-5">New event</Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-faint">
                <th className="px-5 py-3 font-normal">Event</th>
                <th className="px-3 py-3 font-normal">Date</th>
                <th className="px-3 py-3 font-normal">Status</th>
                <th className="px-5 py-3 text-right font-normal">Registered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((e) => {
                const ended = hasEnded(e);
                const pct = e.capacity ? Math.min(100, (e.booked / e.capacity) * 100) : null;
                return (
                  <tr key={e.id} className="group hover:bg-surface-2">
                    <td className="px-5 py-3.5">
                      <Link href={`/app/${slug}/events/${e.slug}`} className="font-medium group-hover:text-accent">{e.title}</Link>
                      <p className="text-xs text-muted">{e.location}</p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3.5 text-muted">
                      {formatDay(e.startsAt, e.timezone)}
                      <span className="block text-xs text-faint">{formatTime(e.startsAt, e.timezone, false)}</span>
                    </td>
                    <td className="px-3 py-3.5">
                      {e.status === "draft" ? <span className="chip">Draft</span> : ended ? <span className="chip">Ended</span> : <span className="chip border-ok/40 text-ok">Live</span>}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="font-mono text-xs tabular-nums">{e.booked}{e.capacity ? ` / ${e.capacity}` : ""}</span>
                      {pct != null && (
                        <div className="ml-auto mt-1.5 h-1 w-24 overflow-hidden rounded-full bg-line">
                          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
