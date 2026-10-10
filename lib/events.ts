import "server-only";
import {
  and, asc, count, desc, eq, getTableColumns, gte, ilike, inArray, isNotNull, or, sql, sum, type SQL,
} from "drizzle-orm";
import { getDb, type Db } from "@/lib/db";
import { bookings, events, organizations, ticketTypes } from "@/lib/db/schema";
import { slugify } from "@/lib/utils";
import { parseList, type EventInput, type TicketInput } from "@/lib/validation";
import { zonedToUtc } from "@/lib/datetime";
import { PAGE_SIZE, type EventMode } from "@/lib/constants";
import { PLANS, isPlanId } from "@/lib/plans";
import { ticketCode } from "@/lib/tokens";

export interface TicketRecord {
  id: string;
  name: string;
  /** Minor units (kobo). 0 = free. */
  price: number;
  quantity: number | null;
  sold: number;
}

export interface EventRecord {
  id: string;
  orgId: string;
  orgName: string;
  orgSlug: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  image: string;
  mode: EventMode;
  venue: string;
  location: string;
  timezone: string;
  startsAt: string;
  endsAt: string | null;
  category: string;
  tags: string[];
  agenda: string[];
  /** Display name of the hosting organization. */
  organizer: string;
  capacity: number | null;
  status: "draft" | "published";
  createdAt: string;
  booked: number;
  /** Cheapest / dearest ticket in minor units. */
  minPrice: number;
  maxPrice: number;
  /** Only populated by getEventBySlug / getEventById. */
  tickets: TicketRecord[];
}

export const isFree = (e: Pick<EventRecord, "maxPrice">) => e.maxPrice === 0;

const bookedExpr = sql<number>`(select count(*)::int from ${bookings} where ${bookings.eventId} = "events"."id")`;
const minPriceExpr = sql<number>`coalesce((select min(${ticketTypes.price}) from ${ticketTypes} where ${ticketTypes.eventId} = "events"."id"), 0)::int`;
const maxPriceExpr = sql<number>`coalesce((select max(${ticketTypes.price}) from ${ticketTypes} where ${ticketTypes.eventId} = "events"."id"), 0)::int`;

// Qualified explicitly above: Drizzle drops table prefixes in single-table selects, which would make these self-referential.
const cols = {
  ...getTableColumns(events),
  booked: bookedExpr.as("booked"),
  minPrice: minPriceExpr.as("min_price"),
  maxPrice: maxPriceExpr.as("max_price"),
  orgName: organizations.name,
  orgSlug: organizations.slug,
};

type Row = typeof events.$inferSelect & { booked: number; minPrice: number; maxPrice: number; orgName: string; orgSlug: string };

function toEvent(r: Row, tickets: TicketRecord[] = []): EventRecord {
  return {
    id: r.id,
    orgId: r.orgId,
    orgName: r.orgName,
    orgSlug: r.orgSlug,
    slug: r.slug,
    title: r.title,
    summary: r.summary,
    description: r.description,
    image: r.image,
    mode: r.mode as EventMode,
    venue: r.venue,
    location: r.location,
    timezone: r.timezone,
    startsAt: r.startsAt.toISOString(),
    endsAt: r.endsAt ? r.endsAt.toISOString() : null,
    category: r.category,
    tags: r.tags,
    agenda: r.agenda,
    organizer: r.orgName,
    capacity: r.capacity,
    status: r.status === "published" ? "published" : "draft",
    createdAt: r.createdAt.toISOString(),
    booked: Number(r.booked ?? 0),
    minPrice: Number(r.minPrice ?? 0),
    maxPrice: Number(r.maxPrice ?? 0),
    tickets,
  };
}

function base(db: Db) {
  return db.select(cols).from(events).innerJoin(organizations, eq(organizations.id, events.orgId));
}

async function loadTickets(db: Db, eventId: string): Promise<TicketRecord[]> {
  const rows = await db
    .select({
      id: ticketTypes.id,
      name: ticketTypes.name,
      price: ticketTypes.price,
      quantity: ticketTypes.quantity,
      sold: sql<number>`(select count(*)::int from ${bookings} where ${bookings.ticketTypeId} = "ticket_types"."id")`,
    })
    .from(ticketTypes)
    .where(eq(ticketTypes.eventId, eventId))
    .orderBy(asc(ticketTypes.sortOrder));
  return rows.map((r) => ({ ...r, sold: Number(r.sold) }));
}

export function spotsLeft(e: Pick<EventRecord, "capacity" | "booked">): number | null {
  return e.capacity == null ? null : Math.max(0, e.capacity - e.booked);
}

export function hasEnded(e: Pick<EventRecord, "startsAt" | "endsAt">, now = Date.now()) {
  return new Date(e.endsAt ?? e.startsAt).getTime() < now;
}

/** Shape returned from the public API. */
export function publicEvent(e: EventRecord) {
  const { orgId, ...rest } = e;
  void orgId;
  return rest;
}

const escapeLike = (q: string) => `%${q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/* ---------------------------------- queries --------------------------------- */

export interface ListParams {
  q?: string;
  category?: string;
  mode?: string;
  price?: "free" | "paid";
  when?: "upcoming" | "past" | "all";
  page?: number;
  pageSize?: number;
  /** Restrict to one organization. */
  orgId?: string;
  /** Include drafts (organizer views only). */
  includeDrafts?: boolean;
  status?: "draft" | "published";
}

export async function listEvents(params: ListParams = {}) {
  const { q, category, mode, price, when = "upcoming", page = 1, pageSize = PAGE_SIZE, orgId, includeDrafts, status } = params;
  const db = await getDb();
  const where: (SQL | undefined)[] = [];
  const now = new Date();

  if (!includeDrafts) where.push(eq(events.status, "published"));
  if (status) where.push(eq(events.status, status));
  if (orgId) where.push(eq(events.orgId, orgId));
  if (category) where.push(eq(events.category, category));
  if (mode) where.push(eq(events.mode, mode));
  if (price === "free") where.push(sql`${maxPriceExpr} = 0`);
  if (price === "paid") where.push(sql`${maxPriceExpr} > 0`);
  if (q?.trim()) {
    const like = escapeLike(q);
    where.push(
      or(
        ilike(events.title, like),
        ilike(events.summary, like),
        ilike(events.location, like),
        ilike(events.venue, like),
        ilike(organizations.name, like),
        ilike(events.category, like),
        sql`array_to_string(${events.tags}, ' ') ilike ${like}`,
      ),
    );
  }
  const endExpr = sql`coalesce(${events.endsAt}, ${events.startsAt})`;
  if (when === "upcoming") where.push(sql`${endExpr} >= ${now}`);
  else if (when === "past") where.push(sql`${endExpr} < ${now}`);

  const clause = and(...where);
  const [{ n }] = await db
    .select({ n: count() })
    .from(events)
    .innerJoin(organizations, eq(organizations.id, events.orgId))
    .where(clause);
  const total = Number(n);
  const safePage = Math.max(1, page);

  const rows = await base(db)
    .where(clause)
    .orderBy(when === "past" ? desc(events.startsAt) : asc(events.startsAt))
    .limit(pageSize)
    .offset((safePage - 1) * pageSize);

  return {
    items: rows.map((r) => toEvent(r as Row)),
    total,
    page: safePage,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getEventBySlug(slug: string): Promise<EventRecord | null> {
  const db = await getDb();
  const [row] = await base(db).where(eq(events.slug, slug)).limit(1);
  return row ? toEvent(row as Row, await loadTickets(db, row.id)) : null;
}

export async function getEventById(id: string): Promise<EventRecord | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = await getDb();
  const [row] = await base(db).where(eq(events.id, id)).limit(1);
  return row ? toEvent(row as Row, await loadTickets(db, row.id)) : null;
}

export async function getRelatedEvents(event: EventRecord, limit = 3): Promise<EventRecord[]> {
  const db = await getDb();
  const rows = await base(db)
    .where(
      and(
        eq(events.status, "published"),
        sql`${events.id} != ${event.id}`,
        sql`coalesce(${events.endsAt}, ${events.startsAt}) >= ${new Date()}`,
      ),
    )
    .orderBy(sql`(${events.category} = ${event.category}) desc`, sql`(${events.mode} = ${event.mode}) desc`, asc(events.startsAt))
    .limit(limit);
  return rows.map((r) => toEvent(r as Row));
}

export async function getAllSlugs(): Promise<{ slug: string; updatedAt: string }[]> {
  const db = await getDb();
  const rows = await db.select({ slug: events.slug, updatedAt: events.updatedAt }).from(events).where(eq(events.status, "published"));
  return rows.map((r) => ({ slug: r.slug, updatedAt: r.updatedAt.toISOString() }));
}

export async function getStats() {
  const db = await getDb();
  const live = and(eq(events.status, "published"), sql`coalesce(${events.endsAt}, ${events.startsAt}) >= ${new Date()}`);
  const [up] = await db.select({ n: count(), places: sql<number>`count(distinct ${events.location})::int` }).from(events).where(live);
  const [seats] = await db.select({ n: count() }).from(bookings);
  const [orgs] = await db.select({ n: count() }).from(organizations);
  return { upcoming: Number(up.n), locations: Number(up.places), bookings: Number(seats.n), organizations: Number(orgs.n) };
}

export async function categoryCounts(): Promise<{ category: string; count: number }[]> {
  const db = await getDb();
  const rows = await db
    .select({ category: events.category, n: count() })
    .from(events)
    .where(and(eq(events.status, "published"), sql`coalesce(${events.endsAt}, ${events.startsAt}) >= ${new Date()}`))
    .groupBy(events.category)
    .orderBy(desc(count()));
  return rows.map((r) => ({ category: r.category, count: Number(r.n) }));
}

/* ---------------------------------- writes ---------------------------------- */

const RESERVED_SLUGS = new Set(["new", "edit"]);

async function uniqueSlug(title: string, ignoreId?: string): Promise<string> {
  const db = await getDb();
  let root = slugify(title) || "event";
  if (RESERVED_SLUGS.has(root)) root = `${root}-event`;
  let candidate = root;
  for (let i = 2; ; i++) {
    const [hit] = await db.select({ id: events.id }).from(events).where(eq(events.slug, candidate)).limit(1);
    if (!hit || hit.id === ignoreId) return candidate;
    candidate = `${root}-${i}`;
  }
}

function toValues(input: EventInput) {
  const start = zonedToUtc(input.date, input.startTime, input.timezone);
  const end = input.endTime ? zonedToUtc(input.date, input.endTime, input.timezone) : null;
  return {
    title: input.title,
    summary: input.summary,
    description: input.description,
    image: input.image,
    mode: input.mode,
    venue: input.venue,
    location: input.location,
    timezone: input.timezone,
    startsAt: start,
    endsAt: end,
    category: input.category,
    tags: parseList(input.tags, /[,\n]/, 8),
    agenda: parseList(input.agenda, /\n/, 20),
    capacity: input.capacity,
  };
}

const toMinor = (naira: number) => Math.round(naira * 100);

export async function createEvent(input: EventInput, ctx: { orgId: string; userId: string }): Promise<EventRecord> {
  const db = await getDb();
  const slug = await uniqueSlug(input.title);
  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(events)
      .values({ ...toValues(input), slug, orgId: ctx.orgId, createdBy: ctx.userId, status: input.intent === "draft" ? "draft" : "published" })
      .returning({ id: events.id });
    await tx.insert(ticketTypes).values(
      input.tickets.map((t, i) => ({ eventId: row.id, name: t.name, price: toMinor(t.price), quantity: t.quantity, sortOrder: i })),
    );
    return row.id;
  });
  return (await getEventById(id))!;
}

/**
 * Tiers that already have sales can't be removed or repriced (that would change what
 * buyers agreed to), and quantity can't drop below what's sold.
 */
export async function validateTicketEdit(eventId: string, next: TicketInput[]): Promise<string | null> {
  const db = await getDb();
  const current = await loadTickets(db, eventId);
  for (const t of current) {
    if (t.sold === 0) continue;
    const match = next.find((n) => n.name.toLowerCase() === t.name.toLowerCase());
    if (!match) return `"${t.name}" already has ${t.sold} sale${t.sold === 1 ? "" : "s"}, so it can't be removed.`;
    if (toMinor(match.price) !== t.price) return `"${t.name}" has sales, so its price can't change. Add a new ticket type instead.`;
    if (match.quantity != null && match.quantity < t.sold) return `"${t.name}" has ${t.sold} sold; quantity can't go lower.`;
  }
  return null;
}

export async function updateEvent(id: string, input: EventInput): Promise<EventRecord> {
  const db = await getDb();
  const existing = (await getEventById(id))!;
  const values = toValues(input);
  const slug = existing.title === values.title ? existing.slug : await uniqueSlug(values.title, id);

  await db.transaction(async (tx) => {
    await tx
      .update(events)
      .set({ ...values, slug, status: input.intent === "draft" ? "draft" : "published", updatedAt: new Date() })
      .where(eq(events.id, id));

    const keep = new Set<string>();
    for (const [i, t] of input.tickets.entries()) {
      const match = existing.tickets.find((e) => e.name.toLowerCase() === t.name.toLowerCase());
      if (match) {
        keep.add(match.id);
        await tx
          .update(ticketTypes)
          .set({ name: t.name, price: toMinor(t.price), quantity: t.quantity, sortOrder: i })
          .where(eq(ticketTypes.id, match.id));
      } else {
        await tx.insert(ticketTypes).values({ eventId: id, name: t.name, price: toMinor(t.price), quantity: t.quantity, sortOrder: i });
      }
    }
    const drop = existing.tickets.filter((t) => !keep.has(t.id)).map((t) => t.id);
    if (drop.length) await tx.delete(ticketTypes).where(inArray(ticketTypes.id, drop));
  });
  return (await getEventById(id))!;
}

export async function setEventStatus(id: string, status: "draft" | "published") {
  const db = await getDb();
  await db.update(events).set({ status, updatedAt: new Date() }).where(eq(events.id, id));
}

export async function duplicateEvent(id: string, userId: string): Promise<EventRecord | null> {
  const db = await getDb();
  const src = await getEventById(id);
  if (!src) return null;
  const slug = await uniqueSlug(`${src.title} copy`);
  const week = 7 * 86_400_000;
  const newId = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(events)
      .values({
        orgId: src.orgId,
        slug,
        title: `${src.title} (copy)`,
        summary: src.summary,
        description: src.description,
        image: src.image,
        mode: src.mode,
        venue: src.venue,
        location: src.location,
        timezone: src.timezone,
        startsAt: new Date(new Date(src.startsAt).getTime() + week),
        endsAt: src.endsAt ? new Date(new Date(src.endsAt).getTime() + week) : null,
        category: src.category,
        tags: src.tags,
        agenda: src.agenda,
        capacity: src.capacity,
        status: "draft",
        createdBy: userId,
      })
      .returning({ id: events.id });
    if (src.tickets.length) {
      await tx.insert(ticketTypes).values(src.tickets.map((t, i) => ({ eventId: row.id, name: t.name, price: t.price, quantity: t.quantity, sortOrder: i })));
    }
    return row.id;
  });
  return getEventById(newId);
}

export async function deleteEvent(id: string) {
  const db = await getDb();
  await db.delete(events).where(eq(events.id, id));
}

/* --------------------------------- bookings --------------------------------- */

export interface BookingRecord {
  id: string;
  eventId: string;
  name: string;
  email: string;
  code: string;
  ticketTypeId: string | null;
  amountPaid: number;
  checkedInAt: string | null;
  createdAt: string;
}

function toBooking(r: typeof bookings.$inferSelect): BookingRecord {
  return {
    id: r.id,
    eventId: r.eventId,
    name: r.name,
    email: r.email,
    code: r.code,
    ticketTypeId: r.ticketTypeId,
    amountPaid: r.amountPaid,
    checkedInAt: r.checkedInAt ? r.checkedInAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  };
}

export type BookFailure = "not_found" | "ended" | "sold_out" | "tier_sold_out" | "duplicate" | "plan_limit" | "payment_required";
export type BookResult = { ok: true; booking: BookingRecord } | { ok: false; reason: BookFailure };

export interface BookOptions {
  ticketTypeId?: string;
  /** Set when a paid order was settled; free bookings must not pass this. */
  orderId?: string;
  amountPaid?: number;
}

/**
 * Reserve one seat inside a transaction. The event row is locked so concurrent buyers
 * can't oversell the event or a ticket tier.
 */
export async function bookEvent(
  eventId: string,
  attendee: { name: string; email: string; userId: string | null },
  opts: BookOptions = {},
): Promise<BookResult> {
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) return { ok: false, reason: "not_found" };
  const db = await getDb();
  return db.transaction(async (tx): Promise<BookResult> => {
    const [ev] = await tx
      .select({
        id: events.id,
        capacity: events.capacity,
        status: events.status,
        startsAt: events.startsAt,
        endsAt: events.endsAt,
        plan: organizations.plan,
        periodEnd: organizations.currentPeriodEnd,
      })
      .from(events)
      .innerJoin(organizations, eq(organizations.id, events.orgId))
      .where(eq(events.id, eventId))
      .for("update", { of: events });
    if (!ev || ev.status !== "published") return { ok: false, reason: "not_found" };
    if ((ev.endsAt ?? ev.startsAt).getTime() < Date.now()) return { ok: false, reason: "ended" };

    const [dupe] = await tx
      .select({ id: bookings.id })
      .from(bookings)
      .where(
        and(
          eq(bookings.eventId, eventId),
          attendee.userId
            ? or(eq(bookings.userId, attendee.userId), sql`lower(${bookings.email}) = ${attendee.email.toLowerCase()}`)
            : sql`lower(${bookings.email}) = ${attendee.email.toLowerCase()}`,
        ),
      )
      .limit(1);
    if (dupe) return { ok: false, reason: "duplicate" };

    const tiers = await tx.select().from(ticketTypes).where(eq(ticketTypes.eventId, eventId)).orderBy(asc(ticketTypes.sortOrder));
    const tier = opts.ticketTypeId ? tiers.find((t) => t.id === opts.ticketTypeId) : tiers[0];
    if (!tier) return { ok: false, reason: "not_found" };
    if (tier.price > 0 && !opts.orderId) return { ok: false, reason: "payment_required" };

    const [{ n }] = await tx.select({ n: count() }).from(bookings).where(eq(bookings.eventId, eventId));
    const taken = Number(n);
    if (ev.capacity != null && taken >= ev.capacity) return { ok: false, reason: "sold_out" };

    if (tier.quantity != null) {
      const [{ s }] = await tx.select({ s: count() }).from(bookings).where(eq(bookings.ticketTypeId, tier.id));
      if (Number(s) >= tier.quantity) return { ok: false, reason: "tier_sold_out" };
    }

    const planId = isPlanId(ev.plan) ? ev.plan : "free";
    const lapsed = planId !== "free" && ev.periodEnd && ev.periodEnd.getTime() + 3 * 86_400_000 < Date.now();
    const cap = PLANS[lapsed ? "free" : planId].limits.attendeesPerEvent;
    if (cap != null && taken >= cap) return { ok: false, reason: "plan_limit" };

    const [row] = await tx
      .insert(bookings)
      .values({
        eventId,
        userId: attendee.userId,
        name: attendee.name,
        email: attendee.email.toLowerCase(),
        code: ticketCode(),
        ticketTypeId: tier.id,
        orderId: opts.orderId,
        amountPaid: opts.amountPaid ?? 0,
      })
      .returning();
    return { ok: true, booking: toBooking(row) };
  });
}

/** Cheap pre-flight for checkout so people aren't sent to pay for a ticket that's gone. */
export async function ticketAvailability(eventId: string, ticketTypeId: string): Promise<BookFailure | null> {
  const ev = await getEventById(eventId);
  if (!ev || ev.status !== "published") return "not_found";
  if (hasEnded(ev)) return "ended";
  const tier = ev.tickets.find((t) => t.id === ticketTypeId);
  if (!tier) return "not_found";
  if (ev.capacity != null && ev.booked >= ev.capacity) return "sold_out";
  if (tier.quantity != null && tier.sold >= tier.quantity) return "tier_sold_out";
  return null;
}

const sameAttendee = (userId: string, email: string) =>
  or(eq(bookings.userId, userId), sql`lower(${bookings.email}) = ${email.toLowerCase()}`);

/** Only free bookings can be cancelled here; paid ones go through the organizer (refunds). */
export async function cancelBooking(eventId: string, userId: string, email: string) {
  const db = await getDb();
  await db.delete(bookings).where(and(eq(bookings.eventId, eventId), eq(bookings.amountPaid, 0), sameAttendee(userId, email)));
}

export async function findBooking(eventId: string, userId: string, email: string): Promise<BookingRecord | null> {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.eventId, eventId), sameAttendee(userId, email)))
    .limit(1);
  return row ? toBooking(row) : null;
}

export async function listAttendees(eventId: string, q?: string): Promise<(BookingRecord & { ticketName: string | null })[]> {
  const db = await getDb();
  const like = q?.trim() ? escapeLike(q) : null;
  const rows = await db
    .select({ b: bookings, ticketName: ticketTypes.name })
    .from(bookings)
    .leftJoin(ticketTypes, eq(ticketTypes.id, bookings.ticketTypeId))
    .where(
      and(
        eq(bookings.eventId, eventId),
        like ? or(ilike(bookings.name, like), ilike(bookings.email, like), ilike(bookings.code, like)) : undefined,
      ),
    )
    .orderBy(asc(bookings.createdAt));
  return rows.map((r) => ({ ...toBooking(r.b), ticketName: r.ticketName }));
}

export interface OrgAttendee extends BookingRecord {
  eventTitle: string;
  eventSlug: string;
  ticketName: string | null;
}

export async function listOrgAttendees(orgId: string, opts: { q?: string; page?: number; pageSize?: number } = {}) {
  const { q, page = 1, pageSize = 25 } = opts;
  const db = await getDb();
  const like = q?.trim() ? escapeLike(q) : null;
  const clause = and(
    eq(events.orgId, orgId),
    like ? or(ilike(bookings.name, like), ilike(bookings.email, like), ilike(bookings.code, like), ilike(events.title, like)) : undefined,
  );
  const [{ n }] = await db.select({ n: count() }).from(bookings).innerJoin(events, eq(events.id, bookings.eventId)).where(clause);
  const rows = await db
    .select({ b: bookings, title: events.title, slug: events.slug, ticketName: ticketTypes.name })
    .from(bookings)
    .innerJoin(events, eq(events.id, bookings.eventId))
    .leftJoin(ticketTypes, eq(ticketTypes.id, bookings.ticketTypeId))
    .where(clause)
    .orderBy(desc(bookings.createdAt))
    .limit(pageSize)
    .offset((Math.max(1, page) - 1) * pageSize);
  return {
    items: rows.map((r): OrgAttendee => ({ ...toBooking(r.b), eventTitle: r.title, eventSlug: r.slug, ticketName: r.ticketName })),
    total: Number(n),
    pageCount: Math.max(1, Math.ceil(Number(n) / pageSize)),
  };
}

async function ownedBooking(bookingId: string, orgId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) return null;
  const db = await getDb();
  const [row] = await db
    .select({ id: bookings.id, at: bookings.checkedInAt, paid: bookings.amountPaid })
    .from(bookings)
    .innerJoin(events, eq(events.id, bookings.eventId))
    .where(and(eq(bookings.id, bookingId), eq(events.orgId, orgId)))
    .limit(1);
  return row ?? null;
}

/** Scoped to the org so ids from other tenants can't be touched. */
export async function toggleCheckIn(bookingId: string, orgId: string) {
  const row = await ownedBooking(bookingId, orgId);
  if (!row) return;
  const db = await getDb();
  await db.update(bookings).set({ checkedInAt: row.at ? null : new Date() }).where(eq(bookings.id, row.id));
}

/** Removes a free registration. Paid tickets are refunded through Paystack, not deleted. */
export async function removeBooking(bookingId: string, orgId: string): Promise<boolean> {
  const row = await ownedBooking(bookingId, orgId);
  if (!row || row.paid > 0) return false;
  const db = await getDb();
  await db.delete(bookings).where(eq(bookings.id, row.id));
  return true;
}

export interface HistoryItem extends EventRecord {
  ticketCode: string;
  ticketName: string | null;
  amountPaid: number;
  bookedAt: string;
}

/** An attendee's bookings, newest first, optionally limited to the last `sinceDays` days. */
export async function listBookingHistory(userId: string, email: string, sinceDays?: number): Promise<HistoryItem[]> {
  const db = await getDb();
  const since = sinceDays ? new Date(Date.now() - sinceDays * 86_400_000) : null;
  const rows = await db
    .select({
      ...cols,
      ticketCode: bookings.code,
      ticketName: ticketTypes.name,
      amountPaid: bookings.amountPaid,
      bookedAt: bookings.createdAt,
    })
    .from(bookings)
    .innerJoin(events, eq(events.id, bookings.eventId))
    .innerJoin(organizations, eq(organizations.id, events.orgId))
    .leftJoin(ticketTypes, eq(ticketTypes.id, bookings.ticketTypeId))
    .where(and(sameAttendee(userId, email), since ? gte(bookings.createdAt, since) : undefined))
    .orderBy(desc(bookings.createdAt));
  return rows.map((r) => ({
    ...toEvent(r as Row),
    ticketCode: r.ticketCode,
    ticketName: r.ticketName,
    amountPaid: r.amountPaid,
    bookedAt: r.bookedAt.toISOString(),
  }));
}

/* -------------------------------- reminders -------------------------------- */

export async function dueReminders(windowHours = 24) {
  const db = await getDb();
  const now = new Date();
  const horizon = new Date(now.getTime() + windowHours * 3_600_000);
  const rows = await db
    .select({ b: bookings, ev: events, orgName: organizations.name, ticketName: ticketTypes.name })
    .from(bookings)
    .innerJoin(events, eq(events.id, bookings.eventId))
    .innerJoin(organizations, eq(organizations.id, events.orgId))
    .leftJoin(ticketTypes, eq(ticketTypes.id, bookings.ticketTypeId))
    .where(and(eq(events.status, "published"), gte(events.startsAt, now), sql`${events.startsAt} <= ${horizon}`, sql`${bookings.reminderSentAt} is null`))
    .limit(500);
  return rows.map((r) => ({
    bookingId: r.b.id,
    name: r.b.name,
    email: r.b.email,
    code: r.b.code,
    ticketName: r.ticketName,
    title: r.ev.title,
    slug: r.ev.slug,
    startsAt: r.ev.startsAt.toISOString(),
    timezone: r.ev.timezone,
    venue: r.ev.venue,
    location: r.ev.location,
    orgName: r.orgName,
  }));
}

export async function markReminded(ids: string[]) {
  if (!ids.length) return;
  const db = await getDb();
  await db.update(bookings).set({ reminderSentAt: new Date() }).where(inArray(bookings.id, ids));
}

/** Everyone holding a ticket, for event-wide notices (e.g. cancellation). */
export async function attendeeEmails(eventId: string) {
  const db = await getDb();
  const rows = await db.select({ name: bookings.name, email: bookings.email, paid: bookings.amountPaid }).from(bookings).where(eq(bookings.eventId, eventId));
  return rows;
}

export async function paidOrderCount(eventId: string): Promise<number> {
  const db = await getDb();
  const [r] = await db.select({ n: count() }).from(bookings).where(and(eq(bookings.eventId, eventId), isNotNull(bookings.orderId)));
  return Number(r.n);
}

/* -------------------------------- org analytics ------------------------------- */

export async function registrationsByDay(orgId: string, days = 30): Promise<{ day: string; n: number }[]> {
  const db = await getDb();
  const since = new Date(Date.now() - (days - 1) * 86_400_000);
  since.setUTCHours(0, 0, 0, 0);
  const dayExpr = sql<string>`to_char(date_trunc('day', ${bookings.createdAt} at time zone 'UTC'), 'YYYY-MM-DD')`;
  const rows = await db
    .select({ day: dayExpr, n: count() })
    .from(bookings)
    .innerJoin(events, eq(events.id, bookings.eventId))
    .where(and(eq(events.orgId, orgId), gte(bookings.createdAt, since)))
    .groupBy(dayExpr);
  const map = new Map(rows.map((r) => [r.day, Number(r.n)]));
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(since.getTime() + i * 86_400_000).toISOString().slice(0, 10);
    return { day: d, n: map.get(d) ?? 0 };
  });
}

export async function orgTotals(orgId: string) {
  const db = await getDb();
  const [r] = await db
    .select({
      registrations: count(bookings.id),
      checkedIn: sql<number>`count(${bookings.checkedInAt})::int`,
      revenue: sql<number>`coalesce(sum(${bookings.amountPaid}), 0)::bigint`,
    })
    .from(events)
    .leftJoin(bookings, eq(bookings.eventId, events.id))
    .where(eq(events.orgId, orgId));
  const [e] = await db
    .select({
      total: count(),
      drafts: sql<number>`count(*) filter (where ${events.status} = 'draft')::int`,
      upcoming: sql<number>`count(*) filter (where ${events.status} = 'published' and coalesce(${events.endsAt}, ${events.startsAt}) >= now())::int`,
    })
    .from(events)
    .where(eq(events.orgId, orgId));
  return {
    registrations: Number(r.registrations),
    checkedIn: Number(r.checkedIn),
    revenue: Number(r.revenue),
    events: Number(e.total),
    drafts: Number(e.drafts),
    upcoming: Number(e.upcoming),
  };
}

export async function eventRevenue(eventId: string): Promise<number> {
  const db = await getDb();
  const [r] = await db.select({ s: sum(bookings.amountPaid) }).from(bookings).where(eq(bookings.eventId, eventId));
  return Number(r.s ?? 0);
}

export async function topEvents(orgId: string, limit = 5) {
  const db = await getDb();
  const rows = await db
    .select({ title: events.title, slug: events.slug, capacity: events.capacity, booked: bookedExpr })
    .from(events)
    .where(eq(events.orgId, orgId))
    .orderBy(desc(bookedExpr))
    .limit(limit);
  return rows.map((r) => ({ ...r, booked: Number(r.booked) }));
}
