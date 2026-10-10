import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import EventCard from "@/components/EventCard";
import { getOrgBySlug } from "@/lib/orgs";
import { listEvents } from "@/lib/events";
import { pluralize } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const org = await getOrgBySlug(slug);
  if (!org) return { title: "Not found" };
  return {
    title: org.name,
    description: org.description || `Upcoming events from ${org.name} on StageGrid.`,
    alternates: { canonical: `/o/${org.slug}` },
  };
}

export default async function OrgPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const org = await getOrgBySlug(slug);
  if (!org) notFound();

  const [upcoming, past] = await Promise.all([
    listEvents({ orgId: org.id, when: "upcoming", pageSize: 24 }),
    listEvents({ orgId: org.id, when: "past", pageSize: 6 }),
  ]);

  return (
    <div className="wrap pb-8 pt-16">
      <header className="flex flex-wrap items-center gap-6 border-b border-line pb-12">
        {org.logoUrl ? (
          <Image src={org.logoUrl} alt="" width={72} height={72} unoptimized className="size-[72px] rounded-lg border border-line object-cover" />
        ) : (
          <span className="grid size-[72px] place-items-center rounded-lg bg-surface-2 text-3xl font-semibold text-accent">{org.name[0]}</span>
        )}
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Organizer</p>
          <h1 className="display mt-1 text-5xl sm:text-6xl">{org.name}</h1>
          {org.description && <p className="mt-3 max-w-xl text-muted">{org.description}</p>}
        </div>
        {org.website && (
          <a href={org.website} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">Website ↗</a>
        )}
      </header>

      <section className="pt-12" aria-labelledby="up">
        <h2 id="up" className="eyebrow mb-8">Upcoming · {pluralize(upcoming.total, "event")}</h2>
        {upcoming.items.length === 0 ? (
          <p className="text-muted">Nothing scheduled right now. <Link href="/events" className="underline underline-offset-4 hover:text-ink">Explore other events</Link>.</p>
        ) : (
          <ul className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.items.map((e, i) => (
              <li key={e.id}><EventCard event={e} index={i} /></li>
            ))}
          </ul>
        )}
      </section>

      {past.items.length > 0 && (
        <section className="pt-20" aria-labelledby="past">
          <h2 id="past" className="eyebrow mb-8">Past events</h2>
          <ul className="grid gap-x-8 gap-y-12 opacity-75 sm:grid-cols-2 lg:grid-cols-3">
            {past.items.map((e, i) => (
              <li key={e.id}><EventCard event={e} index={i} /></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
