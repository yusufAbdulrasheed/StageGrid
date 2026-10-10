import type { Metadata } from "next";
import Link from "next/link";
import PricingTable from "@/components/PricingTable";
import Faq from "@/components/Faq";
import { PLANS } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Start free and upgrade when your community grows. Simple plans for event organizers, billed in naira.",
  alternates: { canonical: "/pricing" },
};

const rows: { label: string; get: (id: "free" | "pro" | "business") => string }[] = [
  { label: "Live events", get: (id) => PLANS[id].limits.activeEvents?.toString() ?? "Unlimited" },
  { label: "Attendees per event", get: (id) => PLANS[id].limits.attendeesPerEvent!.toLocaleString("en-US") },
  { label: "Team members", get: (id) => String(PLANS[id].limits.members) },
  { label: "Free and paid tickets, multiple tiers", get: () => "✓" },
  { label: "Fee on paid tickets", get: (id) => `${PLANS[id].limits.ticketFeePercent}%` },
  { label: "Check-in and ticket codes", get: () => "✓" },
  { label: "Confirmation emails", get: () => "✓" },
  { label: "Sales and registration analytics", get: (id) => (PLANS[id].limits.analytics ? "✓" : "—") },
  { label: "Attendee CSV export", get: (id) => (PLANS[id].limits.csvExport ? "✓" : "—") },
  { label: "REST API", get: (id) => (PLANS[id].limits.apiAccess ? "✓" : "—") },
];

export default function PricingPage() {
  return (
    <div className="wrap pb-8 pt-20">
      <header className="mx-auto max-w-2xl text-center">
        <p className="eyebrow">Pricing</p>
        <h1 className="display mt-3 text-5xl text-balance sm:text-7xl">Plans that grow with your events.</h1>
        <p className="mt-5 text-muted">Every plan includes public event pages, free and paid tickets, and check-in. Prices in Nigerian naira.</p>
      </header>

      <div className="mt-16">
        <PricingTable mode="marketing" />
      </div>

      <section className="mt-28" aria-labelledby="compare">
        <h2 id="compare" className="display text-3xl sm:text-4xl">Compare plans</h2>
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line-strong">
                <th className="py-3 pr-4 font-normal text-faint" />
                {(["free", "pro", "business"] as const).map((id) => (
                  <th key={id} className="px-4 py-3 font-medium">{PLANS[id].name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b border-line">
                  <td className="py-3.5 pr-4 text-muted">{r.label}</td>
                  {(["free", "pro", "business"] as const).map((id) => (
                    <td key={id} className="px-4 py-3.5 tabular-nums">{r.get(id)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-28" id="faq" aria-labelledby="faq-h">
        <h2 id="faq-h" className="display text-3xl sm:text-4xl">Frequently asked</h2>
        <div className="mt-8 max-w-3xl">
          <Faq />
        </div>
        <p className="mt-10 text-sm text-muted">
          Still deciding? <Link href="/signup" className="text-ink underline underline-offset-4 hover:text-accent">Start on the free plan</Link>; you can upgrade from inside the app at any time.
        </p>
      </section>
    </div>
  );
}
