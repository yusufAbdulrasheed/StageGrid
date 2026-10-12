export const CATEGORIES = [
  "Concert",
  "Party",
  "Festival",
  "Conference",
  "Workshop",
  "Meetup",
  "Sports",
  "Arts & Culture",
  "Food & Drink",
  "Community",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const MODES = ["in-person", "online", "hybrid"] as const;
export type EventMode = (typeof MODES)[number];

export const MODE_LABEL: Record<EventMode, string> = {
  "in-person": "In person",
  online: "Online",
  hybrid: "Hybrid",
};

export const COVERS = [
  { src: "/images/event1.png", label: "Stage lights" },
  { src: "/images/event2.png", label: "Big screen" },
  { src: "/images/event3.png", label: "Main stage" },
  { src: "/images/event4.png", label: "Arena" },
  { src: "/images/event5.png", label: "Open air" },
  { src: "/images/event6.png", label: "Crowd" },
] as const;

export const POSTER_PREFIX = "poster:";

const CATEGORY_IMAGE: Record<string, string> = {
  Concert: "concert",
  Party: "party",
  Festival: "festival",
  Conference: "conference",
  Workshop: "workshop",
  Meetup: "meetup",
  Sports: "sports",
  "Arts & Culture": "arts-culture",
  "Food & Drink": "food-drink",
  Community: "community",
};

export const categoryImage = (category: string) => `/images/categories/${CATEGORY_IMAGE[category] ?? "community"}.jpg`;

export const PAGE_SIZE = 9;

export interface TicketPreset {
  name: string;
  price: number;
  note?: string;
}

export const TICKET_PRESETS: Record<Category, TicketPreset[]> = {
  Concert: [
    { name: "Regular", price: 10_000 },
    { name: "VIP", price: 25_000, note: "Front section, fast entry" },
    { name: "VVIP", price: 60_000, note: "Table service" },
  ],
  Party: [
    { name: "General", price: 5_000 },
    { name: "VIP", price: 15_000 },
    { name: "Table for 4", price: 80_000 },
  ],
  Festival: [
    { name: "Early bird", price: 12_000 },
    { name: "Regular", price: 18_000 },
    { name: "VIP weekend", price: 55_000 },
  ],
  Conference: [
    { name: "Standard", price: 20_000 },
    { name: "Premium", price: 45_000, note: "Workshops and dinner" },
  ],
  Workshop: [{ name: "Seat", price: 15_000 }],
  Meetup: [{ name: "Free entry", price: 0 }],
  Sports: [
    { name: "Regular stand", price: 3_000 },
    { name: "VIP stand", price: 12_000 },
  ],
  "Arts & Culture": [
    { name: "Standard", price: 6_000 },
    { name: "Front row", price: 15_000 },
  ],
  "Food & Drink": [
    { name: "Entry", price: 4_000 },
    { name: "Tasting pass", price: 12_000 },
  ],
  Community: [{ name: "Free entry", price: 0 }],
};

export enum AnalyticsEvent {
  EXPLORE_CLICKED = "explore_events_button_clicked",
  EVENT_BOOKED = "event_booked",
  EVENT_CREATED = "event_created",
  EVENT_SHARED = "event_shared",
  SEARCH_USED = "events_searched",
  PRICING_INTERVAL_TOGGLED = "pricing_interval_toggled",
  UPGRADE_STARTED = "upgrade_started",
  CHECKOUT_STARTED = "ticket_checkout_started",
}
