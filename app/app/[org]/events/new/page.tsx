import type { Metadata } from "next";
import EventForm from "@/components/EventForm";
import PageHeader, { UpgradeNotice } from "@/components/app/PageHeader";
import { requireOrg } from "@/lib/auth";
import { activeEventCount, limitsFor } from "@/lib/orgs";
import { payoutsReady } from "@/lib/orders";

export const metadata: Metadata = { title: "New event" };

export default async function NewEventPage({ params }: { params: Promise<{ org: string }> }) {
  const { org: slug } = await params;
  const { org } = await requireOrg(slug, "events");
  const max = limitsFor(org).activeEvents;
  const live = await activeEventCount(org.id);
  const atLimit = max != null && live >= max;

  return (
    <>
      <PageHeader title="New event" description="Save as a draft while you work on it, or publish straight away." />
      {atLimit && (
        <div className="mb-8">
          <UpgradeNotice href={`/app/${slug}/billing`}>
            You have {live} of {max} live events. You can still save drafts; upgrade to publish more.
          </UpgradeNotice>
        </div>
      )}
      <EventForm orgSlug={slug} initial={{ timezone: "Africa/Lagos" }} payoutsReady={payoutsReady(org)} />
    </>
  );
}
