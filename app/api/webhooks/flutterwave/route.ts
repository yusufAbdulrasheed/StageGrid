import { NextResponse } from "next/server";
import { verifyFlutterwaveHash } from "@/lib/billing/flutterwave";
import { handleFlutterwaveEvent } from "@/lib/billing/webhook";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!verifyFlutterwaveHash(req.headers.get("verif-hash"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  try {
    await handleFlutterwaveEvent(await req.json());
  } catch (err) {
    console.error("[flutterwave webhook]", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
