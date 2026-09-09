# RUNBOOK — Fused Protective Services

Environment variables, third-party accounts, the order to configure them, and how
to verify each one end to end. Every value below is set in Vercel
(`vercel env add NAME production` or the dashboard), never committed.

Two Vercel projects exist once Phase 1 ships:

| Project | Root | Serves |
| :--- | :--- | :--- |
| `fused-protective-services` | repo root | Static marketing site, careers, legal pages, `/api/intake`, `/api/stripe-checkout` |
| `fused-portal` | `app/` | Next.js operations platform at `app.fusedprotectiveservices.com` |

Both need the Supabase variables. Only the root project needs the intake variables.
Only the portal needs Stripe webhook and cron secrets.

---

## 0. Order of operations

1. **Supabase** — already provisioned (`zphyvnouierjwjqjvahs`, via Vercel Marketplace).
   Apply new migrations before deploying code that depends on them.
2. **Resend** — verify the sending domain first, then install the integration,
   then set `DISPATCH_ALERT_FROM`. Doing it in this order means the first alert
   that goes out is deliverable to anyone, not just the account owner.
3. **Twilio** — buy a number, register A2P 10DLC, set the four variables.
4. **Stripe** — live keys and the webhook endpoint (Phase 1).
5. **Owner account** — invite Cameron to the portal (Phase 1).
6. **Cron secret** — for the notification scheduler (Phase 1).

Each section ends with a verification step. Do not move on until it passes.

---

## 1. Supabase (persistence, auth, RLS)

| Variable | Where it comes from |
| :--- | :--- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Vercel Marketplace integration (auto-injected). Service role is server-only. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same integration. Safe for the browser: RLS is the boundary. |
| `INTAKE_HASH_SALT` | Optional. Any random string. Salts the IP and payload hashes in `public.intake_gate`. |

**Applying migrations.** The Supabase CLI on the build machine is logged into a
different organisation and cannot see this project. Use the claude.ai Supabase
connector or the SQL editor in the Supabase dashboard, applying files from
`supabase/migrations/` in filename order. Record each one with the same name so
`supabase migration list` stays aligned.

**Verify.** Submit the quote form on a preview deployment. The response JSON
carries `delivery.persisted: true`; the row appears in `client_quotes`.

---

## 2. Resend (email)

### 2a. Verify the sending domain

1. Sign in to <https://resend.com> with the account that owns the Vercel team.
2. Domains → Add Domain → `fusedprotectiveservices.com`.
3. Resend shows three DNS records (an MX and two TXT: SPF and DKIM). Add them at
   the domain registrar. DMARC (`_dmarc` TXT, `v=DMARC1; p=none;`) is recommended.
4. Wait for the domain to show **Verified** (usually under an hour).

### 2b. Install the integration

1. In the Vercel dashboard, open Marketplace → Resend. Accept the terms. (Vercel
   requires a human to accept marketplace terms; agents cannot.)
2. In the repo: `vercel integration add resend --name fused-dispatch-alerts`.
   This injects `RESEND_API_KEY` into every environment.

### 2c. Set recipients and sender

| Variable | Value |
| :--- | :--- |
| `DISPATCH_ALERT_TO` | Comma-separated. Cameron's dispatch inbox. Currently Sean's address. |
| `DISPATCH_ALERT_FROM` | `Fused Dispatch <dispatch@fusedprotectiveservices.com>` — must be on the verified domain. |

Until `DISPATCH_ALERT_FROM` is set, owner alerts fall back to
`onboarding@resend.dev`, which Resend delivers **only to the account owner**, and
the visitor confirmation email is skipped (reported as `delivery.confirmed: false`).

**Verify.** Submit the quote form with your own email address. Two emails arrive:
the owner alert at `DISPATCH_ALERT_TO`, and the confirmation at the address you
typed, carrying the same reference code the page displayed.

---

## 3. Twilio (SMS)

### 3a. Account and number

1. Create a Twilio account, buy a local Texas number (512 or 210 area code).
2. **A2P 10DLC registration is mandatory** for application-to-person SMS in the
   US. Register the brand (Fused Protective Services, EIN required) and a
   campaign ("Customer care / account notifications"). Unregistered traffic is
   filtered by carriers. Allow several business days.
3. Create a Messaging Service, add the number to it, and enable Advanced Opt-Out
   so STOP / START are honoured at the carrier level as well as in the app.

### 3b. Variables

| Variable | Value |
| :--- | :--- |
| `TWILIO_ACCOUNT_SID` | From the Twilio console. |
| `TWILIO_AUTH_TOKEN` | From the Twilio console. Sensitive. |
| `TWILIO_MESSAGING_SERVICE_SID` | Preferred: the 10DLC-registered service (`MG…`). |
| `TWILIO_FROM` | Fallback only: one E.164 number, used when no messaging service is set. |
| `DISPATCH_ALERT_SMS_TO` | Comma-separated E.164 numbers. Cameron's mobile. |

**Verify.** Submit the quote form with **Emergency Tactical Dispatch** selected.
The DB trigger sets `priority = 'emergency'`; the response shows
`delivery.smsAlerted: true`; the text arrives at `DISPATCH_ALERT_SMS_TO`.

---

## 4. Stripe (payments)

| Variable | Value |
| :--- | :--- |
| `STRIPE_SECRET_KEY` | `sk_live_…` in production, `sk_test_…` in preview. |
| `STRIPE_WEBHOOK_SECRET` | Phase 1. `whsec_…` for the portal's `/api/stripe/webhook` endpoint. |

Enable **ACH Direct Debit (US bank account)** in Stripe Dashboard → Settings →
Payment methods. Checkout is created with `card` and `us_bank_account`.

Without `STRIPE_SECRET_KEY`, `/api/stripe-checkout` answers **503
`payments_not_configured`**. There is no mock link.

**Verify (Phase 0).** Insert a test row in `public.invoices`, then:

```bash
curl -s -X POST https://<deployment>/api/stripe-checkout \
  -H 'Content-Type: application/json' \
  -d '{"invoiceId":"<uuid>"}'
```

The response carries `amountCents` equal to the stored `total`, and `url` opens a
Checkout page for exactly that amount. Posting a different `totals` field changes
nothing.

---

## 5. Deploying

```bash
node build.mjs --check          # must pass; CI runs it on every push
node --test 'tests/*.test.mjs'  # API behaviour, no network
vercel --prod                   # root project
```

Preview deployments are behind Vercel Authentication; use `vercel curl` or open
the URL in a signed-in browser. On any non-production host the page shows a
red **PLACEHOLDER** flag next to the phone number and licence number until
Cameron supplies them (see `docs/OPEN_QUESTIONS.md`).

---

## 6. Environment variable index

| Variable | Project | Required for |
| :--- | :--- | :--- |
| `SUPABASE_URL` | both | persistence |
| `SUPABASE_SERVICE_ROLE_KEY` | both | server-side persistence (never in the browser) |
| `NEXT_PUBLIC_SUPABASE_URL` | portal | browser auth |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | portal | browser auth |
| `INTAKE_HASH_SALT` | root | optional hash salt |
| `RESEND_API_KEY` | both | email |
| `DISPATCH_ALERT_FROM` | both | verified sender; required for any email to the public |
| `DISPATCH_ALERT_TO` | both | owner alert inbox |
| `DISPATCH_ALERT_SMS_TO` | both | owner alert mobile |
| `TWILIO_ACCOUNT_SID` | both | SMS |
| `TWILIO_AUTH_TOKEN` | both | SMS |
| `TWILIO_MESSAGING_SERVICE_SID` | both | SMS (preferred sender) |
| `TWILIO_FROM` | both | SMS (fallback sender) |
| `DISPATCH_ALERT_WEBHOOK` | root | optional JSON forward |
| `STRIPE_SECRET_KEY` | both | payments |
| `STRIPE_WEBHOOK_SECRET` | portal | payment confirmation (Phase 1) |
