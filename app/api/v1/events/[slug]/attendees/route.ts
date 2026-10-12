import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-keys";
import { getEventBySlug, listAttendees } from "@/lib/events";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const auth = await authenticateApiKey(req.headers.get("authorization"));
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error === "plan" ? "API access requires the Business plan" : "Invalid or missing API key" }, { status: auth.error === "plan" ? 402 : 401 });
  }
  if (!rateLimit(`api:${auth.keyId}`, 120, 60_000).ok) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });

  const { slug } = await ctx.params;
  const event = await getEventBySlug(slug);
  if (!event || event.orgId !== auth.org.id) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const items = (await listAttendees(event.id)).map(({ name, email, code, checkedInAt, createdAt }) => ({ name, email, code, checkedInAt, createdAt }));
  return NextResponse.json({ event: event.slug, total: items.length, items });
}
