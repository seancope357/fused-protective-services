# Build Prompt — Fused Protective Services Operations Platform

*Paste everything below the rule into Fable 5.1.*

---

## Role

You are the lead engineer for **Fused Protective Services**, a licensed Texas private
security contractor (Cameron Harrell, Austin and San Antonio). The company already has a
marketing site that converts. It has no system to run the work that conversion creates.
Your job is to build that system, and to fix the handful of defects on the existing site
that are currently costing real leads.

Optimize for a one-owner business that must look like an enterprise vendor to a corporate
client's procurement team. Every screen a client sees is a sales asset.

---

## The repository you are working in

`seancope357/fused-protective-services`. Read `PROJECT_CONTEXT.md` and the seven documents
in `context/` before writing code. The short version:

- The marketing site (`index.html`), careers page (`careers.html`), invoice tool
  (`invoice.html`), and their CSS are **generated** by `node build.mjs` from `src/`.
  There is no `package.json`, no lockfile, and no npm dependencies in that toolchain.
- **Never hand-edit a generated file.** Edit `src/`, run `node build.mjs`, and commit the
  regenerated output alongside the source. `node build.mjs --check` must pass.
- Every business fact lives once in `src/data/`. Divisions, rates, FAQ, careers postings,
  invoice terms. A fact rendered in two places is read from one file.
- `quoteValue` on each division is a stable contract linking the bookshelf button, the
  form `<select>`, the assessment, the estimator, and the lead payload. Do not change
  existing values.
- Backend today: `api/intake.js` (Vercel function, zero-dependency) writing to a hosted
  Supabase project, migrations in `supabase/migrations/`.

### Architecture decision, already made

**Add a Next.js (App Router, TypeScript) + Supabase application for everything
authenticated. Leave the marketing and careers pages exactly as they are.**

Put the app in `app/` as a separate workspace with its own `package.json`, served at
`/portal/*` (or `app.fusedprotectiveservices.com` — pick one and say which). The
zero-dependency marketing build stays untouched and keeps its drift check. Do not port
the WebGL page into React. Do not add npm dependencies to the root toolchain.

Where the two need to agree on a fact — division names, rate cards, tax defaults — the
Next.js app imports from `src/data/*.mjs` or from a small shared module those files feed.
Do not fork the data.

### Build vs buy

Build the domain: clients, sites, quotes, jobs, shifts, invoices, portals. Buy the pipes:
**Stripe** (payments), **Resend** (email), **Twilio** (SMS), **Supabase** (Postgres, auth,
storage, RLS). No CRM, no field-service SaaS.

---

## Non-negotiable constraints

1. `node build.mjs --check` passes on every commit.
2. No secret reaches the browser. Service-role keys are server-only.
3. Every table has RLS. A client sees their own records and nothing else. An officer sees
   their own shifts and nothing else. Write the policies as part of the migration, and
   write a test that proves a client cannot read another client's invoice.
4. **Money amounts are authoritative on the server.** A payment amount is looked up from a
   stored invoice by id. It is never read from a request body. There is currently a bug in
   `api/stripe-checkout.js` that does exactly this — fix it.
5. **No fake success.** If a delivery stage fails, the user is told. The existing
   `api/intake.js` gets this right and returns 503 when nothing delivered; match that
   posture everywhere. Specifically: `api/stripe-checkout.js` currently returns a mock
   Stripe URL when `STRIPE_SECRET_KEY` is missing. Make it fail loudly instead.
6. Accessibility is WCAG 2.1 AA, matching the standard the existing site already holds:
   live regions on async status, keyboard operability, visible focus, honored
   `prefers-reduced-motion`.
7. The app inherits the site's visual language — dark carbon ground, gold accents, the
   tokens in `src/styles/tokens.css`. Read them; do not invent a second palette.
8. Do not invent business facts. Where you need one that is not in `src/data/`, add a
   `TODO(cameron):` in a single `docs/OPEN_QUESTIONS.md` and ship a labelled placeholder.

---

## Phase 0 — fix what is bleeding (do this first, ship it separately)

These are small and they are costing money today.

1. **Phone number.** `(512) 555-0199` is a fictional-range placeholder wired through the
   nav, drawer, dispatch bar, footer, and `LocalBusiness` schema. Add a
   `TODO(cameron)` and make the placeholder visually obvious in a non-production build so
   it cannot ship unnoticed again.
2. **Review markup.** `src/data/site.mjs` claims `aggregateRating` 5.0 from 28 reviews with
   no reviews anywhere on the site. Remove the rating block, and structure the data layer
   so it returns once real reviews exist (Phase 1 collects them).
3. **License number.** Texas Occupations Code Chapter 1702 requires a licensed security
   contractor's license number in its advertising. Add a `licenseNumber` field to
   `site.mjs`, render it in the footer and the schema, placeholder until Cameron supplies it.
4. **Dispatch alerts.** `api/intake.js` has the email stage written but `RESEND_API_KEY` is
   not installed and `DISPATCH_ALERT_FROM` defaults to `onboarding@resend.dev`, which only
   delivers to the Resend account owner. Document the exact steps to install Resend, verify
   `fusedprotectiveservices.com` as a sending domain, and set `DISPATCH_ALERT_TO`.
5. **Client auto-reply.** A person who submits the quote form currently receives nothing.
   Send them a branded confirmation carrying their reference code, what happens next, and
   the dispatch phone number.
6. **Emergency SMS.** When the DB trigger sets `priority = 'emergency'`, send Cameron a
   Twilio SMS, not only an email. The site promises a 45-minute dispatch.
7. **Abuse controls on `/api/intake`.** Replace `Access-Control-Allow-Origin: *` with the
   site origin, add a honeypot field, add per-IP rate limiting, and suppress duplicate
   submissions within a short window.
8. **Stripe.** Fix the amount authority and the mock-URL fallback described above.

---

## Phase 1 — lead to cash (the main build)

### Data model

Extend `supabase/migrations/` — additive migrations, never edit an applied one. Keep the
existing `client_quotes` and `candidate_applications` tables and their triage trigger;
the intake path that feeds them works and is verified in production.

New tables, with the state machines spelled out:

- `clients` — company or individual, billing contact, billing address, default terms,
  default tax jurisdiction, Stripe customer id.
- `sites` — a physical location belonging to a client. Address, geo, access notes, on-site
  contact, parking, gear notes. A nightlife venue you guard weekly is one row forever.
- `quotes` — created from an inbound `client_quotes` row or by Cameron directly. Division,
  armed level, officer count, hours, bill rate, computed total, validity window.
  `status`: `draft → sent → accepted → declined → expired`.
- `proposals` — the client-facing document a quote renders into. Scope, exclusions, terms,
  a signature block. Records `accepted_at`, accepting name, and IP.
- `jobs` — an accepted engagement. Client, site, division, start and end, recurrence rule
  for standing details. `status`: `scheduled → in_progress → completed → cancelled`.
- `shifts` — one dated block within a job. Start, end, officers required, armed level,
  bill rate, pay rate. (Assignment and clock-in arrive in Phase 2; model the columns now,
  leave the UI for later.)
- `invoices` — **replace the localStorage store.** Number minted server-side with a
  Postgres sequence so two devices cannot collide. Line items generated from a job's
  shifts, then editable. `status`: `draft → sent → partially_paid → paid → overdue → void`.
  Carries `stripe_payment_intent_id`, `amount_paid_cents`, `paid_at`.
- `payments` — one row per Stripe event. Amount, method, Stripe ids, an idempotency key.
- `reviews` — post-job review requests and captured responses. Rating, text, permission to
  publish. This is what eventually and honestly backs the schema.org rating.
- `notifications` — an append-only log of every message sent, to whom, on what channel,
  with delivery outcome. When Cameron asks "did the client get the brief," this answers it.

Migrate the existing `invoice.html` localStorage records on first authenticated load, or
provide an explicit import. Do not silently orphan Cameron's existing invoices.

### Auth and roles

Supabase Auth. Three roles enforced in RLS, not only in the UI:

- **`owner` / `staff`** — email plus password, full access. `/invoice` moves behind this.
- **`client`** — passwordless magic link, scoped to their own client row.
- **`officer`** — magic link, scoped to their own assignments. Model it now; the officer
  screens land in Phase 2.

### Routes

**Owner (`/portal`)**
- Dashboard: new leads needing a response, jobs in the next 7 days, unpaid invoices with
  aging, revenue this month. One screen that answers "what needs me today."
- Leads: the `client_quotes` inbox with triage state, one click to convert to a quote.
- Quotes and proposals: build, send, track acceptance.
- Jobs: create from an accepted quote, calendar and list views.
- Invoices: generate from a job, send, track payment, chase overdue.
- Clients and sites.
- Settings: rates, terms, tax, notification recipients, message templates.

**Client (`/client`)**
- Their proposal, with an accept action that is legally meaningful (typed name, timestamp,
  IP, an emailed copy of what they accepted).
- Upcoming and past details, with the pre-job brief.
- Invoices, with a pay button.
- A post-job review form.

### Payments

Stripe Checkout for card and ACH. **The webhook is the source of truth**, not the browser
redirect. Handle `checkout.session.completed`, `payment_intent.succeeded`, and
`payment_intent.payment_failed`, verify the signature, deduplicate by event id, and update
the invoice and `payments` rows in one transaction. Send a receipt on success. Support a
deposit percentage on the job and a balance invoice on completion. Replace the
third-party QR image service (`api.qrserver.com`, which currently receives every invoice
payment URL) with a QR generated server-side or in-page.

### Notification matrix

Build this as a table-driven engine reading templates from data, not as scattered `send()`
calls. Every send writes to `notifications`.

| Trigger | To | Channel |
| :--- | :--- | :--- |
| Lead submitted | Owner | Email; SMS if priority is emergency |
| Lead submitted | Client | Email confirmation with reference code |
| Lead unanswered after 2h | Owner | SMS |
| Proposal sent | Client | Email with a portal link |
| Proposal accepted | Owner | Email and SMS |
| Job confirmed | Client | Email brief: date, arrival window, on-site contact, what to prepare |
| 24h before a job | Client | Email and SMS reminder |
| 24h before a job | Owner | Email if the job is unstaffed |
| Job completed | Client | Email summary |
| Job completed + 24h | Client | Email review request |
| Invoice sent | Client | Email with pay link |
| Payment received | Owner and client | Email; receipt to the client |
| Invoice overdue | Client | Email at day 1, 7, 14 past due |
| Daily 7am | Owner | Digest: today's jobs, new leads, unpaid invoices |

SMS requires disclosed consent and A2P 10DLC registration. Add the consent checkbox and
language to the intake forms, store the consent with a timestamp, and honor STOP.

### Legal and compliance pages

Privacy policy, terms of service, and SMS consent disclosure, generated through the
existing `build.mjs` pipeline so they match the site. Placeholder text clearly marked for
attorney review — do not present drafted legal text as reviewed.

---

## Phase 2 — operations (design for it, build it after Phase 1 ships)

Officer roster with Texas DPS license level and expiry tracking with renewal alerts.
Shift assignment with conflict detection. An officer mobile view for assigned shifts.
GPS clock-in and checkpoint scans — the marketing page already advertises "timestamped
digital patrol scans, shift logs, GPS checkpoint check-ins." Incident reports with photo
upload to Supabase Storage. Timesheets and a payroll-ready export. Invoices reconciled
against hours actually worked.

Do not build Phase 2 UI now. Do leave the schema and the seams ready for it.

---

## How to work

1. **Read first.** `PROJECT_CONTEXT.md`, all seven `context/` documents, `PROGRESS.md`,
   `src/data/`, `api/intake.js`, `supabase/migrations/`. State back what you found that
   contradicts this prompt before you build. The repository is the authority on itself.
2. **Ship Phase 0 as its own pull request** before starting Phase 1. It is small, it is
   independently valuable, and it is verifiable by hand.
3. **One migration per logical change.** Additive. Never edit an applied migration.
4. **Tests where it matters**, not everywhere: RLS isolation between clients, invoice
   number uniqueness under concurrency, Stripe webhook idempotency, the notification
   engine's trigger conditions, tax arithmetic.
5. **Add CI**: `node build.mjs --check`, the Next.js typecheck and build, and the tests.
6. **Update `PROGRESS.md` and `context/workflows.md`** as you go. They are how the next
   engineer finds the seams, and they are currently accurate — keep them that way.
7. **Ask before assuming** on anything that changes what the business charges, promises, or
   is liable for. Everything else, decide and document the decision.

## Deliverable

Working, deployed code plus:

- `docs/OPEN_QUESTIONS.md` — everything blocked on Cameron, each with the file to edit and
  the consequence of leaving it.
- `docs/RUNBOOK.md` — environment variables, third-party accounts to create, the exact
  order to configure them, and how to verify each one end to end.
- An updated `PROGRESS.md` reflecting real state, not intended state.

## Definition of done for Phase 1

A stranger finds the site, submits a request, and Cameron is texted within seconds. He
sends a proposal from his phone. The client accepts it in their browser. A job exists. An
invoice generates from that job. The client pays by card. The invoice marks itself paid
from the webhook. The client gets a receipt and, a day after the detail, a review request.
Cameron opened one dashboard and never touched a spreadsheet.
