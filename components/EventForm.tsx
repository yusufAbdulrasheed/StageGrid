"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Field, { FormError } from "@/components/Field";
import { createEventAction, updateEventAction } from "@/app/actions/events";
import { CATEGORIES, COVERS, MODES, MODE_LABEL, TICKET_PRESETS, categoryImage, type Category } from "@/lib/constants";
import { TIMEZONES } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import type { FormState } from "@/lib/action-types";

export type EventFormValues = Record<string, string>;

interface TierRow {
  name: string;
  price: string;
  quantity: string;
}

interface Props {
  orgSlug: string;
  eventId?: string;
  initial?: EventFormValues;
  initialTickets?: { name: string; price: number; quantity: number | null }[];
  isLive?: boolean;
  payoutsReady: boolean;
}

const fromPreset = (c: Category): TierRow[] =>
  TICKET_PRESETS[c].map((t) => ({ name: t.name, price: String(t.price), quantity: "" }));

export default function EventForm({ orgSlug, eventId, initial, initialTickets, isLive, payoutsReady }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    eventId ? updateEventAction.bind(null, orgSlug, eventId) : createEventAction.bind(null, orgSlug),
    {},
  );
  const v: EventFormValues = { ...(initial ?? {}), ...(state.values ?? {}) };
  const fe = state.fieldErrors;

  const [category, setCategory] = useState<Category>((v.category as Category) || "Party");
  const [image, setImage] = useState(v.image || categoryImage(category));
  const [tiers, setTiers] = useState<TierRow[]>(() => {
    if (v.tickets) {
      try {
        return (JSON.parse(v.tickets) as { name: string; price: number; quantity: number | string | null }[]).map((t) => ({
          name: t.name,
          price: String(t.price),
          quantity: t.quantity == null ? "" : String(t.quantity),
        }));
      } catch {
      }
    }
    if (initialTickets?.length) return initialTickets.map((t) => ({ name: t.name, price: String(t.price), quantity: t.quantity == null ? "" : String(t.quantity) }));
    return fromPreset(category);
  });

  const isDefault = image === categoryImage(category);
  const custom = !isDefault && !COVERS.some((c) => c.src === image) && !image.startsWith("/images/");
  const hasPaid = useMemo(() => tiers.some((t) => Number(t.price) > 0), [tiers]);

  useEffect(() => {
    if (state.fieldErrors) document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
  }, [state]);

  const payload = JSON.stringify(
    tiers.map((t) => ({ name: t.name, price: t.price === "" ? 0 : Number(t.price), quantity: t.quantity === "" ? null : Number(t.quantity) })),
  );

  function changeCategory(next: Category) {
    setCategory(next);
    if (isDefault) setImage(categoryImage(next));
  }
  const patch = (i: number, p: Partial<TierRow>) => setTiers((rows) => rows.map((r, j) => (j === i ? { ...r, ...p } : r)));

  return (
    <form action={action} className="space-y-12" noValidate>
      {state.error && (
        <div className="space-y-3">
          <FormError message={state.error} />
          <div className="flex gap-2">
            {state.upgrade && <Link href={`/app/${orgSlug}/billing`} className="btn btn-primary btn-sm">View plans</Link>}
            {state.payouts && <Link href={`/app/${orgSlug}/settings#payouts`} className="btn btn-primary btn-sm">Add payout account</Link>}
          </div>
        </div>
      )}

      <Section n="01" title="The basics" note="What people see first in listings and search.">
        <Field name="title" label="Event title" errors={fe}>
          {(p) => <input {...p} name="title" className="input" defaultValue={v.title} placeholder="e.g. Sunset Pool Party" maxLength={100} required />}
        </Field>
        <Field name="summary" label="One-line summary" errors={fe} hint="Shown on cards. Keep it under 200 characters.">
          {(p) => <input {...p} name="summary" className="input" defaultValue={v.summary} maxLength={200} required />}
        </Field>
        <Field name="category" label="Kind of event" errors={fe}>
          {(p) => (
            <select {...p} name="category" className="input sm:max-w-xs" value={category} onChange={(e) => changeCategory(e.target.value as Category)}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          )}
        </Field>
        <Field name="description" label="About this event" errors={fe} hint="Plain text. Separate paragraphs with a blank line.">
          {(p) => <textarea {...p} name="description" rows={7} className="input" defaultValue={v.description} maxLength={5000} required />}
        </Field>
      </Section>

      <Section n="02" title="When and where" note="Times are entered in the event's own timezone.">
        <div className="grid gap-5 sm:grid-cols-3">
          <Field name="date" label="Date" errors={fe}>
            {(p) => <input {...p} name="date" type="date" className="input" defaultValue={v.date} required />}
          </Field>
          <Field name="startTime" label="Starts" errors={fe}>
            {(p) => <input {...p} name="startTime" type="time" className="input" defaultValue={v.startTime ?? "18:00"} required />}
          </Field>
          <Field name="endTime" label="Ends" errors={fe} optional>
            {(p) => <input {...p} name="endTime" type="time" className="input" defaultValue={v.endTime} />}
          </Field>
        </div>
        <Field name="timezone" label="Timezone" errors={fe}>
          {(p) => (
            <select {...p} name="timezone" className="input" defaultValue={v.timezone ?? "Africa/Lagos"}>
              {TIMEZONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          )}
        </Field>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field name="mode" label="Format" errors={fe}>
            {(p) => (
              <select {...p} name="mode" className="input" defaultValue={v.mode ?? "in-person"}>
                {MODES.map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
              </select>
            )}
          </Field>
          <Field name="venue" label="Venue" errors={fe} optional>
            {(p) => <input {...p} name="venue" className="input" defaultValue={v.venue} placeholder="Venue or platform" />}
          </Field>
          <Field name="location" label="City or region" errors={fe}>
            {(p) => <input {...p} name="location" className="input" defaultValue={v.location} placeholder="Lagos, Nigeria" required />}
          </Field>
        </div>
      </Section>

      <Section n="03" title="Tickets" note="Free, paid, or several tiers. Prices are in naira.">
        <input type="hidden" name="tickets" value={payload} />
        <div className="space-y-3">
          {tiers.map((t, i) => (
            <div key={i} className="grid gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:grid-cols-[1fr_140px_120px_auto] sm:items-end">
              <div className="field">
                <label htmlFor={`t-name-${i}`}>Ticket name</label>
                <input id={`t-name-${i}`} className="input" value={t.name} onChange={(e) => patch(i, { name: e.target.value })} placeholder="e.g. VIP" maxLength={40} />
              </div>
              <div className="field">
                <label htmlFor={`t-price-${i}`}>Price (₦)</label>
                <input id={`t-price-${i}`} className="input" inputMode="numeric" value={t.price} onChange={(e) => patch(i, { price: e.target.value.replace(/[^\d]/g, "") })} placeholder="0 = free" />
              </div>
              <div className="field">
                <label htmlFor={`t-qty-${i}`}>Quantity</label>
                <input id={`t-qty-${i}`} className="input" inputMode="numeric" value={t.quantity} onChange={(e) => patch(i, { quantity: e.target.value.replace(/[^\d]/g, "") })} placeholder="No limit" />
              </div>
              <button type="button" className="btn btn-ghost h-11 px-3 text-muted hover:text-danger" disabled={tiers.length === 1} onClick={() => setTiers((r) => r.filter((_, j) => j !== i))} aria-label={`Remove ${t.name || "ticket"}`}>
                ✕
              </button>
            </div>
          ))}
        </div>
        {fe?.tickets && <p className="field-error" role="alert">{fe.tickets[0]}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-ghost btn-sm" disabled={tiers.length >= 6} onClick={() => setTiers((r) => [...r, { name: "", price: "", quantity: "" }])}>
            + Add ticket type
          </button>
          {!eventId && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setTiers(fromPreset(category))}>
              Use suggested tiers for {category.toLowerCase()}
            </button>
          )}
        </div>
        {hasPaid && !payoutsReady && (
          <p className="rounded-[var(--radius-card)] border border-accent/30 bg-accent/10 px-4 py-3 text-sm">
            Paid tickets need a payout account.{" "}
            <Link href={`/app/${orgSlug}/settings#payouts`} className="underline underline-offset-4">Add one in settings</Link>
            {" "}before publishing. You can save a draft meanwhile.
          </p>
        )}
        <Field name="capacity" label="Overall capacity" errors={fe} optional hint="Total seats across all ticket types. Leave empty for no cap (your plan's attendee limit still applies).">
          {(p) => <input {...p} name="capacity" type="number" min={1} inputMode="numeric" className="input sm:max-w-xs" defaultValue={v.capacity} />}
        </Field>
      </Section>

      <Section n="04" title="Cover and details" note="A strong image does most of the selling.">
        <fieldset>
          <legend className="label mb-2.5">Cover</legend>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            <button
              type="button"
              onClick={() => setImage(categoryImage(category))}
              aria-pressed={isDefault}
              aria-label={`Default photo for ${category}`}
              className={cn("relative aspect-[4/3] overflow-hidden rounded border transition", isDefault ? "border-accent ring-2 ring-accent/40" : "border-line opacity-70 hover:opacity-100")}
            >
              <Image src={categoryImage(category)} alt="" fill sizes="120px" className="object-cover" />
              <span className="absolute inset-x-0 bottom-0 bg-bg/80 px-1.5 py-0.5 text-center font-mono text-[10px] uppercase tracking-wider">Default</span>
            </button>
            {COVERS.map((c) => (
              <button
                key={c.src}
                type="button"
                onClick={() => setImage(c.src)}
                aria-pressed={image === c.src}
                aria-label={c.label}
                className={cn("relative aspect-[4/3] overflow-hidden rounded border transition", image === c.src ? "border-accent ring-2 ring-accent/40" : "border-line opacity-70 hover:opacity-100")}
              >
                <Image src={c.src} alt="" fill sizes="120px" className="object-cover" />
              </button>
            ))}
          </div>
          <input type="hidden" name="image" value={image} />
          <div className="mt-3">
            <label htmlFor="f-image-url" className="sr-only">Custom image URL</label>
            <input
              id="f-image-url"
              className="input font-mono text-[13px]"
              value={custom ? image : ""}
              onChange={(e) => setImage(e.target.value || categoryImage(category))}
              aria-invalid={!!fe?.image}
              placeholder="…or paste an https:// image URL for your own cover"
            />
            {fe?.image && <p className="field-error mt-1.5" role="alert">{fe.image[0]}</p>}
            {isDefault && <p className="hint mt-1.5">The default photo follows the kind of event you pick.</p>}
          </div>
        </fieldset>

        <Field name="tags" label="Tags" errors={fe} optional hint="Comma separated, up to 8.">
          {(p) => <input {...p} name="tags" className="input" defaultValue={v.tags} placeholder="Afrobeats, Open air, 18+" />}
        </Field>
        <Field name="agenda" label="Programme" errors={fe} optional hint="One item per line.">
          {(p) => <textarea {...p} name="agenda" rows={5} className="input font-mono text-[13px]" defaultValue={v.agenda} placeholder={"18:00 — Doors\n20:00 — Headline set\n23:30 — Last call"} />}
        </Field>
      </Section>

      <div className="sticky bottom-0 -mx-5 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-bg/90 px-5 py-4 backdrop-blur sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12">
        <Link href={`/app/${orgSlug}/events`} className="text-sm text-muted hover:text-ink">Cancel</Link>
        <div className="flex gap-2">
          <button type="submit" name="intent" value="draft" disabled={pending} className="btn btn-ghost">
            {isLive ? "Unpublish & save" : "Save draft"}
          </button>
          <button type="submit" name="intent" value="publish" disabled={pending} className="btn btn-primary">
            {pending ? "Saving…" : isLive ? "Save changes" : "Publish event"}
          </button>
        </div>
      </div>
    </form>
  );
}

function Section({ n, title, note, children }: { n: string; title: string; note: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-5 md:grid-cols-[200px_1fr] md:gap-10">
      <div>
        <p className="eyebrow">{n}</p>
        <h2 className="mt-2 text-lg font-semibold tracking-tight">{title}</h2>
        <p className="mt-1.5 text-sm text-muted">{note}</p>
      </div>
      <div className="max-w-2xl space-y-5">{children}</div>
    </section>
  );
}
