"use client";

import { useState } from "react";
import { AnalyticsEvent } from "@/lib/constants";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export default function ShareButton({ title, slug }: { title: string; slug: string }) {
  const [copied, setCopied] = useState(false);

  async function onClick() {
    const url = `${window.location.origin}/events/${slug}`;
    track(AnalyticsEvent.EVENT_SHARED, { event_slug: slug });
    try {
      if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* user dismissed the share sheet */
    }
  }

  return (
    <button type="button" onClick={onClick} className={cn("btn btn-ghost", copied && "text-ok")} aria-live="polite">
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
        <path d="M6.5 9.5 9.5 6.5M7 4.5l1-1a3 3 0 0 1 4.2 4.2l-1 1M9 11.5l-1 1a3 3 0 0 1-4.2-4.2l1-1" strokeLinecap="round" />
      </svg>
      {copied ? "Link copied" : "Share"}
    </button>
  );
}
