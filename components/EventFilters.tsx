"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CATEGORIES, MODES, MODE_LABEL, AnalyticsEvent } from "@/lib/constants";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export default function EventFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const lastPushed = useRef(params.get("q") ?? "");

  const category = params.get("category") ?? "";
  const mode = params.get("mode") ?? "";
  const when = params.get("when") ?? "upcoming";
  const price = params.get("price") ?? "";

  const push = useCallback(
    (next: Record<string, string>) => {
      const sp = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(next)) {
        if (v) sp.set(k, v);
        else sp.delete(k);
      }
      sp.delete("page");
      startTransition(() => router.replace(`${pathname}${sp.size ? `?${sp}` : ""}`, { scroll: false }));
    },
    [params, pathname, router],
  );

  useEffect(() => {
    if (q === lastPushed.current) return;
    const t = setTimeout(() => {
      lastPushed.current = q;
      if (q.trim()) track(AnalyticsEvent.SEARCH_USED, { query_length: q.trim().length });
      push({ q: q.trim() });
    }, 280);
    return () => clearTimeout(t);
  }, [q, push]);

  const pill = (active: boolean) =>
    cn(
      "h-8 shrink-0 rounded-full border px-3.5 text-[13px] transition-colors",
      active
        ? "border-ink bg-ink text-bg"
        : "border-line-strong text-muted hover:border-faint hover:text-ink",
    );

  return (
    <div className={cn("space-y-4 transition-opacity", pending && "opacity-70")}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <svg
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint"
            width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden
          >
            <circle cx="7" cy="7" r="5" />
            <path d="m11 11 3.5 3.5" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search events, artists, venues or cities"
            aria-label="Search events"
            className="input pl-10"
          />
        </div>
        <select aria-label="Price" value={price} onChange={(e) => push({ price: e.target.value })} className="input sm:w-36">
          <option value="">Any price</option>
          <option value="free">Free</option>
          <option value="paid">Paid</option>
        </select>
        <select
          aria-label="Format"
          value={mode}
          onChange={(e) => push({ mode: e.target.value })}
          className="input sm:w-44"
        >
          <option value="">Any format</option>
          {MODES.map((m) => (
            <option key={m} value={m}>{MODE_LABEL[m]}</option>
          ))}
        </select>
        <div className="flex h-11 shrink-0 rounded-[var(--radius-card)] border border-line-strong p-0.5 text-[13px]" role="group" aria-label="Time">
          {(["upcoming", "past"] as const).map((w) => (
            <button
              key={w}
              type="button"
              aria-pressed={when === w}
              onClick={() => push({ when: w === "upcoming" ? "" : w })}
              className={cn(
                "rounded px-4 capitalize transition-colors",
                when === w ? "bg-surface-2 text-ink" : "text-muted hover:text-ink",
              )}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 [scrollbar-width:none]">
        <button type="button" className={pill(!category)} onClick={() => push({ category: "" })}>
          All
        </button>
        {CATEGORIES.map((c) => (
          <button key={c} type="button" className={pill(category === c)} onClick={() => push({ category: c })}>
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
