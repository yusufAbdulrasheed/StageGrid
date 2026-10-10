import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await (await getDb()).execute(sql`select 1`);
    return NextResponse.json({ status: "ok", uptime: Math.round(process.uptime()) });
  } catch {
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
