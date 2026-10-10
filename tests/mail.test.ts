import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendMail, templates } from "@/lib/mail";

const ok = () => new Response(JSON.stringify({ id: "email_1" }), { status: 200 });

describe("sendMail (Resend)", () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.MAIL_FROM = "StageGrid <tickets@example.com>";
    process.env.MAIL_REPLY_TO = "help@example.com";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.RESEND_API_KEY;
    delete process.env.MAIL_REPLY_TO;
  });

  it("posts the message to Resend with auth, sender and idempotency key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok());
    vi.stubGlobal("fetch", fetchMock);

    const sent = await sendMail({ to: "ada@example.com", subject: "Hi", text: "Hello", html: "<p>Hello</p>", idempotencyKey: "k-1", tags: { type: "test" } });

    expect(sent).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer re_test_key");
    expect(init.headers["Idempotency-Key"]).toBe("k-1");
    expect(JSON.parse(init.body)).toMatchObject({
      from: "StageGrid <tickets@example.com>",
      to: "ada@example.com",
      subject: "Hi",
      reply_to: "help@example.com",
      tags: [{ name: "type", value: "test" }],
    });
  });

  it("retries once on rate limits and server errors", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("slow down", { status: 429 })).mockResolvedValueOnce(ok());
    vi.stubGlobal("fetch", fetchMock);
    expect(await sendMail({ to: "a@b.co", subject: "s", text: "t" })).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry client errors (bad address, unverified domain) and never throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetchMock = vi.fn().mockResolvedValue(new Response("domain not verified", { status: 403 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await sendMail({ to: "a@b.co", subject: "s", text: "t" })).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    await expect(sendMail({ to: "a@b.co", subject: "s", text: "t" })).resolves.toBe(false);
  });

  it("skips the network entirely when no API key is configured", async () => {
    delete process.env.RESEND_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(await sendMail({ to: "a@b.co", subject: "s", text: "t" })).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("email templates", () => {
  const ticket = {
    to: "ada@example.com",
    name: "Ada <script>alert(1)</script> Obi",
    eventTitle: 'Rock & "Roll" <b>Night</b>',
    eventPath: "/events/rock-roll",
    when: "Friday, 16 October, 4:00 PM",
    where: "Eko Hotel",
    code: "K7QM2XRD",
    ticketName: "VIP",
    paid: "₦15,000",
  };

  it("escapes user-supplied text in the HTML body", () => {
    const m = templates.ticket(ticket);
    expect(m.html).not.toContain("<script>");
    expect(m.html).not.toContain("<b>Night</b>");
    expect(m.html).toContain("&lt;b&gt;Night&lt;/b&gt;");
    expect(m.text).toContain("K7QM2XRD");
  });

  it("separates paid receipts from free confirmations and de-duplicates by ticket code", () => {
    expect(templates.ticket(ticket).subject).toMatch(/^Your ticket/);
    expect(templates.ticket({ ...ticket, paid: undefined }).subject).toMatch(/^You're booked/);
    expect(templates.ticket(ticket).idempotencyKey).toBe("ticket-K7QM2XRD");
    expect(templates.reminder(ticket).idempotencyKey).toBe("reminder-K7QM2XRD");
  });

  it("links buttons to absolute URLs", () => {
    expect(templates.reset("a@b.co", "/reset-password/abc").html).toMatch(/href="https?:\/\/[^"]+\/reset-password\/abc"/);
  });
});
