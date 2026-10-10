import type { Metadata } from "next";
import { notFound } from "next/navigation";
import EventForm from "@/components/EventForm";
import PageHeader from "@/components/app/PageHeader";
import { requireOrg } from "@/lib/auth";
import { getEventBySlug } from "@/lib/events";
import { utcToZonedParts } from "@/lib/datetime";
import { payoutsReady } from "@/lib/orders";

export const metadata: Metadata = { title: "Edit event" };

export default async function EditEventPage({ params }: { params: Promise<{ org: string; slug: string }> }) {
  const { org: orgSlug, slug } = await params;
  const { org } = await requireOrg(orgSlug, "events");
  const event = await getEventBySlug(slug);
  if (!event || event.orgId !== org.id) notFound();

  const start = utcToZonedParts(event.startsAt, event.timezone);
  const end = event.endsAt ? utcToZonedParts(event.endsAt, event.timezone) : null;

  return (
    <>
      <PageHeader title="Edit event" description={event.title} />
      <EventForm
        orgSlug={orgSlug}
        eventId={event.id}
        isLive={event.status === "published"}
        payoutsReady={payoutsReady(org)}
        initialTickets={event.tickets.map((t) => ({ name: t.name, price: t.price / 100, quantity: t.quantity }))}
        initial={{
          title: event.title,
          summary: event.summary,
          description: event.description,
          image: event.image,
          mode: event.mode,
          venue: event.venue,
          location: event.location,
          timezone: event.timezone,
          date: start.date,
          startTime: start.time,
          endTime: end?.time ?? "",
          category: event.category,
          tags: event.tags.join(", "),
          agenda: event.agenda.join("\n"),
          capacity: event.capacity?.toString() ?? "",
        }}
      />
    </>
  );
}
