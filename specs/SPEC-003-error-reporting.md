# SPEC-003 — Error reporting and alerting
**Gate:** GO_LIVE.md → D1 · **Surface:** static site + portal
**Size:** M · **Depends on:** SPEC-002 · **Human blocker:** none (uses the existing email transport)

## Why

There is no error reporting anywhere in this repository. Confirmed: no Sentry, no
reporting SDK, no alerting path on either surface. Failures are `console.error`d into
Vercel's log stream, which nobody watches.

That means each of these is currently discovered by a customer, if at all:

- the Stripe webhook throwing before `apply_stripe_payment_event` — a client paid and the
  invoice still says unpaid;
- `/api/cron/tick` failing — no reminders, no overdue chasers, no digest, no symptom;
- a Supabase insert failing in intake — the visitor is told honestly, but nobody is told
  a lead was lost;
- any unhandled exception in a portal server action.

For a system that takes money and dispatches armed officers, "we find out when someone
complains" is not an operating posture.

## Scope

**In**
- A reporting seam on each surface, with severity and context.
- Alerting on the paths where silence costs money or safety.
- Browser error capture on the marketing site, without PII.
- Rate limiting, so an error storm cannot become a mail storm.

**Out**
- Uptime and heartbeat monitoring (SPEC-004).
- Product analytics (SPEC-005).
- Alerting anywhere outside production (SPEC-002 governs that).

## Design

**Deliberately asymmetric, because the constraints are.** The root has no `package.json`
and must keep none; `app/` already carries dependencies and is where money moves.

**1 · Static site and `api/` — zero-dependency reporter.** `api/_lib/report.mjs` exposing
`report(err, { severity, source, context })`:
- always emits one structured JSON line to `console.error` (stable keys: `severity`,
  `source`, `message`, `stack`, `context`, `env`, `at`) so Vercel's log search is useful;
- at `severity: 'error'` and above, emails ops through the existing `sendEmail` transport
  in `api/_lib/email.mjs` — no new vendor, no new key;
- is itself failure-tolerant: a reporter that throws must never take down the handler it
  was reporting from. Wrap everything; on failure, log and return.

**2 · Rate limit the alert, not the log.** Reuse `public.intake_gate` — the same function
that already does per-IP rate limiting for intake — keyed on a hash of
`source + message`. One email per distinct error per window (default 15 minutes);
subsequent occurrences increment a count carried in the next email. Ten thousand failures
must produce a handful of emails, not ten thousand.

**3 · Browser errors.** `js/modules/error-report.mjs` binds `window.onerror` and
`unhandledrejection`, and POSTs to a new `api/client-error.mjs`. Rules:
- same-origin only, through the existing `cors()` helper;
- **no PII**: message, stack, `navigator.userAgent`, viewport, page path. Never form field
  values, never the query string, never `localStorage`;
- sampled (default 100% until volume justifies less) and capped per page load;
- the endpoint validates shape, truncates hard, and routes into `report()` at `warn`.
- Failures here are silent by design — error reporting must never surface an error.

**3a.** The WebGL forge already has a fallback path (`data-forge-fallback`). Report a
fallback activation at `info` so we learn how often three.js fails to load in the wild;
do not alert on it.

**4 · Portal — a real SDK.** `app/` may use one. Add Sentry for Next.js (server + edge +
client), scoped to `app/`, with `tracesSampleRate: 0` initially — errors only, no
performance data, no session replay, nothing that would contradict the privacy policy.
Wrap the three paths that must never fail silently:
- `app/src/app/api/stripe/webhook/route.ts` — report *and* email ops before returning any
  non-2xx, because Stripe's retry is the only other safety net;
- `app/src/app/api/cron/tick/route.ts` — report per-rule failures without aborting the
  remaining rules;
- server actions in `app/src/lib/actions/` — a shared wrapper in `util.ts`.

**5 · Honest degradation.** Without `DISPATCH_ALERT_FROM` (Gate B1) the reporter cannot
email; it must log the skip as `no_verified_sender`, exactly as the notification engine
already does, and never pretend it alerted. Without `SENTRY_DSN` the portal reporter is a
no-op that logs. Both states are normal today and neither may break a request.

## Acceptance

1. `report()` emits one structured JSON line per call with the stable key set.
2. At `error` severity in production it sends one email; a second identical error inside
   the window sends nothing and is counted.
3. Outside production it sends nothing and logs the skip (SPEC-002).
4. With no verified sender configured, it logs `no_verified_sender` and does not throw.
5. A throw inside the reporter never propagates to the calling handler — proven by a test
   that makes the transport throw.
6. `/api/client-error` accepts a same-origin well-formed report, rejects cross-origin,
   truncates oversized payloads, and never stores a form value or query string.
7. A Stripe webhook failure produces an ops email naming the event id.
8. A cron tick failure in one rule does not prevent the other rules from running, and each
   failure is reported.
9. `SENTRY_DSN` absent → portal builds, runs and logs; nothing throws.
10. Both new variables are in `docs/RUNBOOK.md` §9 with what breaks without them.

## Test plan

- `tests/report.test.mjs`: structured shape; dedupe window; transport throwing is
  swallowed; skip reasons for non-production and missing sender.
- `tests/client-error.test.mjs`: cross-origin rejected; oversized truncated; a payload
  containing a `formEmail`-shaped field is not persisted or forwarded.
- `app/tests/`: the server-action wrapper reports and rethrows; the webhook route reports
  before returning non-2xx; a failing cron rule does not abort the tick.
- Manual: throw deliberately in a preview, confirm the log line; flip `VERCEL_ENV` to
  production locally with a stub transport and confirm exactly one email.

## Files

`api/_lib/report.mjs` · `api/client-error.mjs` · `api/intake.mjs` (report the persist
failure) · `js/modules/error-report.mjs` · `js/app.mjs` · `js/logo-forge.js` (fallback
signal) · `app/src/lib/observability.ts` · `app/src/lib/actions/util.ts` ·
`app/src/app/api/stripe/webhook/route.ts` · `app/src/app/api/cron/tick/route.ts` ·
`app/package.json` · `supabase/migrations/<ts>_alert_gate.sql` if the gate needs a key
column · `tests/` · `app/tests/` · `docs/RUNBOOK.md`

## Open decisions

- **Sentry in the portal, or the same email reporter both sides?** *Recommended: Sentry in
  `app/` only.* Stack traces, release tagging and grouping are worth a dependency where
  payments live; the root cannot have one at any price. If Sean would rather not add a
  vendor at all, the email reporter works on both sides — say so in the PR and build that
  instead, don't decide silently.
- **Where do ops alerts go?** *Recommended:* a new `OPS_ALERT_TO`, defaulting to
  `DISPATCH_ALERT_TO`. Cameron should not be paged for a stack trace, but until there is a
  second address, one inbox is better than none.
- **Sampling browser errors:** start at 100%. Revisit once there is a week of volume;
  premature sampling hides the long tail we are trying to find.
