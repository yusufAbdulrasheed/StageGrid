import { getCurrentUser } from "@/lib/auth";
import { getEventBySlug, listAttendees } from "@/lib/events";
import { getOrgContext, limitsFor } from "@/lib/orgs";
import { attendeesCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const event = await getEventBySlug(slug);
  if (!event) return new Response("Not found", { status: 404 });
  const membership = await getOrgContext(user.id, event.orgSlug);
  if (!membership) return new Response("Not found", { status: 404 });
  if (!limitsFor(membership.org).csvExport) return new Response("CSV export requires the Pro plan", { status: 402 });

  const csv = attendeesCsv(await listAttendees(event.id));
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.slug}-attendees.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
