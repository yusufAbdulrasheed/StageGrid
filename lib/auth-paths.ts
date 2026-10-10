/** Only allow same-site relative redirects. */
export function safeNext(value: unknown, fallback = "/dashboard"): string {
  if (typeof value !== "string") return fallback;
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : fallback;
}
