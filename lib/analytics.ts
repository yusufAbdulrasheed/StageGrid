"use client";

import posthog from "posthog-js";
import type { AnalyticsEvent } from "@/lib/constants";

/** Safe to call anywhere on the client; no-ops if PostHog isn't configured. */
export function track(event: AnalyticsEvent, properties?: Record<string, unknown>) {
  try {
    if (posthog.__loaded) posthog.capture(event, properties);
  } catch {
    /* analytics must never break the UI */
  }
}
