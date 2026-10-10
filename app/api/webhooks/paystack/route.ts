import { NextResponse } from "next/server";
import { verifyPaystackSignature } from "@/lib/billing/paystack";
import { handlePaystackEvent } from "@/lib/billing/webhook";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Signature is computed over the exact raw body, so read text before parsing.
  const raw = await req.text();
  if (!verifyPaystackSignature(raw, req.headers.get("x-paystack-signature"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  try {
    await handlePaystackEvent(JSON.parse(raw));
  } catch (err) {
    console.error("[paystack webhook]", err);
    // 500 makes Paystack retry; handlers are idempotent.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
