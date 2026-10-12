"use client";

import posthog from "posthog-js";
import type { AnalyticsEvent } from "@/lib/constants";

export function track(event: AnalyticsEvent, properties?: Record<string, unknown>) {
  try {
    if (posthog.__loaded) posthog.capture(event, properties);
  } catch {
  }
}
