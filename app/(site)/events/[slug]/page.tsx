import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BookingPanel from "@/components/BookingPanel";
import EventCard, { AvailabilityBadge, priceLabel } from "@/components/EventCard";
import EventImage from "@/components/EventImage";
import ShareButton from "@/components/ShareButton";
import { getCurrentUser } from "@/lib/auth";
import { findBooking, getEventBySlug, getRelatedEvents, hasEnded } from "@/lib/events";
import { getOrgContext } from "@/lib/orgs";
import { formatDay, formatTime, relativeUntil } from "@/lib/datetime";
import { MODE_LABEL, POSTER_PREFIX, categoryImage } from "@/lib/constants";
import { siteUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ payment?: string }>;
};

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { slug } = await params;
  const e = await getEventBySlug(slug);
  if (!e || e.status !== "published") return { title: "Event not found", robots: { index: false } };
  return {
    title: e.title,
    description: e.summary,
    alternates: { canonical: `/events/${e.slug}` },
    openGraph: { title: e.title, description: e.summary, type: "article", url: siteUrl(`/events/${e.slug}`) },
    twitter: { title: e.title, description: e.summary },
  };
}

const PAYMENT_NOTICE: Record<string, string> = {
  failed: "We couldn't confirm your payment. If you were charged, it will be reversed or applied automatically within a few minutes.",
  refunded: "That ticket sold out while you were paying, so your payment was refunded.",
  processing: "Your payment is still being confirmed. Check My bookings in a minute.",
};

export default async function EventPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const user = await getCurrentUser();
  const membership = user ? await getOrgContext(user.id, event.orgSlug) : null;
  // Drafts are only visible to the organization's own team.
  if (event.status === "draft" && !membership) notFound();

  const ended = hasEnded(event);
  const booking = user ? await findBooking(event.id, user.id, user.email) : null;
  const held = booking
    ? { code: booking.code, ticketName: event.tickets.find((t) => t.id === booking.ticketTypeId)?.name ?? null, paid: booking.amountPaid > 0 }
    : null;
  const related = await getRelatedEvents(event);
  const paragraphs = event.description.split(/\n{2,}/);
  const cover = event.image.startsWith(POSTER_PREFIX) ? categoryImage(event.category) : event.image;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    description: event.summary,
    startDate: event.startsAt,
    ...(event.endsAt && { endDate: event.endsAt }),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode:
      event.mode === "online"
        ? "https://schema.org/OnlineEventAttendanceMode"
        : event.mode === "hybrid"
          ? "https://schema.org/MixedEventAttendanceMode"
          : "https://schema.org/OfflineEventAttendanceMode",
    location:
      event.mode === "online"
        ? { "@type": "VirtualLocation", url: siteUrl(`/events/${event.slug}`) }
        : { "@type": "Place", name: event.venue || event.location, address: event.location },
    image: cover.startsWith("http") ? cover : siteUrl(cover),
    organizer: { "@type": "Organization", name: event.orgName, url: siteUrl(`/o/${event.orgSlug}`) },
    offers: event.tickets.map((t) => ({
      "@type": "Offer",
      name: t.name,
      price: t.price / 100,
      priceCurrency: "NGN",
      url: siteUrl(`/events/${event.slug}`),
      availability: "https://schema.org/InStock",
    })),
  };

  return (
    <>
      {event.status === "draft" && (
        <div className="border-b border-accent/30 bg-accent/10 py-2.5 text-center text-sm">
          Draft preview. Only your team can see this page until you publish.
        </div>
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <article className="wrap pb-8 pt-10">
        <nav aria-label="Breadcrumb" className="mb-8 text-sm text-muted">
          <Link href="/events" className="hover:text-ink">Events</Link>
          <span className="mx-2 text-faint">/</span>
          <Link href={`/events?category=${encodeURIComponent(event.category)}`} className="hover:text-ink">{event.category}</Link>
        </nav>

        <header className="max-w-4xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip">{event.category}</span>
            <span className="chip">{MODE_LABEL[event.mode]}</span>
            <span className={`chip ${event.maxPrice === 0 ? "text-ok" : ""}`}>{priceLabel(event)}</span>
            {!ended && <span className="chip text-accent">{relativeUntil(event.startsAt)}</span>}
            <AvailabilityBadge event={event} />
          </div>
          <h1 className="display mt-5 text-[clamp(2.5rem,6vw,4.75rem)] text-balance">{event.title}</h1>
          <p className="mt-5 max-w-2xl text-lg text-muted text-pretty">{event.summary}</p>
          <div className="mt-7 flex flex-wrap gap-2">
            <ShareButton title={event.title} slug={event.slug} />
            {membership && (
              <Link href={`/app/${event.orgSlug}/events/${event.slug}`} className="btn btn-ghost">Manage event</Link>
            )}
          </div>
        </header>

        <div className="relative mt-10 aspect-[21/9] overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface max-sm:aspect-[4/3]">
          <EventImage src={event.image} alt="" priority sizes="(min-width: 1180px) 1116px, 100vw" />
        </div>

        <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_380px]">
          <div className="min-w-0 space-y-14">
            <dl className="grid gap-x-8 gap-y-6 border-y border-line py-6 sm:grid-cols-3">
              <div>
                <dt className="eyebrow">Date</dt>
                <dd className="mt-1.5">{formatDay(event.startsAt, event.timezone, "long")}</dd>
              </div>
              <div>
                <dt className="eyebrow">Time</dt>
                <dd className="mt-1.5">
                  {formatTime(event.startsAt, event.timezone, !event.endsAt)}
                  {event.endsAt && <> – {formatTime(event.endsAt, event.timezone)}</>}
                </dd>
              </div>
              <div>
                <dt className="eyebrow">Location</dt>
                <dd className="mt-1.5">
                  {event.venue && <>{event.venue}<br /></>}
                  <span className="text-muted">{event.location}</span>
                </dd>
              </div>
            </dl>

            <section aria-labelledby="about">
              <h2 id="about" className="display text-3xl sm:text-4xl">About</h2>
              <div className="prose-plain mt-5 max-w-2xl space-y-4 text-[17px] leading-relaxed text-ink/90">
                {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
              </div>
            </section>

            {event.agenda.length > 0 && (
              <section aria-labelledby="agenda">
                <h2 id="agenda" className="display text-3xl sm:text-4xl">Programme</h2>
                <ol className="mt-5 max-w-2xl divide-y divide-line border-y border-line">
                  {event.agenda.map((item, i) => {
                    const [time, ...rest] = item.split(/\s+[—–-]\s+/);
                    const hasTime = rest.length > 0 && time.length <= 14;
                    return (
                      <li key={i} className="flex gap-6 py-3.5">
                        <span className="w-28 shrink-0 font-mono text-[13px] text-faint">{hasTime ? time : String(i + 1).padStart(2, "0")}</span>
                        <span>{hasTime ? rest.join(" — ") : item}</span>
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}

            <section aria-labelledby="host" className="flex flex-wrap items-center justify-between gap-6">
              <div>
                <p className="eyebrow">Hosted by</p>
                <p id="host" className="mt-1.5 text-lg">
                  <Link href={`/o/${event.orgSlug}`} className="hover:text-accent">{event.orgName}</Link>
                </p>
              </div>
              {event.tags.length > 0 && (
                <ul className="flex flex-wrap gap-2" aria-label="Tags">
                  {event.tags.map((t) => (
                    <li key={t}>
                      <Link href={`/events?q=${encodeURIComponent(t)}`} className="chip hover:border-faint hover:text-ink">{t}</Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <BookingPanel
              eventId={event.id}
              slug={event.slug}
              tickets={event.tickets}
              capacity={event.capacity}
              booked={event.booked}
              ended={ended}
              user={user ? { name: user.name, email: user.email } : null}
              held={held}
              notice={sp.payment ? PAYMENT_NOTICE[sp.payment] : undefined}
            />
          </aside>
        </div>
      </article>

      {related.length > 0 && (
        <section className="wrap pt-20" aria-labelledby="more">
          <h2 id="more" className="display text-3xl sm:text-4xl">You might also like</h2>
          <ul className="mt-8 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((e, i) => (
              <li key={e.id}><EventCard event={e} index={i} /></li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
