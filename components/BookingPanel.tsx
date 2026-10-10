"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { bookEventAction, cancelBookingAction } from "@/app/actions/bookings";
import { FormError } from "@/components/Field";
import { AnalyticsEvent } from "@/lib/constants";
import { track } from "@/lib/analytics";
import { formatMinor } from "@/lib/plans";
import { cn } from "@/lib/utils";
import type { FormState } from "@/lib/action-types";

interface Tier {
  id: string;
  name: string;
  price: number;
  quantity: number | null;
  sold: number;
}

interface Props {
  eventId: string;
  slug: string;
  tickets: Tier[];
  capacity: number | null;
  booked: number;
  ended: boolean;
  user: { name: string; email: string } | null;
  /** Ticket the signed-in user already holds, if any. */
  held: { code: string; ticketName: string | null; paid: boolean } | null;
  notice?: string;
}

export default function BookingPanel({ eventId, slug, tickets, capacity, booked, ended, user, held, notice }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(bookEventAction.bind(null, eventId), {});
  const eventLeft = capacity == null ? null : Math.max(0, capacity - booked);
  const pct = capacity ? Math.min(100, Math.round((booked / capacity) * 100)) : 0;

  const available = (t: Tier) => (eventLeft === 0 ? false : t.quantity == null || t.sold < t.quantity);
  const firstOpen = tickets.find(available)?.id ?? tickets[0]?.id;
  const [selected, setSelected] = useState(firstOpen);
  const tier = tickets.find((t) => t.id === selected);
  const paid = !!tier && tier.price > 0;
  const confirmed = !!held || state.ok;

  useEffect(() => {
    if (state.ok) track(AnalyticsEvent.EVENT_BOOKED, { event_slug: slug });
  }, [state.ok, slug]);

  const next = encodeURIComponent(`/events/${slug}`);

  return (
    <div className="card p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-medium tracking-tight">{tickets.length > 1 ? "Choose your ticket" : "Reserve your seat"}</h2>
      </div>

      {notice && (
        <p role="alert" className="mt-4 rounded-[var(--radius-card)] border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
          {notice}
        </p>
      )}

      <div className="mt-5">
        <div
          className="h-1 overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-label="Seats taken"
          aria-valuenow={capacity ? pct : undefined}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full rounded-full bg-accent transition-[width] duration-700" style={{ width: capacity ? `${pct}%` : "100%", opacity: capacity ? 1 : 0.25 }} />
        </div>
        <p className="mt-2 text-[13px] text-muted">
          {capacity == null
            ? `${booked.toLocaleString("en-US")} going`
            : eventLeft === 0
              ? `Sold out · ${capacity.toLocaleString("en-US")} seats taken`
              : `${eventLeft!.toLocaleString("en-US")} of ${capacity.toLocaleString("en-US")} seats left`}
        </p>
      </div>

      <div className="mt-6">
        {ended ? (
          <p className="rounded-[var(--radius-card)] border border-line-strong px-4 py-3 text-sm text-muted">
            This event has ended. Browse upcoming events instead.
          </p>
        ) : confirmed ? (
          <div className="space-y-4">
            <div className="rounded-[var(--radius-card)] border border-ok/30 bg-ok/10 px-4 py-3.5">
              <p className="flex items-center gap-2 text-sm font-medium" role="status">
                <svg className="shrink-0 text-ok" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <path d="m3 8.5 3.2 3L13 4.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                You&apos;re going
              </p>
              <p className="mt-1.5 text-sm text-muted">{state.message ?? `${held?.ticketName ? `${held.ticketName} ticket · ` : ""}code ${held?.code}`}</p>
            </div>
            <a href={`/api/events/${slug}/ics`} className="btn btn-ghost w-full">Add to calendar</a>
            <Link href="/history" className="block text-center text-[13px] text-muted underline underline-offset-4 hover:text-ink">View in my bookings</Link>
            {held && !held.paid && (
              <form action={cancelBookingAction.bind(null, eventId)}>
                <button type="submit" className="w-full text-center text-[13px] text-faint underline underline-offset-4 hover:text-danger">Cancel my booking</button>
              </form>
            )}
          </div>
        ) : !user ? (
          <div className="space-y-4">
            <TierList tickets={tickets} selected={selected} onSelect={setSelected} available={available} />
            <Link href={`/login?next=${next}`} className="btn btn-primary btn-lg w-full">Sign in to book</Link>
            <p className="text-center text-sm text-muted">
              No account yet?{" "}
              <Link href={`/signup?next=${next}`} className="text-ink underline underline-offset-4 hover:text-accent">Create one free</Link>
            </p>
          </div>
        ) : (
          <form action={action} className="space-y-5" noValidate>
            <FormError message={state.error} />
            <input type="hidden" name="ticketTypeId" value={selected ?? ""} />
            <TierList tickets={tickets} selected={selected} onSelect={setSelected} available={available} />
            <p className="text-[13px] text-muted">
              Booking as <span className="text-ink">{user.name}</span> · <span className="font-mono text-xs">{user.email}</span>
            </p>
            <button
              type="submit"
              disabled={pending || !tier || !available(tier)}
              onClick={() => paid && track(AnalyticsEvent.CHECKOUT_STARTED, { event_slug: slug })}
              className="btn btn-primary btn-lg w-full"
            >
              {pending ? (paid ? "Opening checkout…" : "Reserving…") : !tier || !available(tier) ? "Sold out" : paid ? `Pay ${formatMinor(tier.price)}` : "Get my ticket"}
            </button>
            {paid && <p className="text-center text-xs text-faint">Secure payment by Paystack. You&apos;ll get your ticket as soon as it clears.</p>}
          </form>
        )}
      </div>
    </div>
  );
}

function TierList({
  tickets,
  selected,
  onSelect,
  available,
}: {
  tickets: Tier[];
  selected?: string;
  onSelect: (id: string) => void;
  available: (t: Tier) => boolean;
}) {
  return (
    <fieldset>
      <legend className="sr-only">Ticket type</legend>
      <div className="space-y-2">
        {tickets.map((t) => {
          const open = available(t);
          const left = t.quantity == null ? null : Math.max(0, t.quantity - t.sold);
          return (
            <label
              key={t.id}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-[var(--radius-card)] border px-4 py-3 transition-colors",
                selected === t.id ? "border-accent bg-accent/[0.06]" : "border-line-strong hover:border-faint",
                !open && "cursor-not-allowed opacity-50",
              )}
            >
              <input type="radio" name="tier" className="sr-only" checked={selected === t.id} disabled={!open} onChange={() => onSelect(t.id)} />
              <span aria-hidden className={cn("grid size-4 shrink-0 place-items-center rounded-full border", selected === t.id ? "border-accent" : "border-line-strong")}>
                {selected === t.id && <span className="size-2 rounded-full bg-accent" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{t.name}</span>
                <span className="block text-xs text-muted">
                  {!open ? "Sold out" : left != null && left <= 20 ? `${left} left` : " "}
                </span>
              </span>
              <span className={cn("font-mono text-sm tabular-nums", t.price === 0 && "text-ok")}>{formatMinor(t.price)}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
