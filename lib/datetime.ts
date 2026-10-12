function tzOffsetMs(ts: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(ts));
  const v: Record<string, number> = {};
  for (const p of parts) if (p.type !== "literal") v[p.type] = Number(p.value);
  return Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute, v.second) - ts;
}

export function zonedToUtc(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = guess - tzOffsetMs(guess, timeZone);
  const second = guess - tzOffsetMs(first, timeZone);
  return new Date(second);
}

export function utcToZonedParts(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const v: Record<string, string> = {};
  for (const p of parts) v[p.type] = p.value;
  return { date: `${v.year}-${v.month}-${v.day}`, time: `${v.hour}:${v.minute}` };
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function formatDay(iso: string, timeZone: string, style: "short" | "long" = "short") {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: style === "long" ? "long" : "short",
    month: style === "long" ? "long" : "short",
    day: "numeric",
    ...(style === "long" ? { year: "numeric" } : {}),
  }).format(new Date(iso));
}

export function formatTime(iso: string, timeZone: string, withZone = true) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    ...(withZone ? { timeZoneName: "short" } : {}),
  }).format(new Date(iso));
}

export function dateParts(iso: string, timeZone: string) {
  const f = (opt: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-US", { timeZone, ...opt }).format(new Date(iso));
  return { month: f({ month: "short" }), day: f({ day: "2-digit" }), year: f({ year: "numeric" }) };
}

export function relativeUntil(iso: string, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now;
  const day = 86_400_000;
  if (diff < 0) return "Ended";
  if (diff < 3_600_000) return "Starting soon";
  if (diff < day) return "Today";
  const days = Math.floor(diff / day);
  if (days === 1) return "Tomorrow";
  if (days < 14) return `In ${days} days`;
  if (days < 60) return `In ${Math.round(days / 7)} weeks`;
  return `In ${Math.round(days / 30)} months`;
}

export const TIMEZONES = [
  { value: "America/Los_Angeles", label: "Pacific (Los Angeles)" },
  { value: "America/Denver", label: "Mountain (Denver)" },
  { value: "America/Chicago", label: "Central (Chicago)" },
  { value: "America/New_York", label: "Eastern (New York)" },
  { value: "America/Sao_Paulo", label: "Brasília (São Paulo)" },
  { value: "UTC", label: "UTC" },
  { value: "Europe/London", label: "London" },
  { value: "Europe/Paris", label: "Central Europe (Paris)" },
  { value: "Europe/Amsterdam", label: "Amsterdam" },
  { value: "Africa/Lagos", label: "West Africa (Lagos)" },
  { value: "Africa/Accra", label: "Ghana (Accra)" },
  { value: "Africa/Nairobi", label: "East Africa (Nairobi)" },
  { value: "Africa/Johannesburg", label: "South Africa (Johannesburg)" },
  { value: "Asia/Dubai", label: "Gulf (Dubai)" },
  { value: "Asia/Kolkata", label: "India (Kolkata)" },
  { value: "Asia/Singapore", label: "Singapore" },
  { value: "Asia/Tokyo", label: "Japan (Tokyo)" },
  { value: "Australia/Sydney", label: "Sydney" },
] as const;
