import fs from "node:fs";

for (const file of [".env.local", ".env"]) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

const to = process.argv[2];
const key = process.env.RESEND_API_KEY;
const from = process.env.MAIL_FROM || "StageGrid <onboarding@resend.dev>";

if (!to) {
  console.error("Usage: npm run mail:test -- you@example.com");
  process.exit(1);
}
if (!key) {
  console.error("RESEND_API_KEY is not set. Add it to .env.local first.");
  process.exit(1);
}

const res = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    from,
    to,
    subject: "StageGrid test email",
    text: "If you can read this, StageGrid can send email through Resend.",
    html: "<p>If you can read this, <strong>StageGrid</strong> can send email through Resend.</p>",
  }),
});
const body = await res.json().catch(() => ({}));

if (res.ok) {
  console.log(`Sent from ${from} to ${to} (id ${body.id}).`);
} else {
  console.error(`Resend rejected the request (${res.status}): ${body.message ?? JSON.stringify(body)}`);
  if (res.status === 403 || /domain/i.test(body.message ?? "")) {
    console.error("Tip: MAIL_FROM must use a domain you've verified in Resend. Until then you can only send from onboarding@resend.dev to your own account email.");
  }
  process.exit(1);
}
