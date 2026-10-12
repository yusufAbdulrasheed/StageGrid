"use client";

import { useEffect, useState } from "react";
import { AnalyticsEvent } from "@/lib/constants";
import { track } from "@/lib/analytics";

export default function FlashNotice({ kind, slug }: { kind: "created" | "updated" | "saved"; slug: string }) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (kind !== "created") return;
    const key = `sg:created:${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
    }
    track(AnalyticsEvent.EVENT_CREATED, { event_slug: slug });
  }, [kind, slug]);

  if (!open) return null;
  return (
    <div role="status" className="mb-6 rounded-[var(--radius-card)] border border-ok/30 bg-ok/10">
      <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
        <p>{kind === "created" ? "Your event is live. Share the link to start filling seats." : kind === "saved" ? "Draft saved. Publish it whenever you're ready." : "Changes saved."}</p>
        <button type="button" onClick={() => setOpen(false)} className="text-muted hover:text-ink">
          Dismiss
        </button>
      </div>
    </div>
  );
}
