import { NextResponse } from "next/server";
import { fulfillOrder } from "@/lib/orders";
import { siteUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const reference = sp.get("tx_ref") ?? sp.get("reference");
  if (!reference) return NextResponse.redirect(siteUrl("/events"));

  const res = await fulfillOrder(reference);
  const to =
    res.status === "paid"
      ? `/history?booked=${res.eventSlug}`
      : res.eventSlug
        ? `/events/${res.eventSlug}?payment=${res.status}`
        : "/events";
  return NextResponse.redirect(siteUrl(to));
}
