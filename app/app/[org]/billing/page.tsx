import type { Metadata } from "next";
import PageHeader from "@/components/app/PageHeader";
import PricingTable from "@/components/PricingTable";
import ConfirmDelete from "@/components/app/ConfirmDelete";
import { requireOrg } from "@/lib/auth";
import { getBillingProvider, listPayments } from "@/lib/billing";
import { activeEventCount, effectivePlan, limitsFor, memberSeatsUsed } from "@/lib/orgs";
import { cancelSubscriptionAction } from "@/app/actions/billing";
import { PLANS, formatNaira } from "@/lib/plans";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Billing" };

const MESSAGES: Record<string, { tone: "ok" | "err"; text: string }> = {
  upgraded: { tone: "ok", text: "Payment received. Your plan has been upgraded." },
  canceled: { tone: "ok", text: "Subscription canceled. You keep your plan until the end of the paid period." },
  not_configured: { tone: "err", text: "Billing isn't configured on this deployment yet." },
  checkout: { tone: "err", text: "We couldn't start checkout. Please try again." },
  verify: { tone: "err", text: "We couldn't confirm that payment. If you were charged, it will be applied automatically within a few minutes." },
  cancel: { tone: "err", text: "We couldn't cancel the subscription. Please try again or contact support." },
};

export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ org: slug }, sp] = await Promise.all([params, searchParams]);
  const { org } = await requireOrg(slug, "billing");
  const [payments, live, seats] = await Promise.all([listPayments(org.id), activeEventCount(org.id), memberSeatsUsed(org.id)]);

  const effective = effectivePlan(org);
  const plan = PLANS[effective];
  const limits = limitsFor(org);
  const provider = getBillingProvider();
  const msg = MESSAGES[sp.upgraded ? "upgraded" : sp.canceled ? "canceled" : (sp.error ?? "")];
  const lapsed = org.plan !== "free" && effective === "free";

  const meters = [
    { label: "Live events", used: live, max: limits.activeEvents },
    { label: "Team seats", used: seats, max: limits.members },
  ];

  return (
    <>
      <PageHeader title="Billing" description="Your plan, usage and payment history." />

      {msg && (
        <p role={msg.tone === "err" ? "alert" : "status"} className={cn("mb-6 rounded-[var(--radius-card)] border px-4 py-3 text-sm", msg.tone === "ok" ? "border-ok/30 bg-ok/10" : "border-danger/40 bg-danger/10 text-danger")}>
          {msg.text}
        </p>
      )}
      {lapsed && (
        <p role="alert" className="mb-6 rounded-[var(--radius-card)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          Your {PLANS[org.plan].name} subscription has lapsed, so this workspace is on Starter limits. Renew below to restore access.
        </p>
      )}
      {org.planStatus === "past_due" && !lapsed && (
        <p role="alert" className="mb-6 rounded-[var(--radius-card)] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          Your last payment failed. Update your payment method to avoid losing {PLANS[org.plan].name} features.
        </p>
      )}

      <section className="grid gap-6 rounded-[var(--radius-card)] border border-line bg-surface p-6 lg:grid-cols-[1.2fr_1fr]" aria-labelledby="current">
        <div>
          <p className="eyebrow">Current plan</p>
          <h2 id="current" className="mt-2 flex items-center gap-3 text-3xl font-semibold tracking-tight">
            {plan.name}
            {org.cancelAtPeriodEnd && effective !== "free" && <span className="chip border-accent/50 text-accent">Ends soon</span>}
          </h2>
          {effective !== "free" && org.currentPeriodEnd ? (
            <p className="mt-2 text-sm text-muted">
              {org.cancelAtPeriodEnd ? "Access until" : "Renews on"}{" "}
              <span className="text-ink">{org.currentPeriodEnd.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
              {" · "}
              {formatNaira(plan.price[org.planInterval])} / {org.planInterval === "yearly" ? "year" : "month"}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted">Free forever. Upgrade any time for more events, seats and tools.</p>
          )}
          {effective !== "free" && (
            <div className="mt-5 flex flex-wrap gap-2">
              {!org.cancelAtPeriodEnd && (
                <ConfirmDelete action={cancelSubscriptionAction.bind(null, slug)} title={`${plan.name} subscription`} noun="subscription">Cancel plan</ConfirmDelete>
              )}
            </div>
          )}
        </div>
        <ul className="space-y-4" aria-label="Usage">
          {meters.map((m) => {
            const pct = m.max ? Math.min(100, (m.used / m.max) * 100) : 0;
            return (
              <li key={m.label}>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">{m.label}</span>
                  <span className="tabular-nums">{m.used}{m.max ? ` / ${m.max}` : " · unlimited"}</span>
                </div>
                {m.max && (
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
                    <div className={cn("h-full rounded-full", pct >= 100 ? "bg-danger" : "bg-accent")} style={{ width: `${pct}%` }} />
                  </div>
                )}
              </li>
            );
          })}
          <li className="flex justify-between text-sm">
            <span className="text-muted">Attendees per event</span>
            <span className="tabular-nums">{limits.attendeesPerEvent?.toLocaleString("en-US")}</span>
          </li>
        </ul>
      </section>

      <section className="mt-12" aria-labelledby="plans">
        <h2 id="plans" className="mb-6 text-[15px] font-medium">Change plan</h2>
        {!provider && (
          <p className="mb-6 rounded-[var(--radius-card)] border border-line-strong px-4 py-3 text-sm text-muted">
            Online payments aren&apos;t configured. Set <code className="font-mono text-xs">FLUTTERWAVE_SECRET_KEY</code> to enable checkout.
          </p>
        )}
        {provider?.id === "mock" && (
          <p className="mb-6 rounded-[var(--radius-card)] border border-accent/30 bg-accent/10 px-4 py-3 text-sm">
            Test mode: no Flutterwave key found, so upgrades use a simulated checkout.
          </p>
        )}
        <PricingTable mode="billing" orgSlug={slug} currentPlan={org.plan === "free" ? "free" : effective === "free" ? undefined : org.plan} currentInterval={org.planInterval} canManage={!!provider} />
      </section>

      <section className="mt-12" aria-labelledby="history">
        <h2 id="history" className="mb-3 text-[15px] font-medium">Payment history</h2>
        {payments.length === 0 ? (
          <p className="rounded-[var(--radius-card)] border border-dashed border-line-strong px-6 py-10 text-center text-sm text-muted">No payments yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-faint">
                  <th className="px-5 py-3 font-normal">Date</th>
                  <th className="px-3 py-3 font-normal">Plan</th>
                  <th className="px-3 py-3 font-normal">Reference</th>
                  <th className="px-5 py-3 text-right font-normal">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-3 text-muted">{p.paidAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                    <td className="px-3 py-3 capitalize">{p.plan} · {p.interval}</td>
                    <td className="px-3 py-3 font-mono text-xs text-faint">{p.reference.slice(0, 22)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{formatNaira(p.amount / 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
