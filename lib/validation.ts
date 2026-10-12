import { z } from "zod";
import { CATEGORIES, MODES } from "@/lib/constants";
import { isValidTimeZone, zonedToUtc } from "@/lib/datetime";

const trimmed = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, min === 1 ? `${label} is required` : `${label} must be at least ${min} characters`)
    .max(max, `${label} must be ${max} characters or fewer`);

const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(120);

export const signupSchema = z.object({
  name: trimmed(2, 60, "Name"),
  email,
  password: z.string().min(8, "Password must be at least 8 characters").max(100, "Password is too long"),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password"),
});

export const forgotSchema = z.object({ email });

export const resetSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters").max(100, "Password is too long"),
});

export const bookingSchema = z.object({ name: trimmed(2, 60, "Name"), email });

export const orgSchema = z.object({
  name: trimmed(2, 60, "Organization name"),
});

export const orgSettingsSchema = z.object({
  name: trimmed(2, 60, "Organization name"),
  description: z.string().trim().max(300, "Keep it under 300 characters").default(""),
  website: z
    .string()
    .trim()
    .refine((v) => v === "" || /^https?:\/\/.+\..+/i.test(v), "Use a full URL, e.g. https://example.com")
    .default(""),
  logoUrl: z
    .string()
    .trim()
    .refine((v) => v === "" || /^https:\/\/.+/i.test(v), "Logo must be an https:// image URL")
    .default(""),
});

export const inviteSchema = z.object({
  email,
  role: z.enum(["admin", "member"], { message: "Choose a role" }),
});

export const payoutSchema = z.object({
  bankCode: z.string().trim().min(1, "Choose your bank"),
  accountNumber: z.string().trim().regex(/^\d{10}$/, "Account numbers are 10 digits"),
  businessMobile: z.string().trim().regex(/^\+?\d{10,15}$/, "Enter a phone number, e.g. 08012345678"),
});

export const apiKeySchema = z.object({ name: trimmed(2, 40, "Key name") });

const optionalInt = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : Number(v)))
  .pipe(z.number().int("Must be a whole number").min(1, "Must be at least 1").max(100_000).nullable());

const imageField = z
  .string()
  .trim()
  .min(1, "Choose a cover image")
  .refine((v) => v.startsWith("/images/") || /^https:\/\/.+/i.test(v), "Use a bundled cover or an https:// image URL")
  .refine((v) => v.length <= 500, "Image URL is too long");

export interface TicketInput {
  name: string;
  price: number;
  quantity: number | null;
}

const ticketItem = z.object({
  name: z.string().trim().min(2, "Name each ticket (2+ characters)").max(40, "Ticket names are 40 characters max"),
  price: z.coerce.number({ message: "Enter a price" }).int("Whole naira only").min(0).max(5_000_000, "Price is too high"),
  quantity: z
    .union([z.literal(""), z.null(), z.coerce.number().int("Whole numbers only").min(1, "At least 1").max(100_000)])
    .transform((v) => (v === "" || v === null ? null : v)),
});

const ticketsField = z
  .string()
  .default("")
  .transform((raw, ctx): TicketInput[] => {
    if (!raw.trim()) return [{ name: "General admission", price: 0, quantity: null }];
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      ctx.addIssue({ code: "custom", message: "Tickets couldn't be read. Reload and try again." });
      return z.NEVER;
    }
    const parsed = z.array(ticketItem).min(1, "Add at least one ticket").max(6, "Up to 6 ticket types").safeParse(json);
    if (!parsed.success) {
      ctx.addIssue({ code: "custom", message: parsed.error.issues[0]?.message ?? "Check your tickets" });
      return z.NEVER;
    }
    const names = new Set(parsed.data.map((t) => t.name.toLowerCase()));
    if (names.size !== parsed.data.length) {
      ctx.addIssue({ code: "custom", message: "Each ticket needs a different name" });
      return z.NEVER;
    }
    return parsed.data;
  });

export const eventSchema = z
  .object({
    title: trimmed(4, 100, "Title"),
    summary: trimmed(10, 200, "Summary"),
    description: trimmed(30, 5000, "Description"),
    image: imageField,
    mode: z.enum(MODES, { message: "Choose how people attend" }),
    venue: z.string().trim().max(120).default(""),
    location: trimmed(2, 120, "Location"),
    timezone: z.string().refine(isValidTimeZone, "Pick a valid timezone"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "Pick a start time"),
    endTime: z
      .string()
      .trim()
      .refine((v) => v === "" || /^\d{2}:\d{2}$/.test(v), "Invalid end time"),
    category: z.enum(CATEGORIES, { message: "Choose a category" }),
    tags: z.string().trim().max(200).default(""),
    agenda: z.string().trim().max(2000).default(""),
    capacity: optionalInt,
    tickets: ticketsField,
    intent: z.enum(["publish", "draft"]).default("publish"),
  })
  .superRefine((v, ctx) => {
    if (!isValidTimeZone(v.timezone) || !/^\d{4}-\d{2}-\d{2}$/.test(v.date)) return;
    const start = zonedToUtc(v.date, v.startTime, v.timezone);
    if (Number.isNaN(start.getTime())) {
      ctx.addIssue({ code: "custom", path: ["date"], message: "Pick a valid date" });
      return;
    }
    if (v.endTime && v.endTime <= v.startTime) {
      ctx.addIssue({ code: "custom", path: ["endTime"], message: "End time must be after the start" });
    }
  });

export type EventInput = z.output<typeof eventSchema>;

export function parseList(raw: string, separator: RegExp, max: number): string[] {
  return raw
    .split(separator)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max);
}

export type FieldErrors = Record<string, string[] | undefined>;

export function flattenErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    (out[key] ??= []).push(issue.message);
  }
  return out;
}
