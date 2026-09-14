# INCIDENT — Fused Protective Services

**You are reading this because something is wrong in production.** Work top to bottom.
Do not diagnose first. §2 stops the bleeding in under five minutes and every action in it
is reversible; §3 is the specific scenarios. Root cause can wait until traffic is safe.

Setup procedures are in [`RUNBOOK.md`](RUNBOOK.md) — this file assumes everything there is
already configured. Launch gates are in [`GO_LIVE.md`](GO_LIVE.md). The restore procedure
for the database is in [`RESTORE-DRILL.md`](RESTORE-DRILL.md).

**The one thing to know before you touch anything:** this system was built to degrade
honestly. Removing a key never produces a silent failure or a fake success — it produces a
plain message to the visitor and a `skipped` row in the message log. Pulling a key is a
*safe* move. §2 says exactly what each one costs.

---

## 0. Who

- **On call:** `TODO(cameron)` — name, mobile, and the hours each person covers. Until this
  line is filled in there is no rota, and whoever finds the problem owns it.
- **Owner escalation:** Cameron (business decisions: refunds, what a client is told,
  whether to stay down). Sean (Vercel, Supabase, Stripe, Resend, Twilio accounts).
- **Fallback channel for everything:** the dispatch line in `src/data/site.mjs` →
  `site.phone.display`, today **(512) 555-0199**. If the site, the portal and email are all
  down, that number is the business. It is answered by a human, not by this system.

## 1. First minute — which surface is broken

Two Vercel projects deploy independently from the same repository. Establish which one is
affected before you change anything.

| Project | Root | Check | Healthy answer |
| :--- | :--- | :--- | :--- |
| `fused-protective-services` | repo root | `curl -sI https://fusedprotectiveservices.com/` | `200`, `content-type: text/html` |
| | | `curl -sS -X POST https://fusedprotectiveservices.com/api/intake -H 'content-type: application/json' -d '{}'` | `400` with `"A phone number or email address is required."` — the function is alive |
| `fused-portal` | `app/` | `curl -sI https://app.fusedprotectiveservices.com/login` | `200` |
| | | `curl -sS -H "Authorization: Bearer $CRON_SECRET" https://app.fusedprotectiveservices.com/api/cron/tick` | `{"ok":true,"report":{…}}` |

A `200` from `curl` with a blank page in the browser is almost always the portal's
nonce-based Content-Security-Policy — set in `app/src/lib/supabase/proxy.ts`, reached through
`app/src/proxy.ts`; HSTS is in `app/next.config.ts`. Open the browser console; a CSP violation
names the directive it blocked.

**Then, in this order:**

1. **Portal → Settings → Integrations** (`/portal/settings`) — a live list of which keys the
   *running deployment* can actually see: Resend, verified sender, Twilio, Stripe, webhook
   secret, scheduler. A key that shows `missing` here is missing in production, whatever the
   Vercel settings page says.
2. **Portal → Message log** (`/portal/notifications`) — every email and text attempted, with
   the outcome. `sent` / `failed` / `skipped` and the reason. This answers "did the client
   get it?" without guessing.
3. **Portal → Activity** (`/portal/activity`) — the append-only audit log: who changed what,
   and when.
4. **Vercel → the affected project → Logs** — runtime errors. Every handler in this codebase
   logs with a bracketed prefix: `[API Intake]`, `[stripe]`, `[cron]`, `[email]`, `[sms]`,
   `[gate]`, `[notifications]`, `[pay]`. Filter on the prefix.
5. **Supabase → Logs** — database errors, and the API gateway's own status.
6. **Stripe → Developers → Webhooks → the endpoint → recent deliveries** — if money is
   involved, the truth is here.

> Uptime checks and error alerting are [SPEC-003](../specs/SPEC-003-error-reporting.md) and
> [SPEC-004](../specs/SPEC-004-health-and-heartbeat.md) and are **not built yet**. Until they
> land there is no health endpoint and no alert: the checks above are run by hand.

---

## 2. Stop the bleeding

Pick the narrowest action that stops the harm. All four are reversible.

**Before you start: an environment variable change does not reach a running deployment.**
Vercel binds variables when a deployment is created. `vercel env rm` or an edit in the
dashboard changes nothing until you **redeploy** — dashboard → Deployments → the current
production deployment → **⋯ → Redeploy**, or `vercel redeploy <url>`. Budget a Next.js build
for the portal. Where an action has an instant alternative that needs no redeploy, it is
named below and is usually the right one during an incident.

### 2a · Roll back a deployment

**Do this when a deploy broke something.** The two projects deploy independently, so roll
back only the one that is broken; the other keeps serving.

1. Vercel dashboard → the project (`fused-protective-services` **or** `fused-portal`) →
   **Deployments**.
2. Filter **Environment → Production**. Identify the last deployment that was healthy by its
   commit SHA — compare against `git log --oneline` on `main`.
3. On that deployment: **⋯ → Promote to Production**. It reuses the existing build; nothing
   rebuilds, so it is effectively instant.
   *One-click variant:* on the **current** production deployment, **⋯ → Instant Rollback**
   returns to the previously promoted one.
4. Re-run the §1 checks for that project.

CLI equivalent: `vercel ls fused-portal` to list deployments, then
`vercel promote <deployment-url>` (or `vercel rollback <deployment-url>`). Confirm the flags
against `vercel --help` on the version you have installed.

- **What breaks:** nothing, for code. The promoted build is one that already ran.
- **What it does *not* undo:** the database. Migrations are additive and forward-only and are
  applied by hand through the Supabase dashboard (RUNBOOK §1), so a rollback leaves any new
  column or table in place. That is harmless — older code ignores columns it does not select.
  **The exception** is when the reverted code wrote rows the older code misreads: a new
  status value the old `CHECK` constraint rejects, or a column the old code requires to be
  non-null. If the change you are reverting added a status or changed a shape, roll back and
  then check the affected table before you tell anyone it is fixed.
- **Never** edit an applied migration or hand-revert schema during an incident. Forward-fix.

### 2b · Stop the scheduler

**Do this when the hourly tick is sending wrong messages or hammering the database.**
It runs `0 * * * *` from `app/vercel.json` against `fused-portal`.

- **Fastest, no redeploy:** Vercel → `fused-portal` → **Settings → Cron Jobs** → disable
  (in some dashboard versions the same panel is the project's **Crons** tab). Takes effect
  at the next hour.
- **Belt and braces, needs a redeploy:** `vercel env rm CRON_SECRET production` then
  redeploy. `/api/cron/tick` then answers `503 {"ok":false,"error":"cron_not_configured"}`
  and logs `[cron] CRON_SECRET is not set; refusing to run.` Rotating `CRON_SECRET` to a new
  value instead gives `401 unauthorized` — same effect, and it survives someone re-enabling
  the toggle.

- **What breaks — permanently, these are missed, not delayed:** the 24-hour client job
  reminder and the unstaffed-job owner alert (`jobsStartingIn24h` fires in a 23–25 hour
  window exactly one tick wide); the 7am daily digest (`isDigestHour`); the day-1 / day-7 /
  day-14 overdue-invoice reminders (each fires on the exact day). If the scheduler is off
  across one of those moments, that message never goes.
- **What catches up on its own when you re-enable it:** the 2-hour unanswered-lead alert
  (7-day lookback), review requests after completed jobs (14-day lookback), and flipping due
  invoices to `overdue`.
- **What degrades honestly:** nothing is corrupted and nothing double-sends. Every branch is
  idempotent through the `notifications` dedupe key, so re-enabling cannot resend what
  already went.
- **Cost of leaving it off:** invoices stop moving to `overdue`, so the Invoices screen
  understates what is late. Tell Cameron.

### 2c · Stop taking payments

**Do this when the pay page is charging wrongly, or an invoice's amount is in doubt.**

- **Instant, no redeploy — preferred during an incident:** Stripe → **Developers → API
  keys** → roll the secret key. The running deployment's key stops working at once.
  `createCheckoutSession` throws, `startCheckout` catches it and redirects to
  `/pay/<token>?status=error`, and the pay page says *"We could not start checkout. Please
  try again or call (512) 555-0199."*
  **The webhook keeps working** — `constructEvent` verifies signatures locally with
  `STRIPE_WEBHOOK_SECRET` and never calls the Stripe API — so payments already in flight
  still settle onto their invoices. That is usually what you want.
- **Cleanest message, needs a redeploy:** `vercel env rm STRIPE_SECRET_KEY production` on
  `fused-portal`, then redeploy. `stripeConfigured()` goes false, the Pay button is not
  rendered at all, and the panel reads *"Online payment is not available yet. Please remit by
  check payable to Fused Protective Services, or call (512) 555-0199."*

- **What breaks:** new Checkout sessions, on both `/pay/<token>` and the client portal. With
  the key removed the webhook also returns `503 payments_not_configured`, so in-flight
  payments stop applying until it is restored — Stripe retries for about three days, so they
  are deferred, not lost.
- **What degrades honestly:** the invoice itself still renders, prints and can be paid by
  check. Nothing 500s, nothing claims a payment that did not happen. Amounts are always read
  from the stored row, never from the form, so a wrong amount cannot be submitted from the
  browser.
- **To reverse:** restore the key (or set the new rolled key) and redeploy. Confirm at
  Portal → Settings → Integrations.

### 2d · Stop outbound messaging

**Do this when the platform is emailing or texting clients wrongly.** Be precise about which
one you mean — the switches are not interchangeable.

| To stop | Remove | Effect |
| :--- | :--- | :--- |
| **Client-facing email only** (confirmations, proposals, briefs, invoices, receipts, sign-in links) | `DISPATCH_ALERT_FROM` | `publicSender()` returns null; the send is never attempted and is logged **`skipped` / `no_verified_sender`**. Owner alerts keep going via Resend's `onboarding@resend.dev` sender. |
| **All email, owner alerts included** | `RESEND_API_KEY` | `sendEmail` returns `{configured:false, ok:false}`; logged **`skipped` / `not_configured`**. |
| **All SMS** | any one of `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID`/`TWILIO_FROM` | `smsConfigured()` goes false; logged **`skipped` / `not_configured`**. |

All three need a redeploy of the project you changed (set them on **both** projects — the
static site's intake function and the portal share these variables).

- **What breaks:** clients stop receiving anything, including **sign-in links**, so no client
  can enter the client portal while email is off. Leads still arrive and still persist —
  intake reports each stage separately and never lets a failed confirmation hide a saved lead.
- **What degrades honestly:** every suppressed send becomes one `skipped` row in
  **Portal → Message log** with the reason. Nothing is claimed as sent. The visitor's intake
  response says a confirmation is on its way *only* when one actually went.
- **Watch for:** a key that is present but *revoked* is the one case that logs `failed`, not
  `skipped` — e.g. a revoked `RESEND_API_KEY` gives `failed / resend_401`. If the log says
  `failed`, the key is wrong, not absent.
- **Note:** removing `DISPATCH_ALERT_TO` may not stop owner alerts — Portal → Settings →
  *Owner alert email(s)* takes precedence over the environment variable. Clear it there too.

---

## 3. Scenarios

Each starts with the first three steps. Do those before anything else.

### 3a · A payment was taken but the invoice is not marked paid

1. **Stripe → Developers → Webhooks → the endpoint → recent deliveries.** Find the event for
   that payment. A `4xx`/`5xx` delivery is the answer; so is no delivery at all.
2. **Portal → Invoices → the invoice**, and Portal → Activity. Confirm the payment row is
   genuinely absent rather than recorded under a different invoice.
3. **Resend the event from Stripe** (*Resend* on the delivery). **This is safe.** The event id
   is deduplicated in `public.stripe_events` and the invoice and payment are updated in one
   transaction by `apply_stripe_payment_event()`; a replay of an applied event returns
   `{"applied":false,"reason":"duplicate_event"}` and changes nothing.

Then: `bad_signature` in the logs means `STRIPE_WEBHOOK_SECRET` does not match the endpoint —
copy it again from Stripe and redeploy, then replay. `apply_failed` (500) means the database
rejected it; Stripe retries for ~3 days, so fix Supabase and the retries land on their own.
A card payment settles at `checkout.session.completed`; an **ACH payment is `pending` until
`payment_intent.succeeded` arrives days later** — an unpaid ACH invoice is usually correct,
not a bug. Never mark an invoice paid by hand to match Stripe; make the webhook apply.

### 3b · A key has leaked

Rotate in this order. The first two are instant; the rest need a redeploy of both projects.

1. **`SUPABASE_SERVICE_ROLE_KEY` — do this first and treat it as a breach.** It bypasses RLS
   entirely: every lead, client, invoice and payment. Supabase → **Project Settings → API**,
   rotate the project API keys. Rolling the legacy `anon`/`service_role` pair rolls the JWT
   secret, which **signs out every user, staff and client**. Set the new `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` on **both** Vercel projects — the two `NEXT_PUBLIC_*`
   values **must be stored non-sensitive** (RUNBOOK §1) or the browser bundle bakes in the
   literal `[SENSITIVE]` and auth breaks — then redeploy both. **Breaks first:** the portal
   (every page is a database read). Intake keeps answering but stops persisting.
2. **`STRIPE_SECRET_KEY`** — Stripe → Developers → API keys → roll. Instant; the webhook is
   unaffected because it verifies signatures locally. Set the new value and redeploy.
3. **`STRIPE_WEBHOOK_SECRET`** — Stripe → Developers → Webhooks → the endpoint → roll the
   signing secret. Between the roll and the redeploy every event fails with
   `400 bad_signature`; Stripe retries, so payments apply late rather than never.
4. **`RESEND_API_KEY`** — Resend → API Keys → revoke, create, set on both projects, redeploy.
   Until then sends log as `failed / resend_401`.
5. **`TWILIO_AUTH_TOKEN`** — Twilio console → rotate. It also verifies inbound webhook
   signatures, so `/api/twilio/inbound` returns `403` and **STOP/START replies stop being
   recorded** until the new token is deployed. Twilio's own Advanced Opt-Out still blocks at
   the carrier edge, so nobody is texted against their wishes — but our record drifts.
6. **`CRON_SECRET`** — new random string, redeploy. Harmless.

Then: if the key was ever committed, it is in the git history — rotating is the only fix,
deleting the commit is not. Record the exposure window in the incident note (§5).

### 3c · A bad migration

Migrations are additive, forward-only, and applied by hand through the Supabase dashboard
(RUNBOOK §1). **Forward-fix is almost always right.**

1. Do **not** revert the migration. Roll back the *code* if the deploy is the problem (§2a);
   additive schema in front of older code is inert.
2. Write a new migration in `supabase/migrations/` — `YYYYMMDDHHMMSS_name.sql`, `IF NOT
   EXISTS` throughout — that corrects the state. Apply it through the dashboard SQL editor,
   then set the recorded version so the history stays aligned (RUNBOOK §1).
3. Prove it before you deploy: `cd app && node scripts/reset-test-db.mjs && pnpm test:db`
   against a local Postgres 17 — this replays every migration from scratch in filename order,
   which is the only thing that proves the sequence still applies cleanly.

**The exception — when forward-fix is not enough:** the migration destroyed or rewrote data
(a `DROP`, an `UPDATE` without a `WHERE`, a type change that truncated values), or it dropped
an RLS policy and left a table readable. Schema you can rebuild; rows you cannot. That is a
restore, not a fix — go to [`RESTORE-DRILL.md`](RESTORE-DRILL.md), and use point-in-time
recovery to just before the migration rather than the nightly backup if the plan has it.

### 3d · The marketing site is down, the portal is fine

1. Confirm: `curl -sI https://fusedprotectiveservices.com/` fails while
   `curl -sI https://app.fusedprotectiveservices.com/login` returns `200`.
2. Vercel → `fused-protective-services` → Deployments. If the newest production deployment
   is `Error`, or the last push changed `src/` or `build.mjs`, roll back (§2a). The projects
   are independent — this does not touch the portal.
3. If deployments are green, check DNS and the domain: Vercel → the project → **Settings →
   Domains** (an expired or mis-pointed record looks exactly like an outage), then Vercel's
   status page.

**What still works:** the portal, the client portal, every emailed pay link, and Stripe.
Existing clients are unaffected. **What is lost:** new leads — the quote and careers forms
are on the down site. The dispatch line is the only inbound path; make sure whoever answers
it knows to take details by hand.

### 3e · The portal is down, the marketing site is fine

1. Confirm the reverse of 3d, then Vercel → `fused-portal` → Deployments and Logs.
2. Roll back `fused-portal` (§2a) if a deploy caused it. A `200` from `curl` with a blank
   page in a browser is the CSP (§1), not an outage — check the browser console.
3. If deployments are green, the cause is almost always Supabase (§3f) or the `NEXT_PUBLIC_*`
   variables being stored sensitive (RUNBOOK §1).

**What still works: intake.** `/api/intake` lives on the *root* project and talks to Supabase
and Resend directly — leads keep arriving, persisting and alerting while the portal is down.
**What is lost:** every pay link, the client portal, the review pages and the scheduler.
Payments stop. Stripe events queue and retry, so they apply when the portal returns.

### 3f · Supabase itself is unavailable

1. Check <https://status.supabase.com> and Supabase → your project → Logs. If the project is
   *paused* rather than down, resume it — that is a billing state, not an outage.
2. Submit the quote form once with your own address and read the JSON: `delivery.persisted`
   is the truth. `"persisted": false` with `"alerted": true` means the lead reached Cameron's
   inbox but is **not in the database**.
3. Tell whoever answers the dispatch line that leads arriving now must be re-keyed by hand
   once the database is back, and start a list.

**What is honest here, precisely:**

- Intake does **not** fail while email works. A lead counts as delivered if it reached
  storage *or* the owner, so with Resend up the visitor gets a `200`, a real reference code
  and a real confirmation, and the lead is in the dispatch inbox. It is simply not in the
  database — `delivery.persisted: false` says so in the response.
- Only when *no* stage delivers does intake return
  `503 {"error":"not_delivered"}` with *"We could not transmit your request. Please call our
  dispatch line directly."* Nothing is queued and nothing is retried.
- The abuse gate **fails open**: `intake_gate` lives in Postgres, and when it cannot be
  reached the function falls back to a weaker in-process window rather than blocking real
  visitors. Expect more duplicate leads than usual.
- The portal is entirely database-backed and will error on every page.
- The Stripe webhook returns `500 apply_failed` and **Stripe retries for about three days** —
  payments taken during the outage apply themselves afterwards. Do not reconcile by hand.

**Do not invent a queue at 3am.** There is no outbox and no retry buffer anywhere in this
system, by design. Leads taken by phone and written down are the recovery path.

---

## 4. Communication

- **Cameron is told first**, by phone, for anything that touches money, a client detail, or
  the dispatch line. Text only to say a call is coming. If the on-call name in §0 is not
  Cameron, the on-call person makes that call — do not wait to be asked.
- **What a client is told when their detail is affected:** call, do not email — email may be
  the thing that is broken. Say what happened, what it means for their booking, and when you
  will call back with a fix. Give the dispatch line. Never promise a time you are guessing at,
  and never say "the system is fine" while §2 is still in force.
- **A payment problem is always a phone call**, never an email. If a client was charged
  twice, say so before they find it.
- **The dispatch line is the fallback channel for everything.** If the site, the portal and
  email are all down, it is the business. Whoever answers it needs to know an incident is
  running, or they will tell a client the opposite of what you just told them.
- **Do not post an incident notice on the marketing site.** It is a generated static site
  (invariant 1): editing it means editing `src/`, running `node build.mjs` and deploying —
  minutes you do not have, on the surface most likely to be broken.

## 5. After

1. Undo the §2 actions one at a time, checking Portal → Settings → Integrations after each.
2. Re-run the §1 checks, plus `node build.mjs --check`, `node --test 'tests/*.test.mjs'` and
   `cd app && pnpm typecheck && pnpm test` on `main`.
3. Write it down in `PROGRESS.md`: what happened, when it started and stopped, what stopped
   it, and what was lost — leads not persisted, messages the scheduler missed, invoices not
   flipped to `overdue`. The message log and the audit log give you the real list; use them
   rather than memory.
4. If a step in this document was wrong or missing, fix this document in the same pull
   request as the code fix. A procedure that has drifted is worse than none.
