// import posthog from "posthog-js"

// posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
//   api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
//   ui_host: "https://us.posthog.com",
//   defaults: '2025-05-24',
//   capture_exceptions: true, // This enables capturing exceptions using Error Tracking, set to false if you don't want this
//   debug: process.env.NODE_ENV === "development",
  
// });


// instrumentation-client.ts
import posthog from "posthog-js"

try {
  if (typeof window !== 'undefined') {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST
    
    if (!key) {
      console.error('[PostHog] Missing NEXT_PUBLIC_POSTHOG_KEY')
    } else {
      posthog.init(key, {
        api_host: host || "https://us.i.posthog.com",
        ui_host: "https://us.posthog.com",
        person_profiles: 'identified_only',
        loaded: (posthog) => {
          console.log('[PostHog] Successfully loaded')
        },
        // Add debug mode temporarily
        debug: true,
      })
    }
  }
} catch (error) {
  console.error('[PostHog] Initialization error:', error)
}