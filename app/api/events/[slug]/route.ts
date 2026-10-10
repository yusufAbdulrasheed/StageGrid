import { NextResponse } from "next/server";
import { getEventBySlug, publicEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const event = await getEventBySlug(slug);
  if (!event || event.status !== "published") return NextResponse.json({ error: "Event not found" }, { status: 404 });
  return NextResponse.json(publicEvent(event), {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" },
  });
}
