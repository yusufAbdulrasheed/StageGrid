import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/utils";
import { utcToZonedParts, zonedToUtc } from "@/lib/datetime";
import { hashPassword, verifyPassword } from "@/lib/password";
import { eventSchema, signupSchema } from "@/lib/validation";
import { safeNext } from "@/lib/auth-paths";

describe("slugify", () => {
  it("normalises titles", () => {
    expect(slugify("Next.js Conf — 2025!")).toBe("next-js-conf-2025");
    expect(slugify("Café & Code")).toBe("cafe-and-code");
  });
});

describe("timezones", () => {
  it("converts local event time to UTC and back", () => {
    const d = zonedToUtc("2026-11-12", "09:30", "America/Los_Angeles");
    expect(d.toISOString()).toBe("2026-11-12T17:30:00.000Z");
    expect(utcToZonedParts(d.toISOString(), "America/Los_Angeles")).toEqual({ date: "2026-11-12", time: "09:30" });
  });
  it("handles zones without DST", () => {
    expect(zonedToUtc("2026-03-08", "15:00", "Africa/Lagos").toISOString()).toBe("2026-03-08T14:00:00.000Z");
  });
});

describe("passwords", () => {
  it("verifies only the right password", () => {
    const h = hashPassword("correct horse");
    expect(verifyPassword("correct horse", h)).toBe(true);
    expect(verifyPassword("wrong", h)).toBe(false);
    expect(verifyPassword("x", "garbage")).toBe(false);
  });
});

describe("validation", () => {
  const base = {
    title: "Lagos JS Meetup",
    summary: "Short talks and good company.",
    description: "A long enough description for the event.",
    image: "/images/event1.png",
    mode: "in-person",
    venue: "",
    location: "Lagos",
    timezone: "Africa/Lagos",
    date: "2026-12-01",
    startTime: "18:00",
    endTime: "",
    category: "Meetup",
    tags: "",
    agenda: "",
    organizer: "Lagos JS",
    capacity: "",
  };
  it("accepts a valid event", () => {
    const r = eventSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.capacity).toBeNull();
  });
  it("rejects end before start and unsafe image schemes", () => {
    expect(eventSchema.safeParse({ ...base, endTime: "17:00" }).success).toBe(false);
    expect(eventSchema.safeParse({ ...base, image: "javascript:alert(1)" }).success).toBe(false);
    expect(eventSchema.safeParse({ ...base, capacity: "0" }).success).toBe(false);
  });
  it("lowercases emails and enforces password length", () => {
    const r = signupSchema.safeParse({ name: "Ada Obi", email: "ADA@Example.com", password: "longenough" });
    expect(r.success && r.data.email).toBe("ada@example.com");
    expect(signupSchema.safeParse({ name: "Ada", email: "a@b.co", password: "short" }).success).toBe(false);
  });
});

describe("safeNext", () => {
  it("blocks open redirects", () => {
    expect(safeNext("/events/x")).toBe("/events/x");
    expect(safeNext("//evil.com")).toBe("/dashboard");
    expect(safeNext("https://evil.com")).toBe("/dashboard");
    expect(safeNext("/\\evil.com")).toBe("/dashboard");
  });
});
