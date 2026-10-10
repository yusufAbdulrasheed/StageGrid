import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { bookings, events, memberships, organizations, ticketTypes, users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/password";
import { ticketCode } from "@/lib/tokens";
import { slugify } from "@/lib/utils";
import { zonedToUtc } from "@/lib/datetime";
import { categoryImage } from "@/lib/constants";

export const DEMO_EMAIL = "demo@stagegrid.dev";
export const DEMO_PASSWORD = "stagegrid-demo";
export const ATTENDEE_EMAIL = "guest@stagegrid.dev";

interface SeedTicket {
  name: string;
  /** Naira. */
  price: number;
  quantity: number | null;
  /** Share of the allocation that is sold (0–1); 1 = sold out. */
  fill: number;
}

interface SeedEvent {
  org: string;
  title: string;
  summary: string;
  description: string;
  /** A bundled photo path, or omitted to use the category photo. */
  image?: string;
  category: string;
  mode: "in-person" | "online" | "hybrid";
  venue: string;
  location: string;
  timezone: string;
  /** Days from today; negative = already happened. */
  inDays: number;
  start: string;
  end?: string;
  tags: string[];
  agenda: string[];
  capacity: number | null;
  tickets: SeedTicket[];
  status?: "draft" | "published";
}

const EVENTS: SeedEvent[] = [
  {
    org: "Lagos Nights",
    title: "Sunset Pool Party",
    summary: "Open-air pool party with live DJs from golden hour until the last guest leaves.",
    description:
      "Golden-hour DJ sets, a poolside bar and a rooftop view of the lagoon. Dress light, bring your friends and arrive early; the first two hours have the best sound and the shortest queues.\n\nVIP guests get a private deck and a welcome drink. Tables seat four and include a bottle.",
    category: "Party",
    mode: "in-person",
    venue: "Eko Hotel Poolside",
    location: "Victoria Island, Lagos",
    timezone: "Africa/Lagos",
    inDays: 6,
    start: "16:00",
    end: "23:00",
    tags: ["Pool party", "DJ", "18+"],
    agenda: ["16:00 — Gates open", "17:30 — Sunset set", "20:00 — Headline DJ", "22:30 — Last call"],
    capacity: 200,
    tickets: [
      { name: "General", price: 5_000, quantity: 150, fill: 0.62 },
      { name: "VIP", price: 15_000, quantity: 40, fill: 0.85 },
      { name: "Table for 4", price: 80_000, quantity: 10, fill: 0.5 },
    ],
  },
  {
    org: "Lagos Nights",
    title: "Afrobeats Live: Night One",
    summary: "Three headliners, one stage, and a crowd that knows every word.",
    description:
      "The biggest Afrobeats night of the season. Three headline acts, a full live band and a sound system built for the open air.\n\nGates open at 6pm. VVIP includes table service and a dedicated entrance.",
    image: "/images/event1.png",
    category: "Concert",
    mode: "in-person",
    venue: "Tafawa Balewa Square",
    location: "Lagos Island, Lagos",
    timezone: "Africa/Lagos",
    inDays: 14,
    start: "19:00",
    end: "23:59",
    tags: ["Afrobeats", "Live music"],
    agenda: ["18:00 — Gates open", "19:30 — Opening acts", "21:00 — Headliner one", "22:30 — Headliner two", "23:30 — Closing set"],
    capacity: 800,
    tickets: [
      { name: "Regular", price: 10_000, quantity: 500, fill: 0.55 },
      { name: "VIP", price: 25_000, quantity: 200, fill: 0.7 },
      { name: "VVIP", price: 60_000, quantity: 50, fill: 0.9 },
    ],
  },
  {
    org: "Lagos Nights",
    title: "Comedy Open Mic",
    summary: "Fresh voices, rough edges and the funniest hour of your week.",
    description: "Ten new comics, five minutes each, one very forgiving room. Come early for a good seat.",
    category: "Arts & Culture",
    mode: "in-person",
    venue: "The Cube",
    location: "Yaba, Lagos",
    timezone: "Africa/Lagos",
    inDays: 3,
    start: "19:30",
    end: "22:00",
    tags: ["Comedy", "Open mic"],
    agenda: ["19:00 — Doors", "19:30 — Showtime", "21:30 — Open floor"],
    capacity: 90,
    tickets: [{ name: "Entry", price: 2_000, quantity: null, fill: 0.7 }],
  },
  {
    org: "Lagos Nights",
    title: "Highlife Sessions Vol. 3",
    summary: "An intimate live set from Lagos's best highlife players.",
    description: "A listening-room evening of highlife classics and new writing, with a short Q&A between sets.",
    category: "Concert",
    mode: "in-person",
    venue: "Jazzhole",
    location: "Ikoyi, Lagos",
    timezone: "Africa/Lagos",
    inDays: -20,
    start: "19:00",
    end: "22:30",
    tags: ["Highlife", "Live music"],
    agenda: ["19:00 — Doors", "20:00 — Set one", "21:15 — Set two"],
    capacity: 120,
    tickets: [{ name: "Seat", price: 8_000, quantity: 120, fill: 0.9 }],
  },
  {
    org: "Lagos Nights",
    title: "New Year Countdown",
    summary: "Ring it in with a rooftop countdown. Details coming soon.",
    description: "We're still locking in the venue and line-up. Save the date.",
    category: "Party",
    mode: "in-person",
    venue: "TBC",
    location: "Lagos",
    timezone: "Africa/Lagos",
    inDays: 80,
    start: "21:00",
    tags: ["New Year"],
    agenda: [],
    capacity: 300,
    tickets: [{ name: "General", price: 10_000, quantity: null, fill: 0 }],
    status: "draft",
  },
  {
    org: "Detty Fest Co.",
    title: "Detty December Festival",
    summary: "Three days, four stages and the whole city in one field.",
    description:
      "A three-day festival of music, food and art across four stages. Camp nearby or head home each night.\n\nEarly bird is sold out; weekend passes include fast-lane entry and the VIP lounge.",
    image: "/images/event5.png",
    category: "Festival",
    mode: "in-person",
    venue: "Eko Atlantic Park",
    location: "Lagos",
    timezone: "Africa/Lagos",
    inDays: 60,
    start: "14:00",
    end: "23:00",
    tags: ["Festival", "Camping", "Multi-stage"],
    agenda: ["14:00 — Gates", "16:00 — Day stage", "20:00 — Main stage", "23:00 — Night owls tent"],
    capacity: 3000,
    tickets: [
      { name: "Early bird", price: 12_000, quantity: 100, fill: 1 },
      { name: "Regular", price: 18_000, quantity: 2000, fill: 0.3 },
      { name: "VIP weekend", price: 55_000, quantity: 300, fill: 0.4 },
    ],
  },
  {
    org: "Lagos Road Runners",
    title: "Lagos City Half Marathon",
    summary: "21km through the lagoon-front streets, with water points and a finisher's medal.",
    description: "A fast, flat course with closed roads. Pick up your bib the day before. Spectators watch free.",
    category: "Sports",
    mode: "in-person",
    venue: "Lekki Phase 1",
    location: "Lagos",
    timezone: "Africa/Lagos",
    inDays: 40,
    start: "06:00",
    end: "11:00",
    tags: ["Running", "Half marathon"],
    agenda: ["05:00 — Bib check", "06:00 — Elite start", "06:15 — Mass start", "10:30 — Medals"],
    capacity: 1500,
    tickets: [
      { name: "Runner", price: 5_000, quantity: 1200, fill: 0.45 },
      { name: "Spectator", price: 0, quantity: null, fill: 0.2 },
    ],
  },
  {
    org: "Accra Table",
    title: "Jollof & Jazz Brunch",
    summary: "Long tables, live jazz and the great jollof debate, settled on the lawn.",
    description: "Bring your appetite. A rotating line-up of home cooks and restaurants, a live quartet and a very serious blind taste test.",
    category: "Food & Drink",
    mode: "in-person",
    venue: "Aburi Gardens",
    location: "Accra, Ghana",
    timezone: "Africa/Lagos",
    inDays: 21,
    start: "11:00",
    end: "16:00",
    tags: ["Brunch", "Jazz", "Food"],
    agenda: ["11:00 — Welcome drinks", "12:30 — Jollof tasting", "14:00 — Live jazz"],
    capacity: 120,
    tickets: [
      { name: "Entry", price: 4_000, quantity: 60, fill: 0.5 },
      { name: "Tasting pass", price: 12_000, quantity: 60, fill: 0.6 },
    ],
  },
  {
    org: "Cape Jazz Collective",
    title: "Cape Town Jazz Weekend",
    summary: "Two nights of the continent's finest players in one historic hall.",
    description: "A programme of headline sets and late jam sessions, with a food court on the terrace.",
    image: "/images/event2.png",
    category: "Festival",
    mode: "hybrid",
    venue: "Cape Town City Hall",
    location: "Cape Town, South Africa",
    timezone: "Africa/Johannesburg",
    inDays: 52,
    start: "18:00",
    end: "23:30",
    tags: ["Jazz", "Live music"],
    agenda: ["18:00 — Doors", "19:30 — Headline set", "22:00 — Jam session"],
    capacity: 900,
    tickets: [
      { name: "Weekend pass", price: 35_000, quantity: 600, fill: 0.35 },
      { name: "Livestream", price: 3_000, quantity: null, fill: 0.15 },
    ],
  },
  {
    org: "Vercel",
    title: "Next.js Conf",
    summary: "The Next.js team and community on the future of the web.",
    description: "A full day on rendering, caching and the tooling behind modern web apps, with real production stories and an open Q&A with the maintainers.",
    image: "/images/event3.png",
    category: "Conference",
    mode: "hybrid",
    venue: "Brooklyn Paramount",
    location: "New York, USA",
    timezone: "America/New_York",
    inDays: 12,
    start: "12:00",
    end: "18:00",
    tags: ["Next.js", "Web", "Developers"],
    agenda: ["12:00 — Keynote", "13:00 — Caching without the confusion", "14:30 — Migrating at scale", "16:00 — Maintainers Q&A"],
    capacity: 400,
    tickets: [
      { name: "Standard", price: 20_000, quantity: 300, fill: 0.6 },
      { name: "Premium", price: 45_000, quantity: 100, fill: 0.55 },
    ],
  },
  {
    org: "Ledger & Line",
    title: "Brand Design Workshop",
    summary: "A hands-on half day on logos, type and building a brand that holds together.",
    description: "Small-group workshop. You'll leave with a working brand sheet for your own project. Laptop optional, sketchbook recommended.",
    category: "Workshop",
    mode: "online",
    venue: "Zoom",
    location: "Online",
    timezone: "Europe/London",
    inDays: 9,
    start: "14:00",
    end: "17:00",
    tags: ["Design", "Branding"],
    agenda: ["14:00 — Foundations", "15:00 — Type and colour", "16:00 — Review"],
    capacity: 40,
    tickets: [{ name: "Seat", price: 15_000, quantity: 40, fill: 1 }],
  },
  {
    org: "Nairobi Community Day",
    title: "Nairobi Community Day",
    summary: "Meet your neighbours, share a meal and help with a local project.",
    description: "A free, family-friendly day of volunteering, food and music. Everyone welcome.",
    category: "Community",
    mode: "in-person",
    venue: "Uhuru Gardens",
    location: "Nairobi, Kenya",
    timezone: "Africa/Nairobi",
    inDays: 16,
    start: "09:00",
    end: "16:00",
    tags: ["Community", "Volunteering", "Family"],
    agenda: ["09:00 — Welcome", "10:00 — Volunteer teams", "13:00 — Shared lunch"],
    capacity: 300,
    tickets: [{ name: "Free entry", price: 0, quantity: null, fill: 0.3 }],
  },
  {
    org: "Amsterdam Meetups",
    title: "Founders Breakfast",
    summary: "Coffee, no slides, and an honest hour with other people building things.",
    description: "A relaxed monthly meetup for founders and makers. No pitches. Just coffee and conversation.",
    category: "Meetup",
    mode: "in-person",
    venue: "Lot Sixty One",
    location: "Amsterdam, Netherlands",
    timezone: "Europe/Amsterdam",
    inDays: 27,
    start: "08:30",
    end: "10:30",
    tags: ["Networking", "Founders"],
    agenda: ["08:30 — Coffee", "09:00 — Round table"],
    capacity: 40,
    tickets: [{ name: "Free entry", price: 0, quantity: null, fill: 0.5 }],
  },
];

const DAY = 86_400_000;

function dayString(offset: number, tz: string): string {
  const d = new Date(Date.now() + offset * DAY);
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

const NAMES = [
  "Ada Obi", "Kofi Mensah", "Mira Patel", "Tunde Bello", "Lena Fischer", "Sam Okafor", "Noor Rahman", "Ravi Shah",
  "Zainab Musa", "Leo Martins", "Amara Eze", "Chidi Nwosu", "Funmi Adeyemi", "Kwame Boateng", "Sade Johnson", "Ife Balogun",
];

export async function seedIfEmpty(db: Db): Promise<boolean> {
  const existing = await db.select({ id: users.id }).from(users).limit(1);
  if (existing.length) return false;

  const [demo] = await db.insert(users).values({ name: "Demo Organizer", email: DEMO_EMAIL, passwordHash: hashPassword(DEMO_PASSWORD) }).returning();
  const [guest] = await db.insert(users).values({ name: "Guest Attendee", email: ATTENDEE_EMAIL, passwordHash: hashPassword(DEMO_PASSWORD) }).returning();
  const [publisher] = await db.insert(users).values({ name: "Seed Publisher", email: "seed@stagegrid.dev", passwordHash: hashPassword(randomBytes(16).toString("hex")) }).returning();

  const orgIds = new Map<string, string>();
  for (const name of [...new Set(EVENTS.map((e) => e.org))]) {
    const isDemo = name === "Lagos Nights";
    const [org] = await db
      .insert(organizations)
      .values({
        name,
        slug: slugify(name),
        description: isDemo ? "Parties, live music and late nights across Lagos." : "",
        ...(isDemo
          ? {
              plan: "pro",
              planInterval: "monthly",
              planStatus: "active",
              currentPeriodEnd: new Date(Date.now() + 18 * DAY),
              billingProvider: "mock",
              subaccountCode: "ACCT_mock_0000",
              payoutBankName: "GTBank",
              payoutAccountName: "Lagos Nights",
              payoutAccountLast4: "0000",
            }
          : { subaccountCode: "ACCT_mock_0000" }),
      })
      .returning({ id: organizations.id });
    orgIds.set(name, org.id);
    await db.insert(memberships).values({ orgId: org.id, userId: isDemo ? demo.id : publisher.id, role: "owner" });
  }
  // Demo user is a plain member of one workspace to exercise role-based access.
  await db.insert(memberships).values({ orgId: orgIds.get("Detty Fest Co.")!, userId: demo.id, role: "member" });

  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  for (const e of EVENTS) {
    const date = dayString(e.inDays, e.timezone);
    const orgId = orgIds.get(e.org)!;
    const [ev] = await db
      .insert(events)
      .values({
        orgId,
        slug: slugify(e.title),
        title: e.title,
        summary: e.summary,
        description: e.description,
        image: e.image ?? categoryImage(e.category),
        mode: e.mode,
        venue: e.venue,
        location: e.location,
        timezone: e.timezone,
        startsAt: zonedToUtc(date, e.start, e.timezone),
        endsAt: e.end ? zonedToUtc(date, e.end, e.timezone) : null,
        category: e.category,
        tags: e.tags,
        agenda: e.agenda,
        capacity: e.capacity,
        status: e.status ?? "published",
        createdBy: orgId === orgIds.get("Lagos Nights") ? demo.id : publisher.id,
      })
      .returning({ id: events.id });

    const tiers = await db
      .insert(ticketTypes)
      .values(e.tickets.map((t, i) => ({ eventId: ev.id, name: t.name, price: t.price * 100, quantity: t.quantity, sortOrder: i })))
      .returning({ id: ticketTypes.id });

    const past = e.inDays < 0;
    let n = 0;
    for (const [i, t] of e.tickets.entries()) {
      const alloc = t.quantity ?? Math.min(e.capacity ?? 120, 120);
      const sold = Math.min(Math.round(alloc * t.fill), 70);
      const rows = Array.from({ length: sold }, (_, k) => {
        const name = NAMES[(n + k) % NAMES.length];
        const created = new Date(Date.now() - Math.floor(rand() * 28 * DAY) - (past ? Math.abs(e.inDays) * DAY : 0));
        return {
          eventId: ev.id,
          name,
          email: `${name.toLowerCase().replace(/[^a-z]/g, ".")}.${n + k}@example.com`,
          code: ticketCode(),
          ticketTypeId: tiers[i].id,
          amountPaid: t.price * 100,
          createdAt: created,
          checkedInAt: past && rand() < 0.75 ? new Date(created.getTime() + DAY) : null,
        };
      });
      n += sold;
      if (rows.length) await db.insert(bookings).values(rows);
    }
  }

  // Give the demo attendee some history across the 7-day / month / year windows.
  const picks = [
    { title: "Highlife Sessions Vol. 3", age: 24 + 20 }, // past event, booked ~6 weeks ago
    { title: "Comedy Open Mic", age: 2 },
    { title: "Sunset Pool Party", age: 9 },
    { title: "Jollof & Jazz Brunch", age: 16 },
    { title: "Next.js Conf", age: 130 },
  ];
  for (const p of picks) {
    const ev = EVENTS.find((e) => e.title === p.title)!;
    const [row] = await db.select({ id: events.id }).from(events).where(eq(events.slug, slugify(ev.title))).limit(1);
    const [tier] = await db.select().from(ticketTypes).where(eq(ticketTypes.eventId, row.id)).limit(1);
    await db.insert(bookings).values({
      eventId: row.id,
      userId: guest.id,
      name: guest.name,
      email: guest.email,
      code: ticketCode(),
      ticketTypeId: tier.id,
      amountPaid: tier.price,
      createdAt: new Date(Date.now() - p.age * DAY),
      checkedInAt: ev.inDays < 0 ? new Date(Date.now() - p.age * DAY + DAY) : null,
    });
  }
  return true;
}
