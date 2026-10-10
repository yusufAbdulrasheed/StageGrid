import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-keys";
import { listEvents, publicEvent } from "@/lib/events";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await authenticateApiKey(req.headers.get("authorization"));
  if ("error" in auth) {
    const map = {
      missing: [401, "Provide an API key: Authorization: Bearer sg_live_…"],
      invalid: [401, "Invalid API key"],
      plan: [402, "API access requires the Business plan"],
    } as const;
    const [status, error] = map[auth.error];
    return NextResponse.json({ error }, { status });
  }

  const limit = rateLimit(`api:${auth.keyId}`, 120, 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  }

  const sp = new URL(req.url).searchParams;
  const status = sp.get("status");
  const data = await listEvents({
    orgId: auth.org.id,
    includeDrafts: true,
    status: status === "draft" || status === "published" ? status : undefined,
    when: "all",
    page: Math.max(1, Number(sp.get("page")) || 1),
    pageSize: Math.min(100, Math.max(1, Number(sp.get("pageSize")) || 25)),
  });
  return NextResponse.json({ ...data, items: data.items.map(publicEvent) });
}
