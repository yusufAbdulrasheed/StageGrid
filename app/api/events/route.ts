import { NextResponse } from "next/server";
import { listEvents, publicEvent } from "@/lib/events";
import { CATEGORIES, MODES } from "@/lib/constants";

export const dynamic = "force-dynamic";

/** Public discovery feed. Authenticated, org-scoped access lives under /api/v1. */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const category = sp.get("category") ?? undefined;
  const mode = sp.get("mode") ?? undefined;
  const when = sp.get("when");
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(sp.get("pageSize")) || 12));

  const data = await listEvents({
    q: sp.get("q") ?? undefined,
    category: CATEGORIES.includes(category as never) ? category : undefined,
    mode: MODES.includes(mode as never) ? mode : undefined,
    when: when === "past" || when === "all" ? when : "upcoming",
    page,
    pageSize,
  });

  return NextResponse.json(
    { ...data, items: data.items.map(publicEvent) },
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } },
  );
}
