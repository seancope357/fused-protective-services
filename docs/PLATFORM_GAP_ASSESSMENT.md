# Platform Gap Assessment — Fused Protective Services

*Assessed 2026-09-09 against `main` @ 16b595a. Scope: what stands between the current
repository and a site that runs the business end to end — discovery, inquiry, job
building, invoicing, payments, owner notifications, pre-job client communication,
post-job review capture.*

---

## 1. What actually works today

| Capability | State |
| :--- | :--- |
| Marketing site (`index.html`) | Real. 7 divisions, WebGL assembly, estimator, quiz, FAQ, schema.org. Generated from `src/` by `build.mjs`, drift-checked. |
| Careers portal (`careers.html`) | Real. Filterable postings, pre-qual checker, vetting timeline, application form. |
| Lead capture (`/api/intake`) | Real. Writes `client_quotes` / `candidate_applications` to hosted Supabase, server-mints reference codes, DB trigger escalates priority, honest 503 when nothing delivers. |
| Invoice builder (`/invoice`) | Half real. Branded document, auto numbering, terms, tax, print-to-PDF. **Stores to `localStorage` only.** |
| Stripe checkout (`/api/stripe-checkout`) | Prototype. Creates a session from a client-supplied amount. No webhook, no reconciliation. |

Everything else in the lifecycle does not exist.

---

## 2. The lifecycle, stage by stage

### Discovery — mostly there, three things actively hurt it

1. **The phone number is fictional.** `(512) 555-0199` sits in the block reserved for
   film and TV. Every nav link, drawer, dispatch bar, footer, and the `LocalBusiness`
   schema dials a dead line. This is the single highest-cost defect on the site.
2. **Unverified review markup.** `site.mjs` claims `aggregateRating` 5.0 from 28 reviews.
   Google penalizes review markup that isn't backed by collected reviews. There is no
   testimonials section anywhere on the site to back it.
3. **No Texas DPS PSB license number displayed.** Texas Occupations Code Chapter 1702
   requires a licensed security contractor's license number in its advertising. The site
   advertises statewide and shows no number.

Also missing: per-city landing pages (the site claims Austin, San Antonio, Dallas,
Fort Worth, Houston but has one page), any analytics or conversion tracking, call
tracking, and a Google Business Profile link.

### Inquiry — the pipe is built, nothing comes out the other end

- **Nobody is notified.** `RESEND_API_KEY` is not installed, so leads land in Postgres
  silently. The site promises sub-45-minute emergency dispatch that no alert backs.
- **`DISPATCH_ALERT_TO` points at Sean, not Cameron**, and `DISPATCH_ALERT_FROM` defaults
  to `onboarding@resend.dev`, which Resend only delivers to the account owner. The
  sending domain is unverified.
- **No SMS.** Emergency priority deserves a page, not an email.
- **The client gets nothing.** They see a reference code on screen and then silence. No
  confirmation email, no text, no "what happens next."
- **No abuse controls.** `Access-Control-Allow-Origin: *`, no rate limit, no honeypot, no
  turnstile, no duplicate suppression. The endpoint writes to a production database.
- **No attachments.** Event security needs venue maps, run-of-show, floor plans.
- **No booking.** No way to put a consult on Cameron's calendar.

### Job building — does not exist

There is no concept of a quote, a proposal, a job, a site, a shift, an officer
assignment, or a client. The estimator is a calculator whose output is thrown away.
Missing entirely:

- Client and site records (a venue you guard weekly should exist once).
- Quote → proposal → acceptance. No proposal document, no e-signature, no accepted
  scope that later drives billing.
- Service agreement and certificate-of-insurance delivery.
- Jobs with shifts, per-shift officer counts, armed level, bill rate and pay rate.
- Recurring schedules (nightlife venues are Friday/Saturday forever).
- Officer roster, license expiry tracking, availability, assignment.
- Clock-in/out with the GPS checkpoint scans the marketing page already advertises.
- Incident reports and shift logs — also advertised, also absent.

### Invoicing — a document generator, not a billing system

- Invoices live in one browser's `localStorage`. Clear site data and the books are gone.
- The `invoices` table exists in Supabase and **nothing ever writes to it**.
- Numbering is per-browser. Two devices both mint `FPS-2026-0001`.
- Invoices are typed by hand. They are not generated from worked shifts, so hours billed
  and hours worked can never be reconciled.
- No emailing an invoice. No accounts-receivable view, no aging, no overdue reminders,
  no deposits or retainers, no partial payments, no credit notes.
- Tax is a hardcoded 8.25%. Correct for Austin, wrong the moment a job is billed to a
  different taxing jurisdiction, and the taxability of security services in Texas needs
  a CPA sign-off recorded somewhere.

### Payments — the most dangerous code in the repo

- **The amount is taken from the request body.** `api/stripe-checkout.js` charges
  `body.totals.totalCents`. Anyone can POST a one-cent checkout for any invoice. Amounts
  must be looked up server-side from a stored invoice.
- **No webhook.** Stripe never tells the system a payment succeeded, so no invoice is
  ever marked paid and no receipt is ever sent.
- **A mock URL is returned when the key is missing.** The UI happily renders a payment
  link to `https://buy.stripe.com/test_mock_link`. A misconfigured production deploy
  shows clients a fake pay button rather than failing loudly.
- `success_url` and `cancel_url` both point at the homepage with no session reference,
  so a paying client gets no confirmation.
- The payment QR code is fetched from `api.qrserver.com`, which hands every invoice
  payment URL to an unrelated third party.
- No deposit collection, no saved ACH mandate for recurring venue clients, no refunds.

### Owner notifications — nothing fires

Beyond the unconfigured email above: no dashboard, no daily digest, no unanswered-lead
escalation, no "shift starts in 2 hours and is unstaffed" alert, no payment-received
notification, no overdue-invoice nudge.

### Pre-job client communication — does not exist

No booking confirmation, no detail brief, no assigned-officer roster, no arrival window,
no on-site point of contact, no day-before reminder, no reschedule or cancel link.

### Post-job — does not exist

No after-action summary, no review request, no Google review deep link, no NPS, no
rebooking prompt, no way to ever legitimately earn the 5.0 rating the schema claims.

### Cross-cutting

- **No authentication anywhere.** `/invoice` is `noindex` but publicly reachable — the
  company's billing tool is on the open internet behind a guessable URL.
- No privacy policy, no terms of service, no SMS consent language (A2P 10DLC registration
  requires disclosed consent before you can text clients), no data retention policy for
  the PII sitting in `client_quotes`.
- No tests, no CI running `node build.mjs --check`, no error monitoring, no uptime check.

---

## 3. Decisions taken

| Question | Decision |
| :--- | :--- |
| Architecture | Add a Next.js + Supabase app for the authenticated product. Leave the generated marketing and careers pages exactly as they are. |
| Build vs buy | Build jobs, shifts, invoices, and portals in-repo. Buy the pipes: Stripe, Resend, Twilio, calendar sync. |
| Who logs in | Owner and command staff, clients, and officers. |
| Sequencing | Phase 1 is lead to cash. Phase 2 is scheduling and the officer app. |

## 4. Phasing

**Phase 0 — unblock the existing site (hours, not days).** Real phone number. Remove or
substantiate the rating. Add the PSB license number. Install Resend, verify the sending
domain, point alerts at Cameron. Add a client auto-reply. Fix the Stripe amount
authority and the mock-URL fallback. Rate-limit and lock down `/api/intake` CORS.

**Phase 1 — lead to cash.** Clients, sites, quotes, proposals with acceptance, jobs,
server-side invoices generated from jobs, Stripe with webhook reconciliation, owner
dashboard, owner alerts by email and SMS, client portal, pre-job confirmation and
reminder, post-job review request.

**Phase 2 — operations.** Officer roster and license tracking, shift scheduling and
assignment, officer mobile view, GPS clock-in and checkpoint scans, incident reports,
timesheets, payroll-ready export, invoices reconciled against worked hours.

**Phase 3 — growth.** City landing pages, testimonials fed by real captured reviews,
recurring contracts and retainers, subcontractor management, reporting.

---

*The build prompt for Fable 5.1 is in [`FABLE_BUILD_PROMPT.md`](FABLE_BUILD_PROMPT.md).*
