import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/app/PageHeader";
import { requireOrg } from "@/lib/auth";
import { listOrgAttendees } from "@/lib/events";
import { checkInAction } from "@/app/actions/bookings";
import { cn, pluralize } from "@/lib/utils";

export const metadata: Metadata = { title: "Attendees" };

export default async function AttendeesPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const [{ org: slug }, sp] = await Promise.all([params, searchParams]);
  const { org } = await requireOrg(slug);
  const page = Math.max(1, Number(sp.page) || 1);
  const { items, total, pageCount } = await listOrgAttendees(org.id, { q: sp.q, page });

  const href = (p: number) => `/app/${slug}/attendees?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), page: String(p) })}`;

  return (
    <>
      <PageHeader title="Attendees" description={`${pluralize(total, "registration")} across all events.`} />

      <form className="mb-5 max-w-sm">
        <input type="search" name="q" defaultValue={sp.q} placeholder="Search name, email, code or event" aria-label="Search attendees" className="input h-9 text-sm" />
      </form>

      {items.length === 0 ? (
        <p className="rounded-[var(--radius-card)] border border-dashed border-line-strong px-6 py-16 text-center text-sm text-muted">
          {sp.q ? "No one matches that search." : "Registrations will appear here once people start booking."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-faint">
                <th className="px-5 py-3 font-normal">Attendee</th>
                <th className="px-3 py-3 font-normal">Event</th>
                <th className="px-3 py-3 font-normal">Ticket</th>
                <th className="px-5 py-3 text-right font-normal">Check-in</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((a) => (
                <tr key={a.id}>
                  <td className="px-5 py-3">
                    <p className="font-medium">{a.name}</p>
                    <p className="text-xs text-muted">{a.email}</p>
                  </td>
                  <td className="px-3 py-3">
                    <Link href={`/app/${slug}/events/${a.eventSlug}`} className="hover:text-accent">{a.eventTitle}</Link>
                  </td>
                  <td className="px-3 py-3"><span className="font-mono text-xs tracking-widest">{a.code}</span><span className="block text-xs text-muted">{a.ticketName ?? "Ticket"}</span></td>
                  <td className="px-5 py-3 text-right">
                    <form action={checkInAction.bind(null, slug, a.id)}>
                      <button type="submit" className={cn("btn btn-sm", a.checkedInAt ? "border-ok/40 text-ok" : "btn-ghost")}>
                        {a.checkedInAt ? "✓ Checked in" : "Check in"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 && (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-between text-sm">
          <Link href={href(page - 1)} aria-disabled={page <= 1} className={cn("btn btn-ghost btn-sm", page <= 1 && "pointer-events-none opacity-40")}>← Previous</Link>
          <span className="font-mono text-xs text-faint">Page {page} of {pageCount}</span>
          <Link href={href(page + 1)} aria-disabled={page >= pageCount} className={cn("btn btn-ghost btn-sm", page >= pageCount && "pointer-events-none opacity-40")}>Next →</Link>
        </nav>
      )}
    </>
  );
}
