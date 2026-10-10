"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    try {
      if (posthog.__loaded) posthog.captureException(error);
    } catch {
      /* ignore */
    }
  }, [error]);

  return (
    <div className="wrap flex min-h-[60vh] flex-col items-start justify-center py-20">
      <p className="eyebrow">Something broke</p>
      <h1 className="display mt-4 text-[clamp(3rem,8vw,5.5rem)]">That didn&apos;t go to plan.</h1>
      <p className="mt-5 max-w-md text-muted">
        An unexpected error occurred. It&apos;s been logged; trying again usually works.
        {error.digest && <span className="mt-3 block font-mono text-xs text-faint">Ref: {error.digest}</span>}
      </p>
      <button onClick={reset} className="btn btn-primary btn-lg mt-8">Try again</button>
    </div>
  );
}
