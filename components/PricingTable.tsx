"use client";

import { useState } from "react";
import Link from "next/link";
import { startCheckoutAction } from "@/app/actions/billing";
import { AnalyticsEvent } from "@/lib/constants";
import { track } from "@/lib/analytics";
import { PLANS, PLAN_ORDER, formatNaira, monthlyEquivalent, type Interval, type PlanId } from "@/lib/plans";
import { cn } from "@/lib/utils";

interface Props {
  mode: "marketing" | "billing";
  orgSlug?: string;
  currentPlan?: PlanId;
  currentInterval?: Interval;
  canManage?: boolean;
}

export default function PricingTable({ mode, orgSlug, currentPlan, currentInterval, canManage = true }: Props) {
  const [interval, setInterval] = useState<Interval>(currentInterval ?? "monthly");

  return (
    <div>
      <div className="mb-10 flex justify-center">
        <div className="inline-flex rounded-full border border-line-strong p-0.5 text-sm" role="group" aria-label="Billing period">
          {(["monthly", "yearly"] as const).map((i) => (
            <button
              key={i}
              type="button"
              aria-pressed={interval === i}
              onClick={() => {
                setInterval(i);
                track(AnalyticsEvent.PRICING_INTERVAL_TOGGLED, { interval: i });
              }}
              className={cn(
                "rounded-full px-5 py-1.5 capitalize transition-colors",
                interval === i ? "bg-ink text-bg" : "text-muted hover:text-ink",
              )}
            >
              {i}
              {i === "yearly" && <span className={cn("ml-2 font-mono text-[11px]", interval === i ? "text-bg/70" : "text-accent")}>−20%</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {PLAN_ORDER.map((id) => {
          const plan = PLANS[id];
          const featured = id === "pro";
          const isCurrent = currentPlan === id;
          const price = monthlyEquivalent(plan, interval);
          const downgrade = currentPlan && PLAN_ORDER.indexOf(id) < PLAN_ORDER.indexOf(currentPlan);

          return (
            <div
              key={id}
              className={cn(
                "relative flex flex-col rounded-[var(--radius-card)] border p-7",
                featured ? "border-accent/60 bg-surface" : "border-line bg-surface/50",
              )}
            >
              {featured && (
                <span className="absolute -top-3 left-7 rounded-full bg-accent px-3 py-0.5 font-mono text-[11px] uppercase tracking-wider text-accent-ink">
                  Most teams
                </span>
              )}
              <h3 className="text-lg font-medium tracking-tight">{plan.name}</h3>
              <p className="mt-1 text-sm text-muted">{plan.tagline}</p>

              <p className="mt-7 flex items-baseline gap-1.5">
                <span className="text-4xl font-semibold tracking-tight tabular-nums">{price === 0 ? "₦0" : formatNaira(price)}</span>
                <span className="text-sm text-muted">{price === 0 ? "forever" : "/ month"}</span>
              </p>
              <p className="mt-1 h-5 font-mono text-xs text-faint">
                {price > 0 && interval === "yearly" ? `${formatNaira(plan.price.yearly)} billed yearly` : ""}
              </p>

              <ul className="mt-6 flex-1 space-y-3 border-t border-line pt-6 text-sm">
                {plan.highlights.map((h) => (
                  <li key={h} className="flex gap-3">
                    <svg className="mt-1 shrink-0 text-accent" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                      <path d="m3 8.5 3.2 3L13 4.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {h}
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                {mode === "marketing" ? (
                  <Link href={id === "free" ? "/signup?type=organizer" : `/signup?type=organizer&plan=${id}`} className={cn("btn btn-lg w-full", featured ? "btn-primary" : "btn-ghost")}>
                    {id === "free" ? "Start free" : `Choose ${plan.name}`}
                  </Link>
                ) : isCurrent && (id === "free" || currentInterval === interval) ? (
                  <button disabled className="btn btn-lg w-full">Current plan</button>
                ) : id === "free" ? (
                  <button disabled className="btn btn-lg w-full">{downgrade ? "Cancel to downgrade" : "Included"}</button>
                ) : !canManage ? (
                  <button disabled className="btn btn-lg w-full" title="Only the workspace owner can change plans">Owner only</button>
                ) : (
                  <form
                    action={startCheckoutAction.bind(null, orgSlug!)}
                    onSubmit={() => track(AnalyticsEvent.UPGRADE_STARTED, { plan: id, interval })}
                  >
                    <input type="hidden" name="plan" value={id} />
                    <input type="hidden" name="interval" value={interval} />
                    <button type="submit" className={cn("btn btn-lg w-full", featured ? "btn-primary" : "btn-ghost")}>
                      {isCurrent ? `Switch to ${interval}` : downgrade ? `Switch to ${plan.name}` : `Upgrade to ${plan.name}`}
                    </button>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
