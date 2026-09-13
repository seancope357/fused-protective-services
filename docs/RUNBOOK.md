# RUNBOOK — Fused Protective Services

Environment variables, third-party accounts, the order to configure them, and how
to verify each one end to end. For *what must be true before launch* — including the
operational items this file does not cover — see [`GO_LIVE.md`](GO_LIVE.md).

 Every value below is set in Vercel
(`vercel env add NAME production` or the dashboard), never committed.

Two Vercel projects, one repository:

| Project | Root | Serves |
| :--- | :--- | :--- |
| `fused-protective-services` | repo root | Static marketing site, careers, legal pages, `/invoice` (legacy export), `/api/intake` |
| `fused-portal` | `app/` | Next.js operations platform — owner portal, client portal, `/pay`, `/review`, Stripe webhook, scheduler |

Both need the Supabase variables. Only the root project needs the intake variables.
Only the portal needs Stripe webhook and cron secrets.

---

## 0. Order of operations

1. **Supabase** — provisioned (`zphyvnouierjwjqjvahs`, via Vercel Marketplace). All ten
   migrations are applied. Apply any new migration before deploying code that needs it.
2. **Portal project** — created, Git-connected, deploys on push (§5).
3. **Owner account** — created for Sean (§6). Create Cameron's from Settings once signed in.
4. **Resend** — verify the domain, install, set `DISPATCH_ALERT_FROM`. Until this is done
   nobody but the Resend account owner receives email, and client magic links cannot be
   delivered — clients cannot sign in.
5. **Twilio** — number, A2P 10DLC, inbound webhook, variables.
6. **Stripe** — keys, webhook endpoint, ACH enabled.
7. **Custom domains** — `fusedprotectiveservices.com` and `app.fusedprotectiveservices.com`.

Each section ends with a verification step. Do not move on until it passes.

---

## 1. Supabase (persistence, auth, RLS)

| Variable | Project | Where it comes from |
| :--- | :--- | :--- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | both | Marketplace integration on the root project; copied to `fused-portal`. Service role is server-only. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | portal | Same values. **Must be stored non-sensitive** (`vercel env add … --no-sensitive`): they are inlined at build time, and a sensitive value bakes the literal `[SENSITIVE]` into the bundle. |
| `INTAKE_HASH_SALT` | root | Optional. Any random string. Salts the IP and payload hashes in `public.intake_gate`. |

**Applying migrations.** The Supabase CLI on the build machine is logged into a
different organisation and cannot see this project. Use the claude.ai Supabase
connector or the SQL editor in the Supabase dashboard, applying files from
`supabase/migrations/` in filename order, then set the recorded version to match
the filename (`UPDATE supabase_migrations.schema_migrations SET version = … WHERE name = …`)
so the history stays aligned with the repository.

**Testing migrations locally** needs only Postgres 17 and `psql`, no Docker:

```bash
cd app
TEST_DATABASE_URL=postgres://localhost/fused_test node scripts/reset-test-db.mjs
TEST_DATABASE_URL=postgres://localhost/fused_test pnpm exec vitest run tests/db
```

`supabase/tests/auth_shim.sql` reproduces the `auth` schema and roles the policies
depend on. The RLS suite proves a client cannot read another client's invoice.

**Verify.** Submit the quote form on the live site. The response JSON carries
`delivery.persisted: true`; the row appears in `client_quotes` and in the portal's
Leads inbox.

---

## 2. Resend (email)

### 2a. Verify the sending domain

1. Sign in to <https://resend.com> with the account that owns the Vercel team.
2. Domains → Add Domain → `fusedprotectiveservices.com`.
3. Add the DNS records Resend shows (MX, SPF TXT, DKIM TXT) at the registrar. Add a
   DMARC record (`_dmarc` TXT, `v=DMARC1; p=none;`).
4. Wait for **Verified**.

### 2b. Install the integration

1. Vercel dashboard → Marketplace → Resend → accept the terms (a human must).
2. In the repo root: `vercel integration add resend --name fused-dispatch-alerts`. This
   injects `RESEND_API_KEY` into the root project. Copy it to `fused-portal`:
   `cd app && vercel env add RESEND_API_KEY production`.

### 2c. Set recipients and sender (both projects)

| Variable | Value |
| :--- | :--- |
| `DISPATCH_ALERT_TO` | Comma-separated. Cameron's dispatch inbox. Currently Sean's address. Overridable in Portal → Settings. |
| `DISPATCH_ALERT_FROM` | `Fused Dispatch <dispatch@fusedprotectiveservices.com>` — must be on the verified domain. |

Until `DISPATCH_ALERT_FROM` is set: owner alerts fall back to `onboarding@resend.dev`
(delivers **only to the Resend account owner**); visitor confirmations, proposals,
briefs, invoices, receipts and **client sign-in links are skipped** and logged as
`no_verified_sender` in Portal → Message log.

**Verify.** Submit the quote form with your own email. Two emails arrive: the owner
alert and the confirmation carrying the same reference code. Then in the portal,
Clients → a client with your email → *Invite billing contact*: the sign-in link
arrives and opens the client portal.

---

## 3. Twilio (SMS)

### 3a. Account, number, registration

1. Create a Twilio account and buy a Texas number (512 or 210).
2. **A2P 10DLC registration is mandatory.** Register the brand (EIN required) and a
   "customer care / account notifications" campaign. Allow several business days.
3. Create a Messaging Service, add the number, enable **Advanced Opt-Out**.
4. Messaging Service → Integration → *Send a webhook* → request URL
   `https://app.fusedprotectiveservices.com/api/twilio/inbound` (POST). This records
   STOP/START in `public.sms_opt_outs`; the engine never texts an opted-out number.

### 3b. Variables (both projects)

| Variable | Value |
| :--- | :--- |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | Twilio console. The auth token also verifies inbound webhook signatures. |
| `TWILIO_MESSAGING_SERVICE_SID` | The 10DLC-registered service (`MG…`). Preferred. |
| `TWILIO_FROM` | Fallback only: one E.164 number. |
| `DISPATCH_ALERT_SMS_TO` | Cameron's mobile, E.164. Overridable in Portal → Settings. |

**Verify.** Submit the quote form with **Emergency Tactical Dispatch** selected; the
text arrives at `DISPATCH_ALERT_SMS_TO` and Portal → Message log shows `sent`. Reply
STOP from that phone; `sms_opt_outs` gains a row.

---

## 4. Stripe (payments)

| Variable | Project | Value |
| :--- | :--- | :--- |
| `STRIPE_SECRET_KEY` | portal | `sk_live_…` in production, `sk_test_…` in preview. |
| `STRIPE_WEBHOOK_SECRET` | portal | `whsec_…` from the endpoint below. |

1. Stripe Dashboard → Settings → Payment methods → enable **ACH Direct Debit**.
2. Developers → Webhooks → Add endpoint
   `https://app.fusedprotectiveservices.com/api/stripe/webhook` with events
   `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`.
   Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

The webhook is the source of truth. Signature verified; event id deduplicated in
`public.stripe_events`; invoice and payment updated in one transaction by
`apply_stripe_payment_event()`; receipt and owner alert sent only when the
transaction reports it applied. The browser redirect changes nothing.

**Verify (test mode).** Portal → Invoices → *Blank invoice* → add a line → *Send with
pay link* → open the pay link → pay with card `4242 4242 4242 4242`. Within seconds the
invoice shows **paid** with one payment row; Message log shows `payment_received` and
`payment_receipt`. Replay the event from the Stripe dashboard: the response is
`duplicate_event` and nothing changes.

---

## 5. Portal deployment

### 5a. Deploying today (CLI, prebuilt)

```bash
cd app
vercel pull --yes --environment=production   # env for the build
vercel build --prod                          # runs scripts/sync-shared.mjs, then next build
vercel deploy --prebuilt --prod --yes
```

`scripts/sync-shared.mjs` mirrors `src/data`, `src/lib`, `src/styles/tokens.css` and
`api/_lib` into `app/shared/` (gitignored) so the portal reads the same business facts
the static site is generated from without importing above its root.

### 5b. Automatic Git deploys — configured 2026-09-09

`fused-portal` has Root Directory `app`, framework Next.js, "include source files outside
the root directory" on, and the GitHub repo connected with production branch `main`.
Every push to `main` deploys both projects; pull requests get previews of both. §5a
remains available for a manual deploy.

### 5c. Portal-only variables

| Variable | Value |
| :--- | :--- |
| `APP_URL` | `https://app.fusedprotectiveservices.com` once DNS exists; currently `https://fused-portal.vercel.app`. Used in every emailed link. |
| `CRON_SECRET` | Random string. Vercel Cron sends it as a bearer token to `/api/cron/tick` hourly (`app/vercel.json`). |

**Verify.** `curl -H "Authorization: Bearer $CRON_SECRET" https://fused-portal.vercel.app/api/cron/tick`
returns `{"ok":true,"report":{…}}`. Without the header: 401.

---

## 6. Accounts

Command staff must enroll an authenticator app (TOTP) on first sign-in; the database refuses staff data to a password-only session once a factor exists. Sign-in attempts are limited (10 per address, 5 per email, per 15 minutes). Sessions end after 8 hours idle or 72 hours total. A nonce-based Content Security Policy and HSTS are set by the proxy and `next.config.ts`.

- **Owner (Sean)** exists: `seancope357@gmail.com`, role `owner`. The initial password is
  in `~/.fused-portal-owner-initial-password` on the build Mac (mode 600); change it at
  Portal → Settings → *Change my password*, then delete the file.
- **Cameron**: Portal → Settings → *Add command staff* (owner only), role `owner`.
- **Clients**: never created by hand. Portal → Clients → *Invite billing contact* creates
  the scoped user and emails a sign-in link (needs §2).
- Any account can also sign in by emailed link from `/login` once §2 is done.

---

## 7. Custom domains

1. Registrar: `A`/`CNAME` for `fusedprotectiveservices.com` and `www` per Vercel's
   instructions for the root project; `CNAME app → cname.vercel-dns.com` for the portal.
2. Vercel → each project → Settings → Domains → add the domain.
3. Set `APP_URL` on the portal to `https://app.fusedprotectiveservices.com`; redeploy.
4. `src/data/site.mjs` already points `portalUrl` at the app subdomain.

---

## 8. Everyday operations

```bash
node build.mjs --check              # static site drift (CI)
node --test 'tests/*.test.mjs'      # intake function tests (CI)
cd app && pnpm typecheck && pnpm test && pnpm test:db   # portal (CI does all three)
```

The CI workflow (`.github/workflows/ci.yml`) runs the drift check, the intake tests,
the portal typecheck, the unit suite, the RLS and numbering suite against a Postgres
service container, and `next build` on every push and pull request.

---

## 9. Environment variable index

| Variable | Project | Required for |
| :--- | :--- | :--- |
| `SUPABASE_URL` | both | persistence |
| `SUPABASE_SERVICE_ROLE_KEY` | both | server-side persistence (never in the browser) |
| `NEXT_PUBLIC_SUPABASE_URL` | portal | auth (non-sensitive) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | portal | auth (non-sensitive) |
| `APP_URL` | portal | links in email and SMS |
| `CRON_SECRET` | portal | scheduler |
| `INTAKE_HASH_SALT` | root | optional hash salt |
| `RESEND_API_KEY` | both | email |
| `DISPATCH_ALERT_FROM` | both | verified sender; required for any email to the public |
| `DISPATCH_ALERT_TO` | both | owner alert inbox (fallback for Settings) |
| `DISPATCH_ALERT_SMS_TO` | both | owner alert mobile (fallback for Settings) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | both | SMS; inbound signature check |
| `TWILIO_MESSAGING_SERVICE_SID` or `TWILIO_FROM` | both | SMS sender |
| `DISPATCH_ALERT_WEBHOOK` | root | optional JSON forward |
| `STRIPE_SECRET_KEY` | portal | payments |
| `STRIPE_WEBHOOK_SECRET` | portal | payment confirmation |
