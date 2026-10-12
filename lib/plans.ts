export type PlanId = "free" | "pro" | "business";
export type Interval = "monthly" | "yearly";
export type Role = "owner" | "admin" | "member";

export interface PlanLimits {
  activeEvents: number | null;
  attendeesPerEvent: number | null;
  members: number;
  csvExport: boolean;
  analytics: boolean;
  apiAccess: boolean;
  ticketFeePercent: number;
}

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  price: Record<Interval, number>;
  limits: PlanLimits;
  highlights: string[];
}

export const CURRENCY = "NGN";

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Starter",
    tagline: "For first events and small communities.",
    price: { monthly: 0, yearly: 0 },
    limits: { activeEvents: 2, attendeesPerEvent: 50, members: 1, csvExport: false, analytics: false, apiAccess: false, ticketFeePercent: 8 },
    highlights: ["2 live events", "50 attendees per event", "Free and paid tickets (8% fee)", "Check-in and ticket codes"],
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "For promoters and teams running events monthly.",
    price: { monthly: 15_000, yearly: 144_000 },
    limits: { activeEvents: 20, attendeesPerEvent: 1_000, members: 5, csvExport: true, analytics: true, apiAccess: false, ticketFeePercent: 5 },
    highlights: ["20 live events", "1,000 attendees per event", "5 team members", "Sales analytics and CSV export", "5% ticket fee"],
  },
  business: {
    id: "business",
    name: "Business",
    tagline: "For venues, festivals and companies at scale.",
    price: { monthly: 45_000, yearly: 432_000 },
    limits: { activeEvents: null, attendeesPerEvent: 10_000, members: 25, csvExport: true, analytics: true, apiAccess: true, ticketFeePercent: 3 },
    highlights: ["Unlimited live events", "10,000 attendees per event", "25 team members", "REST API and keys", "3% ticket fee"],
  },
};

export const PLAN_ORDER: PlanId[] = ["free", "pro", "business"];

export function isPlanId(v: unknown): v is PlanId {
  return v === "free" || v === "pro" || v === "business";
}

export function formatNaira(n: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);
}

export function formatMinor(minor: number) {
  return minor === 0 ? "Free" : formatNaira(minor / 100);
}

export function monthlyEquivalent(plan: Plan, interval: Interval) {
  return interval === "yearly" ? Math.round(plan.price.yearly / 12) : plan.price.monthly;
}

const RANK: Record<Role, number> = { member: 1, admin: 2, owner: 3 };

export type Action = "events" | "team" | "settings" | "billing" | "api-keys";

const REQUIRED: Record<Action, Role> = {
  events: "member",
  team: "admin",
  settings: "admin",
  "api-keys": "admin",
  billing: "owner",
};

export function can(role: Role, action: Action): boolean {
  return RANK[role] >= RANK[REQUIRED[action]];
}

export function atLeast(role: Role, min: Role) {
  return RANK[role] >= RANK[min];
}
