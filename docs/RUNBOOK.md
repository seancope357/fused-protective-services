# RUNBOOK — Fused Protective Services

Operational setup for the live intake pipeline (`/api/intake`). Everything here is
configured in Vercel (`vercel env add NAME production preview development`) unless
stated otherwise. Order matters: persistence first, then alerts, then the extras.

Vercel project: `fused-protective-services`. Supabase project ref: `zphyvnouierjwjqjvahs`.

---

## 0. Prerequisite: database migrations

```bash
supabase link --project-ref zphyvnouierjwjqjvahs
supabase db push
```

This applies `supabase/migrations/20260909000000_intake_abuse_controls.sql`, which
creates `public.intake_attempts`. Until it exists the rate limit and duplicate
guard log a query error and **fail open** (every request is allowed) — leads are
never blocked by a missing table, but neither are bots.

Verify: Supabase Dashboard → Table Editor → `intake_attempts` exists, RLS on, one
policy (`service_role_full_access_intake_attempts`), no `anon` policy.

Housekeeping: the ledger only matters for the last 10 minutes. Prune whenever it
gets large: `delete from public.intake_attempts where created_at < now() - interval '1 day';`

---

## 1. Dispatch alerts (Resend)

Stage 2 of the chain. Without this, leads sit in Supabase unannounced.

1. **Install the integration.** Accept Resend's marketplace terms in the browser
   (Vercel Dashboard → Integrations → Resend), then:
   ```bash
   vercel integration add resend --name fused-dispatch-alerts
   ```
   This injects `RESEND_API_KEY` into all three environments. Confirm with
   `vercel env ls`.

2. **Verify the sending domain.** Resend Dashboard → Domains → Add
   `fusedprotectiveservices.com`. Resend shows a DKIM record (three CNAMEs or one
   TXT, depending on the region) and an SPF record (TXT on the `send` subdomain
   plus an MX). Add them at the DNS host and wait for the domain to show
   **Verified**. Optionally add DMARC:
   `_dmarc TXT "v=DMARC1; p=none; rua=mailto:dispatch@fusedprotectiveservices.com"`.

   Until the domain is verified the code falls back to
   `Fused Dispatch <onboarding@resend.dev>`. **That sender only delivers to the
   email address that owns the Resend account.** Any other recipient — Cameron,
   a client auto-reply — is silently refused by Resend. Do not consider alerts
   live until the domain is verified.

3. **Set the sender.**
   ```bash
   vercel env add DISPATCH_ALERT_FROM   # Fused Dispatch <dispatch@fusedprotectiveservices.com>
   ```
   Must be an address on the verified domain.

4. **Set the recipient(s)** in all three environments:
   ```bash
   vercel env add DISPATCH_ALERT_TO     # cameron@... (comma-separated for more)
   ```
   Preview and development can point at an engineer's inbox while testing; switch
   them to Cameron's before hand-off so preview submissions are not lost.

5. **Verify end to end.**
   1. Open a preview deployment (`vercel --prod=false` or any PR preview URL).
   2. Submit the Security Detail Quote form with a real email you can read.
   3. Check the `DISPATCH_ALERT_TO` inbox for `[FPS] New quote request TX-FPS-…`.
   4. Check the submitter inbox for `Fused Protective Services — request TX-FPS-… received`.
   5. Supabase → Table Editor → `client_quotes`: a row with that `ref_code`, and
      `intake_attempts`: a row carrying the same `ref_code`.
   6. In the browser Network tab the `/api/intake` response should read
      `delivery: { persisted: true, alerted: true, clientNotified: true, … }`.
      Any `false` there is the stage to debug; the Vercel function log names it.

---

## 2. Client auto-reply (Resend, Stage 2b)

Uses the same Resend key and sender as the dispatch alert; nothing extra to
install. It sends only after at least one delivery stage succeeded, and its
failure never changes the response status (reported as `delivery.clientNotified`).

```bash
vercel env add DISPATCH_PHONE_DISPLAY  # e.g. (512) 555-0199 — the number the client is told to call
```

Optional. If unset the number comes from `src/data/site.mjs` (`site.phone.display`),
which is also what the page prints, so the two agree by default. Set it only when
dispatch wants a different callback line for confirmations than the one on the site.

Replies to the confirmation go to the first `DISPATCH_ALERT_TO` address.

---

## 3. Emergency SMS (Twilio, Stage 2c)

Fires only for **client quotes triaged `emergency`** (Emergency / Tactical
Dispatch / Level IV PPO divisions). One SMS per number in `DISPATCH_ALERT_SMS_TO`,
under 160 characters: reference, division, name, phone, location.

1. Create a Twilio account (twilio.com), buy a US number with SMS capability
   (Phone Numbers → Buy a number). For production US traffic Twilio requires
   A2P 10DLC registration of the brand and campaign; a trial account can only
   text verified numbers, which is enough to test.
2. Twilio Console → Account Info gives the SID and Auth Token.
3. Set, in all three environments:
   ```bash
   vercel env add TWILIO_ACCOUNT_SID      # ACxxxxxxxx…
   vercel env add TWILIO_AUTH_TOKEN       # secret — never paste into chat or logs
   vercel env add TWILIO_FROM_NUMBER      # +1512…, the purchased number, E.164
   vercel env add DISPATCH_ALERT_SMS_TO   # +1512…,+1737… Cameron's phone(s), E.164, comma-separated
   ```
   Any of the four missing = stage skipped, `delivery.smsAlerted: false`.

Verify: on preview, submit a quote with division **Emergency / Tactical Dispatch**.
Expect a text on each number within seconds, `delivery.smsAlerted: true` in the
response, and the dispatch email subject prefixed `🚨 EMERGENCY`. Twilio Console →
Monitor → Logs → Messaging shows delivery status and any carrier error codes. The
function log never contains the auth token; only Twilio's status and error message.

---

## 4. Abuse controls (Stage 0)

Backed by `public.intake_attempts` (see section 0). Behaviour:

| Condition | Response |
| :--- | :--- |
| Hidden `website` field non-empty (honeypot) | `200 { ok: true, message: "Request received." }` — nothing persisted, nothing alerted. Logged as `Honeypot filled`. |
| More than 5 submissions from one IP in 10 minutes | `429 { ok: false, error: "rate_limited" }` with a message to call dispatch. |
| Same email + phone + division within 10 minutes | `200 { ok: true, duplicate: true, refCode }` pointing at the original reference. No second row, no second alert. |
| Ledger query fails | Logged, request proceeds (fail open). |

```bash
vercel env add INTAKE_HASH_SALT   # openssl rand -hex 32
```

IPs and contact details are stored only as `sha256(salt:value)`. Use one salt per
environment and never rotate it casually — rotating resets the 10-minute window
(harmless) and orphans old rows (also harmless, they age out). If unset the code
uses a fixed salt and logs `INTAKE_HASH_SALT is unset` once per instance; the
guard still works but the hashes become dictionary-reversible.

CORS: `/api/intake` sets `Access-Control-Allow-Origin` only for
`https://fusedprotectiveservices.com`, `https://www.fusedprotectiveservices.com`,
`https://*.vercel.app` previews, and `http://localhost:*`. The site's own forms
are same-origin and never need it. Adding a new front-end host means editing
`ALLOWED_ORIGIN` in `api/intake.js`.

Verify: submit the same quote twice within a minute — the second returns the
duplicate message on screen and only one row exists in `client_quotes`. Submit six
in ten minutes from one connection — the sixth shows the call-dispatch message.

---

## 5. Environment variable reference

| Variable | Required | Stage | Purpose / where to get it |
| :--- | :--- | :--- | :--- |
| `SUPABASE_URL` | yes | 0, 1 | Injected by the Vercel Marketplace Supabase integration. |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | 0, 1 | Injected by the same integration. Server-only; bypasses RLS. |
| `RESEND_API_KEY` | yes | 2, 2b | Injected by `vercel integration add resend`. |
| `DISPATCH_ALERT_TO` | yes | 2 | Comma-separated dispatch inboxes. Cameron's address. First entry is the Reply-To on client confirmations. |
| `DISPATCH_ALERT_FROM` | yes (prod) | 2, 2b | Verified sender on `fusedprotectiveservices.com`. Default `onboarding@resend.dev` reaches only the Resend account owner. |
| `DISPATCH_PHONE_DISPLAY` | no | 2b, 0 | Callback number quoted in confirmations and the 429 message. Falls back to `site.phone.display`. |
| `TWILIO_ACCOUNT_SID` | for SMS | 2c | Twilio Console → Account Info. |
| `TWILIO_AUTH_TOKEN` | for SMS | 2c | Twilio Console → Account Info. Secret. |
| `TWILIO_FROM_NUMBER` | for SMS | 2c | Purchased Twilio number, E.164. |
| `DISPATCH_ALERT_SMS_TO` | for SMS | 2c | Comma-separated E.164 numbers paged on emergency quotes. |
| `INTAKE_HASH_SALT` | recommended | 0 | `openssl rand -hex 32`. Salts the IP / contact hashes in `intake_attempts`. |
| `DISPATCH_ALERT_WEBHOOK` or `HUBSPOT_WEBHOOK_URL` | no | 3 | JSON webhook for HubSpot / Zapier / Slack. |

Delivery stages that count toward "something was delivered": 1 (persist), 2
(dispatch email), 2c (SMS), 3 (webhook). If all configured ones fail the visitor
gets a 503 and is told to call. Stage 2b (client confirmation) is reported but
never counts — a confirmation of a request nobody received is not a delivery.
