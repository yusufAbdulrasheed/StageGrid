import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import FlashNotice from "@/components/FlashNotice";
import ConfirmDelete from "@/components/app/ConfirmDelete";
import PageHeader, { Stat, UpgradeNotice } from "@/components/app/PageHeader";
import { requireOrg } from "@/lib/auth";
import { eventRevenue, getEventBySlug, hasEnded, listAttendees, spotsLeft } from "@/lib/events";
import { limitsFor } from "@/lib/orgs";
import { formatDay, formatTime } from "@/lib/datetime";
import { formatMinor, formatNaira } from "@/lib/plans";
import { checkInAction, removeAttendeeAction } from "@/app/actions/bookings";
import { deleteEventAction, duplicateEventAction, setStatusAction } from "@/app/actions/events";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Manage event" };

export default async function ManageEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; slug: string }>;
  searchParams: Promise<{ q?: string; created?: string; updated?: string; saved?: string; limit?: string; payouts?: string; delete?: string }>;
}) {
  const [{ org: orgSlug, slug }, sp] = await Promise.all([params, searchParams]);
  const { org } = await requireOrg(orgSlug);
  const event = await getEventBySlug(slug);
  if (!event || event.orgId !== org.id) notFound();

  const [attendees, revenue] = await Promise.all([listAttendees(event.id, sp.q), eventRevenue(event.id)]);
  const limits = limitsFor(org);
  const ended = hasEnded(event);
  const checkedIn = attendees.filter((a) => a.checkedInAt).length;
  const left = spotsLeft(event);
  const draft = event.status === "draft";

  return (
    <>
      {sp.created && <FlashNotice kind="created" slug={event.slug} />}
      {sp.updated && <FlashNotice kind="updated" slug={event.slug} />}
      {sp.saved && <FlashNotice kind="saved" slug={event.slug} />}
      {sp.payouts && (
        <div className="mb-6">
          <UpgradeNotice href={`/app/${orgSlug}/settings#payouts`}>Add a payout account before publishing an event with paid tickets.</UpgradeNotice>
        </div>
      )}
      {sp.delete === "blocked" && (
        <p role="alert" className="mb-6 rounded-[var(--radius-card)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          This event has paid tickets, so it can&apos;t be deleted. Unpublish it to stop new sales; refunds are handled from your Paystack dashboard.
        </p>
      )}
      {sp.limit && (
        <div className="mb-6">
          <UpgradeNotice href={`/app/${orgSlug}/billing`}>You&apos;ve reached your plan&apos;s live event limit, so this event stays a draft.</UpgradeNotice>
        </div>
      )}

      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
        <Link href={`/app/${orgSlug}/events`} className="hover:text-ink">Events</Link>
        <span className="mx-2 text-faint">/</span>
        <span className="text-ink">{event.title}</span>
      </nav>

      <PageHeader
        title={event.title}
        description={`${formatDay(event.startsAt, event.timezone, "long")} · ${formatTime(event.startsAt, event.timezone)} · ${event.location}`}
        actions={
          <>
            <Link href={`/events/${event.slug}`} target="_blank" className="btn btn-ghost btn-sm">{draft ? "Preview" : "View page"} ↗</Link>
            <Link href={`/app/${orgSlug}/events/${event.slug}/edit`} className="btn btn-ghost btn-sm">Edit</Link>
            <form action={duplicateEventAction.bind(null, orgSlug, event.id)}>
              <button className="btn btn-ghost btn-sm" type="submit">Duplicate</button>
            </form>
            <form action={setStatusAction.bind(null, orgSlug, event.id, draft ? "published" : "draft")}>
              <button className={cn("btn btn-sm", draft ? "btn-primary" : "btn-ghost")} type="submit">{draft ? "Publish" : "Unpublish"}</button>
            </form>
            <ConfirmDelete action={deleteEventAction.bind(null, orgSlug, event.id)} title={event.title} />
          </>
        }
      />

      <div className="mb-3 flex items-center gap-2">
        {draft ? <span className="chip">Draft</span> : ended ? <span className="chip">Ended</span> : <span className="chip border-ok/40 text-ok">Live</span>}
        <span className="chip">{event.category}</span>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Registered" value={event.booked.toLocaleString("en-US")} hint={event.capacity ? `of ${event.capacity.toLocaleString("en-US")} seats` : "no cap"} />
        <Stat label="Checked in" value={`${checkedIn}`} hint={event.booked ? `${Math.round((checkedIn / event.booked) * 100)}% of registered` : "—"} />
        <Stat label="Gross sales" value={revenue ? formatNaira(revenue / 100) : "₦0"} hint="paid tickets" />
        <Stat label="Seats left" value={left == null ? "∞" : left.toLocaleString("en-US")} hint={limits.attendeesPerEvent ? `plan cap ${limits.attendeesPerEvent.toLocaleString("en-US")}` : undefined} />
      </div>

      <section className="mt-10" aria-labelledby="tiers">
        <h2 id="tiers" className="mb-3 text-[15px] font-medium">Tickets</h2>
        <ul className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
          {event.tickets.map((t) => (
            <li key={t.id} className="flex items-center gap-4 px-5 py-3.5 text-sm">
              <span className="min-w-0 flex-1 font-medium">{t.name}</span>
              <span className="font-mono text-xs text-muted tabular-nums">{t.sold}{t.quantity ? ` / ${t.quantity}` : " sold"}</span>
              <span className="w-24 text-right font-mono tabular-nums">{formatMinor(t.price)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="att">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="att" className="text-[15px] font-medium">Attendees</h2>
          <div className="flex flex-wrap items-center gap-2">
            <form className="w-56">
              <input type="search" name="q" defaultValue={sp.q} placeholder="Name, email or code" aria-label="Search attendees" className="input h-9 text-sm" />
            </form>
            {limits.csvExport ? (
              <a href={`/api/events/${event.slug}/attendees`} className="btn btn-ghost btn-sm" download>Export CSV</a>
            ) : (
              <Link href={`/app/${orgSlug}/billing`} className="btn btn-ghost btn-sm" title="CSV export is available on Pro">Export CSV · Pro</Link>
            )}
          </div>
        </div>

        {attendees.length === 0 ? (
          <p className="rounded-[var(--radius-card)] border border-dashed border-line-strong px-6 py-12 text-center text-sm text-muted">
            {sp.q ? "No attendees match that search." : draft ? "Publish the event to start taking registrations." : "No registrations yet. Share your event link to get started."}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-faint">
                  <th className="px-5 py-3 font-normal">Attendee</th>
                  <th className="px-3 py-3 font-normal">Ticket</th>
                  <th className="px-3 py-3 font-normal">Registered</th>
                  <th className="px-5 py-3 text-right font-normal">Check-in</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {attendees.map((a) => (
                  <tr key={a.id}>
                    <td className="px-5 py-3">
                      <p className="font-medium">{a.name}</p>
                      <p className="text-xs text-muted">{a.email}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span className="font-mono text-xs tracking-widest">{a.code}</span>
                      <span className="block text-xs text-muted">{a.ticketName ?? "Ticket"}{a.amountPaid > 0 ? ` · ${formatMinor(a.amountPaid)}` : ""}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-muted">{new Date(a.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <form action={checkInAction.bind(null, orgSlug, a.id)}>
                          <button
                            type="submit"
                            className={cn("btn btn-sm", a.checkedInAt ? "border-ok/40 text-ok" : "btn-ghost")}
                            aria-label={a.checkedInAt ? `Undo check-in for ${a.name}` : `Check in ${a.name}`}
                          >
                            {a.checkedInAt ? "✓ Checked in" : "Check in"}
                          </button>
                        </form>
                        {a.amountPaid === 0 && (
                          <form action={removeAttendeeAction.bind(null, orgSlug, a.id)}>
                            <button type="submit" className="px-1.5 text-faint hover:text-danger" aria-label={`Remove ${a.name}`} title="Remove registration">✕</button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
