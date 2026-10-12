import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const createdAt = () => ts("created_at").notNull().defaultNow();

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_email_idx").on(sql`lower(${t.email})`)],
);

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description").notNull().default(""),
    website: text("website").notNull().default(""),
    logoUrl: text("logo_url").notNull().default(""),

    plan: text("plan").notNull().default("free"),
    planInterval: text("plan_interval").notNull().default("monthly"),
    planStatus: text("plan_status").notNull().default("active"),
    currentPeriodEnd: ts("current_period_end"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    billingProvider: text("billing_provider"),
    billingCustomerCode: text("billing_customer_code"),
    subscriptionCode: text("subscription_code"),
    subscriptionToken: text("subscription_token"),

    payoutBankName: text("payout_bank_name"),
    payoutAccountLast4: text("payout_account_last4"),
    payoutAccountName: text("payout_account_name"),
    subaccountCode: text("subaccount_code"),

    createdAt: createdAt(),
  },
  (t) => [index("orgs_customer_idx").on(t.billingCustomerCode)],
);

export const memberships = pgTable(
  "memberships",
  {
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.userId] }), index("memberships_user_idx").on(t.userId)],
);

export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
    expiresAt: ts("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("invitations_org_idx").on(t.orgId)],
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    description: text("description").notNull(),
    image: text("image").notNull(),
    mode: text("mode").notNull(),
    venue: text("venue").notNull().default(""),
    location: text("location").notNull(),
    timezone: text("timezone").notNull(),
    startsAt: ts("starts_at").notNull(),
    endsAt: ts("ends_at"),
    category: text("category").notNull(),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    agenda: text("agenda").array().notNull().default(sql`'{}'::text[]`),
    capacity: integer("capacity"),
    status: text("status").notNull().default("draft"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("events_org_idx").on(t.orgId),
    index("events_starts_idx").on(t.startsAt),
    index("events_status_idx").on(t.status),
  ],
);

export const ticketTypes = pgTable(
  "ticket_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    price: integer("price").notNull().default(0),
    quantity: integer("quantity"),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("ticket_types_event_idx").on(t.eventId)],
);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    code: text("code").notNull(),
    ticketTypeId: uuid("ticket_type_id").references(() => ticketTypes.id, { onDelete: "set null" }),
    orderId: uuid("order_id"),
    amountPaid: integer("amount_paid").notNull().default(0),
    checkedInAt: ts("checked_in_at"),
    reminderSentAt: ts("reminder_sent_at"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("bookings_event_email_idx").on(t.eventId, sql`lower(${t.email})`),
    index("bookings_user_idx").on(t.userId),
    index("bookings_created_idx").on(t.createdAt),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull().unique(),
    eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "restrict" }),
    ticketTypeId: uuid("ticket_type_id").references(() => ticketTypes.id, { onDelete: "set null" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    platformFee: integer("platform_fee").notNull().default(0),
    currency: text("currency").notNull().default("NGN"),
    status: text("status").notNull().default("pending"),
    createdAt: createdAt(),
    paidAt: ts("paid_at"),
  },
  (t) => [index("orders_event_idx").on(t.eventId), index("orders_user_idx").on(t.userId)],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    reference: text("reference").notNull().unique(),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    plan: text("plan").notNull(),
    interval: text("interval").notNull(),
    status: text("status").notNull(),
    paidAt: ts("paid_at").notNull().defaultNow(),
  },
  (t) => [index("payments_org_idx").on(t.orgId)],
);

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    prefix: text("prefix").notNull(),
    hash: text("hash").notNull().unique(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    lastUsedAt: ts("last_used_at"),
    createdAt: createdAt(),
  },
  (t) => [index("api_keys_org_idx").on(t.orgId)],
);

export const passwordResets = pgTable("password_resets", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: ts("expires_at").notNull(),
  usedAt: ts("used_at"),
  createdAt: createdAt(),
});

export const webhookEvents = pgTable("webhook_events", {
  key: text("key").primaryKey(),
  receivedAt: createdAt(),
});
