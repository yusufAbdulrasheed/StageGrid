# StageGrid

Event management SaaS for developer communities. Organizers get a workspace to publish events, take
registrations, check people in and see what's working; attendees discover and book events for free.

Next.js 16 (App Router, server actions) · Postgres + Drizzle · Paystack billing · Tailwind v4.

## What's in the box

**Attendees** (account required to book)
- Browse, search and filter events by category, format, price and date; sign-in redirects to `/events`
- Free tickets in one tap; paid tickets through Paystack checkout, issued only after the payment is verified
- Several ticket tiers per event (Regular / VIP / Table…), each with its own price and allocation
- Ticket code, email receipt, calendar download, and `/history` with 7-day, 1-month and 1-year views

**Organizers** (`/app/:workspace`)
- Workspaces with roles (owner / admin / member), team invites, per-tenant data isolation
- Events: draft → publish, duplicate, edit; ticket tiers; poster, photo or custom cover; timezone-aware times
- Paid tickets settle to the organizer's bank account (Paystack subaccount); platform fee 8% / 5% / 3% by plan
- Attendees: search, ticket codes, one-tap check-in, CSV export; sales and registration analytics
- Plans (Starter / Pro / Business) with server-enforced limits, billing, payment history, API keys

**Platform**: row-locked booking (no overselling), automatic refund if a ticket sells out mid-payment, idempotent
webhooks, rate limiting, CSP and security headers, SEO, Resend email notifications, PostHog analytics.

### Email notifications (Resend)

Sent after the response so they never slow a request: welcome, ticket confirmation / payment receipt, new-registration
alert to organizers, 24-hour reminders, event cancellation, refund notice, team invites, password reset, subscription
receipt and failed-payment notice. Without `RESEND_API_KEY` they print to the server console in development.

**Setting up Resend**
1. Create an API key at resend.com and set `RESEND_API_KEY` in `.env.local`.
2. Verify your sending domain in Resend and set `MAIL_FROM="StageGrid <tickets@yourdomain.com>"`. Until the domain is verified,
   Resend only lets you send from `onboarding@resend.dev` to your own account email.
3. Check it works: `npm run mail:test -- you@example.com`.
4. Set `NEXT_PUBLIC_SITE_URL` to your public URL so the buttons in emails link to the right place.

Reminders are sent by `GET /api/cron/reminders` (header `Authorization: Bearer $CRON_SECRET`). Call it hourly from any
scheduler (Vercel Cron, GitHub Actions, cron-job.org). Each ticket is reminded once.

## Getting started

Requires Node 20+.

```bash
npm install
cp .env.example .env.local
npm run dev
```

With no `DATABASE_URL`, the app uses embedded Postgres (PGlite) in `./data/pglite`, runs migrations, and in development seeds
sample organizations and a demo account: **demo@stagegrid.dev / stagegrid-demo** (owner of "Lagos Nights", Pro plan) and an attendee, **guest@stagegrid.dev / stagegrid-demo**.
Billing and ticket checkout fall back to a simulated checkout when no Paystack key is set, and emails are printed to the server console.

| Script                | What it does                              |
| --------------------- | ----------------------------------------- |
| `npm run dev`         | Dev server                                |
| `npm run build`       | Production build                          |
| `npm run lint`        | ESLint                                    |
| `npm run typecheck`   | `tsc --noEmit`                            |
| `npm test`            | Vitest (runs against in-memory Postgres)  |
| `npm run db:generate` | Generate a migration after editing `lib/db/schema.ts` |
| `npm run db:migrate`  | Apply migrations to `DATABASE_URL`        |

## Going to production

1. **Database**: set `DATABASE_URL` to a Postgres instance (Neon, Supabase, RDS…). Migrations in `./drizzle` run on boot
   (or set `AUTO_MIGRATE=false` and run `npm run db:migrate` in your deploy step). PGlite is for local use only.
2. **Secrets**: set `AUTH_SECRET` (32+ random chars) and `NEXT_PUBLIC_SITE_URL`.
3. **Paystack**:
   - In the Paystack dashboard create four subscription plans (Pro and Business, monthly and yearly) in **NGN**
     with amounts matching `lib/plans.ts` (₦15,000 / ₦144,000 and ₦45,000 / ₦432,000) and put their codes in
     `PAYSTACK_PLAN_*`. Checkout is rejected if the amount paid is below the plan price.
   - Set `PAYSTACK_SECRET_KEY` and register `https://<domain>/api/webhooks/paystack` as the webhook URL.
   - Handled events: `charge.success` (subscriptions and tickets), `subscription.create`, `subscription.not_renew`,
     `subscription.disable`, `invoice.payment_failed`. Signatures are verified (HMAC-SHA512) and deliveries are de-duplicated.
4. **Organizer payouts**: owners add a bank account under Settings → Payouts, which creates a Paystack subaccount. Paid
   tickets can't be published without one.
5. **Email**: set `RESEND_API_KEY` and `MAIL_FROM` (verified domain), and schedule the reminders endpoint with `CRON_SECRET`.

### Using Flutterwave instead

Billing sits behind the `BillingProvider` interface in `lib/billing/index.ts`. Add `lib/billing/flutterwave.ts`
(payment plans, hosted payment link, verify-by-reference), a webhook route that calls `applyPayment`, and return it from
`getBillingProvider()`. Nothing else in the app depends on Paystack.

## Notes

- Rate limiting (`lib/rate-limit.ts`) is in-memory per instance; use Redis/Upstash for multi-instance deployments.
- A plan lapses to Starter limits 3 days after a failed/ended billing period (`effectivePlan` in `lib/orgs.ts`); data is never deleted.
- Refunds for already-issued paid tickets are done from the Paystack dashboard; events with paid tickets can be unpublished but not deleted.
- Every kind of event has a default cover photo (Unsplash, see `public/images/categories/CREDITS.md`); organizers can pick another bundled photo or paste their own image URL.
- Not built yet: email verification, SSO, an audit log, multi-seat orders.

## Structure

```
app/(site)/     landing, discovery, auth, event pages, /history, checkout
app/app/[org]/  organizer workspace (sidebar shell + overview, events, attendees, team, billing, settings)
app/actions/    server actions (every one re-checks session, role and tenant)
app/api/        public feed, ICS/CSV, /api/v1 (API keys), billing callback, Paystack webhook
components/     UI; components/app/ is the workspace UI
lib/            db (Drizzle schema), events, orgs, billing, auth, plans, mail, validation
drizzle/        SQL migrations
tests/          Vitest suites
```
