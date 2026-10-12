import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth";
import { getBillingProvider } from "@/lib/billing";
import { getDb } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { getEventById } from "@/lib/events";
import { confirmMockTicketAction } from "@/app/actions/bookings";
import { formatMinor } from "@/lib/plans";

export const metadata = { title: "Test checkout", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function MockTicketCheckout({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams;
  if (getBillingProvider()?.id !== "mock" || !ref) notFound();
  const user = await requireUser(`/checkout/mock?ref=${ref}`);

  const db = await getDb();
  const [order] = await db.select().from(orders).where(eq(orders.reference, ref)).limit(1);
  if (!order || order.userId !== user.id) notFound();
  const event = await getEventById(order.eventId);
  const tier = event?.tickets.find((t) => t.id === order.ticketTypeId);
  if (!event) notFound();

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-5 py-16">
      <p className="eyebrow text-accent">Test mode · no real payment</p>
      <h1 className="display mt-3 text-5xl">Confirm payment.</h1>
      <dl className="mt-8 divide-y divide-line border-y border-line text-sm">
        <div className="flex justify-between gap-6 py-3"><dt className="text-muted">Event</dt><dd className="text-right">{event.title}</dd></div>
        <div className="flex justify-between py-3"><dt className="text-muted">Ticket</dt><dd>{tier?.name ?? "Ticket"}</dd></div>
        <div className="flex justify-between py-3"><dt className="text-muted">Amount</dt><dd className="tabular-nums">{formatMinor(order.amount)}</dd></div>
        <div className="flex justify-between py-3"><dt className="text-muted">Platform fee</dt><dd className="tabular-nums">{formatMinor(order.platformFee)}</dd></div>
      </dl>
      <p className="mt-5 text-xs text-faint">
        Add <code className="font-mono">FLUTTERWAVE_SECRET_KEY</code> to switch this screen for Flutterwave&apos;s real checkout.
      </p>
      <form action={confirmMockTicketAction.bind(null, ref)} className="mt-8">
        <button type="submit" className="btn btn-primary btn-lg w-full">Simulate successful payment</button>
      </form>
    </div>
  );
}
