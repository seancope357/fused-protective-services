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

1. **Supabase** — provisioned (`zphyvnouierjwjqjvahs`, via Vercel Marketplace). **12 of 15
   migrations applied (checked 2026-09-14):** `20260914000000_source_env`,
   `20260914120000_candidates_ats` and `20260914140000_alert_gate` are not, and deployed
   code depends on them. A Git deploy never migrates the database — apply any new
   migration before deploying code that needs it.
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

### 1a. Preview must not touch production

The Marketplace integration injects the Supabase variables into **every**
environment, and both Vercel projects build a preview for every pull request.
Until this is done, a form submission on any preview URL writes a real row to
`client_quotes`. The code already labels those rows (`source_env`) and refuses to
email, text or forward anything outside production — this step is what stops a
preview *reading and writing production data at all*.

1. Supabase dashboard → the project → **Branches** → create a persistent branch
   named `preview`. It applies `supabase/migrations/` on creation, so it starts
   schema-identical to production with no data.
2. Copy the branch's **Project URL**, **anon key** and **service_role key** from
   that branch's API settings. They differ from production by project ref — that
   ref is what the portal's preview banner displays, so you can confirm at a
   glance which database a preview is talking to.
3. On **both** Vercel projects, scope those values to preview only. Vercel will
   not accept a second value for a key that already has one in that environment,
   so remove the integration's preview-scoped copy first:

   ```bash
   # root project (fused-protective-services)
   vercel env rm  SUPABASE_URL preview
   vercel env rm  SUPABASE_SERVICE_ROLE_KEY preview
   vercel env add SUPABASE_URL preview
   vercel env add SUPABASE_SERVICE_ROLE_KEY preview

   # portal (cd app)
   vercel env rm  SUPABASE_URL preview
   vercel env rm  SUPABASE_SERVICE_ROLE_KEY preview
   vercel env rm  NEXT_PUBLIC_SUPABASE_URL preview
   vercel env rm  NEXT_PUBLIC_SUPABASE_ANON_KEY preview
   vercel env add SUPABASE_URL preview
   vercel env add SUPABASE_SERVICE_ROLE_KEY preview
   vercel env add NEXT_PUBLIC_SUPABASE_URL preview --no-sensitive
   vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY preview --no-sensitive
   ```

   The two `NEXT_PUBLIC_` values must stay **non-sensitive**: they are inlined at
   build time, and a sensitive value bakes the literal `[SENSITIVE]` into the bundle.
4. Keep Stripe test keys preview-scoped the same way — `STRIPE_SECRET_KEY` on
   preview must be an `sk_test_` key, with its own `STRIPE_WEBHOOK_SECRET` from a
   test-mode endpoint. A preview holding a live key can charge a real card.
5. Leave production untouched. Nothing in this step changes a production value.

**A second Supabase project works identically** if you prefer one over a branch:
same variable names, same scoping, no code changes. The branch is recommended only
because it tracks this repository's migrations and costs nothing extra. Whichever
you choose, **apply new migrations to it as well** — a preview against a stale
schema fails on insert, which looks like a code bug.

**Verify the separation.** Open any preview URL and submit the quote form.

- The response reports `"environment": "preview"`, `delivery.persisted: true`, and
  every other stage `false` with `delivery.skipped.<stage>: "non_production_env"`.
- Nothing arrives in the Leads inbox, on the dispatch phone, or at the webhook.
- The row appears in `client_quotes` **on the branch**, with `source_env = 'preview'`.
- The row does **not** appear in production:
  `SELECT count(*) FROM client_quotes WHERE source_env <> 'production';` returns `0`.
- The portal preview shows a red banner naming the environment and the branch's
  project ref. If it names the production ref, step 3 did not take.
- `GET /api/cron/tick` on a preview (with the bearer token) answers
  `{ "ok": true, "skipped": "non_production_env" }` and sends nothing.

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

### 5a. Manual deploy (CLI, prebuilt)

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

**When something is wrong**, stop reading this file and open
[`INCIDENT.md`](INCIDENT.md): which surface is affected, how to roll back either
Vercel project, how to stop the scheduler, payments or outbound messaging safely,
and the first three steps for the scenarios that have been thought through.
Restoring the database is [`RESTORE-DRILL.md`](RESTORE-DRILL.md) — a procedure,
**not yet a proven one**: nobody has run the drill.

> Four things `INCIDENT.md` corrects about this runbook's assumptions, each
> verified against the source: an environment-variable change does **not** reach a
> running deployment (it needs a redeploy — rolling the Stripe key *in Stripe* is
> the instant move, and leaves the webhook verifying); removing
> `DISPATCH_ALERT_FROM` stops client email but **not** owner alerts, which fall
> back to `onboarding@resend.dev`; a lead counts as delivered if it reached
> storage **or** the owner, so a Supabase outage does not simply lose leads; and
> stopping the scheduler loses the one-tick-wide sends (24 h reminders, the daily
> digest, day 1/7/14 overdue) permanently rather than delaying them.

---

## 8a. Portal dependencies and the supply-chain policy

`app/` is the only workspace with dependencies. Two policies guard it, both in
`app/pnpm-workspace.yaml`, and both will fail CI rather than warn:

**Minimum release age.** A package published within the last 24 hours is rejected. This is the
window in which a compromised release is most likely still live, and it fires on *transitive*
dependencies too — adding one direct dependency can pull in a package published that morning.
When it fires, **resolve to an older version rather than adding an exemption**:

```bash
cd app
pnpm clean --lockfile   # discard the rejected resolution
pnpm install            # re-resolve; the policy steers it to an established version
```

Add to `minimumReleaseAgeExclude` only with a reason and an exact version. There are three
entries today, all React.

**Install scripts are denied by default.** `allowBuilds` records a decision per package, and pnpm
errors on an *undeclared* ignored build — so a new dependency that wants to run code at install
time stops the build until a human decides. `@sentry/cli` is set to `false` deliberately: it
downloads a platform binary for source-map upload, and the Sentry SDK runs server-side only and
needs none of it.

**Use the pinned pnpm.** `app/package.json` sets `"packageManager": "pnpm@11.27.0"`, matching CI.
This matters more than it sounds: pnpm 10 does **not** enforce the release-age check, so an older
pnpm will happily write a lockfile that CI then rejects — which is exactly how the Sentry
dependency first went red. Run `corepack enable` once, or prefix commands with `npx pnpm@11`.

---

## 8b. Changing the marketing site's security headers

`vercel.json` is **generated**. Do not edit it: change `vercelConfig()` in `build.mjs`, run
`node build.mjs`, and commit the result. `node build.mjs --check` fails on a hand edit.

`script-src` carries a sha256 for every inline `<script>` block, and those blocks are built from
`src/data/`. Editing a tier rate, a division or an FAQ answer moves a hash — which is why the
header is generated rather than maintained by hand. Always rebuild and commit `vercel.json`
alongside the data change.

`python3 serve.py` sends the same headers, read out of `vercel.json`, so a violation surfaces
locally instead of in production. It refuses to start if `vercel.json` is missing or has no
`/(.*)` rule. Set `FPS_PREVIEW_PORT` to run two checkouts at once (defaults to 5050).

**Sweeping for violations after a markup change.** Run `python3 serve.py`, then load `/`,
`/careers`, `/invoice`, `/privacy`, `/terms` and `/sms-consent` with the console open. Scroll each
page to the bottom — the reveal modules and the forge only run in view, and a violation that only
happens on scroll is still a violation. Any `Refused to…` line is a defect in the change, not in
the policy: fix the markup, do not loosen a directive.

**Upgrading three.js.** Download the same jsDelivr URL at the new version, replace everything below
the `upstream bytes begin` marker in `js/vendor/three.module.js`, update the version, URL and
sha256 in that file's header and `THREE_SHA256` in `tests/csp.test.mjs`, then re-sweep. Never patch
vendored code in place.

**Adding or changing a font.** Re-request the Google Fonts CSS with a current Chrome user agent,
save the woff2 into `assets/fonts/`, add its family, subset, weights, bytes, sha256 and source to
`assets/fonts/SOURCES.txt`, and declare it in `src/styles/base.css`. The build fails if a declared
font is missing; the tests fail if a committed font's hash does not match the manifest, or if a
committed font is not declared.

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
| `DISPATCH_ALERT_FROM` | both | verified sender; required for any email to the public. **Also gates error alerting** — without it `report()` logs the skip as `no_verified_sender` and emails nothing (GO_LIVE D1a) |
| `OPS_ALERT_TO` | both | where stack traces go. Nothing breaks without it and nothing is faked: alerts fall back to `DISPATCH_ALERT_TO`, and with neither set `report()` records the skip as `no_recipient`. Set it so a stack trace reaches an engineer rather than whoever is on the dispatch line. Comma-separated. |
| `SENTRY_DSN` | portal | Sentry, server and edge runtimes only. Nothing breaks without it — `initSentry()` logs that it is unset and returns false; errors are still logged and still emailed. **This is the normal state today**; there is no Sentry project yet. A browser DSN would be `NEXT_PUBLIC_SENTRY_DSN` *and* a `connect-src` change, which a test currently blocks on purpose. |
| `ALERT_DEDUPE_SECONDS` | both | optional; defaults to 900 (15 min). Only worth setting during a noisy incident. Non-numeric or non-positive falls back to 900. |
| `DISPATCH_ALERT_TO` | both | owner alert inbox (fallback for Settings) |
| `DISPATCH_ALERT_SMS_TO` | both | owner alert mobile (fallback for Settings) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | both | SMS; inbound signature check |
| `TWILIO_MESSAGING_SERVICE_SID` or `TWILIO_FROM` | both | SMS sender |
| `VERCEL_ENV` | both | set automatically by Vercel; the only input to `deployEnv()`. Absent means development, so a non-Vercel runtime never sends. **Never set this by hand.** |
| `DISPATCH_ALERT_WEBHOOK` | root | optional JSON forward |
| `STRIPE_SECRET_KEY` | portal | payments |
| `STRIPE_WEBHOOK_SECRET` | portal | payment confirmation |
