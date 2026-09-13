# SPEC-004 — Health checks and a cron dead-man's switch
**Gate:** GO_LIVE.md → D2 · **Surface:** static site + portal
**Size:** M · **Depends on:** SPEC-003 · **Human blocker:** the external monitor account (Sean)

## Why

`app/vercel.json` schedules `/api/cron/tick` hourly. That one endpoint drives the 2-hour
unanswered-lead alert, day-before reminders, the unstaffed-job warning, review requests,
overdue chasers at day 1/7/14, and the 7am Central digest.

If it stops running, **nothing reports it**. Every symptom is an absence: a lead nobody
chased, an invoice nobody pursued, a morning with no digest. The first person to notice is
Cameron, weeks later, wondering why business got quiet.

There is also no way to ask either deployment "are you healthy and correctly configured?"
short of submitting a real form.

## Scope

**In**
- A health endpoint on each surface, safe to expose publicly.
- A persisted heartbeat written by the scheduler.
- A dead-man's switch that alerts when the scheduler misses its window.
- The documented external-monitor setup.

**Out**
- Choosing or paying for the monitoring vendor (Sean).
- Error reporting itself (SPEC-003, which this uses).
- Performance monitoring (SPEC-009).

## Design

**1 · `/api/health` on both surfaces.** Returns `200` with a small JSON body when healthy,
`503` when a dependency it needs is unreachable.

```
{ ok, env, checks: { supabase: 'ok'|'unreachable', … }, configured: { resend, twilio, stripe }, at }
```

Hard rules: the `configured` map reports **booleans only** — whether a variable is present,
never any part of its value, never a URL, never a project ref. No stack traces. No counts
that reveal business volume. Assume it is indexed and scraped; it must still be boring.
`Cache-Control: no-store`.

**2 · Heartbeat.** `/api/cron/tick` records its run: `last_tick_at`, duration, and a
per-rule outcome summary. Store it in the existing `settings` table under a reserved key,
or a small `heartbeats` table if `settings` is a strict key/value shape — check before
choosing, and prefer not adding a table for one row.

**3 · Dead-man's switch, two layers.**

*Self-check (catches a late tick):* at the start of every tick, if `last_tick_at` is more
than 2 hours old, report at `error` through SPEC-003 — "the scheduler did not run between
X and Y" — and continue. This catches a scheduler that stalled and recovered, which an
external monitor watching only for a response would miss.

*External (catches a dead tick):* the health endpoint reports heartbeat staleness, so a
tick that never comes back turns the portal health check red within the hour. This is the
layer that survives the whole deployment being down — a process cannot alert about its own
death.

**4 · What the external monitor watches** — documented in `docs/RUNBOOK.md`, set up by
Sean:

| Check | Target | Alert when |
| :--- | :--- | :--- |
| Marketing site | `GET /api/health` | non-200 twice in a row |
| Marketing page | `GET /` | non-200, or the string `Fused` missing |
| Portal | `GET /api/health` on the portal | non-200 twice in a row, or heartbeat stale |
| Intake liveness | `POST /api/intake` with the honeypot field filled | non-200 |

The honeypot synthetic is the neat part: `api/_lib/gate.mjs` already answers a
honeypot-tripped submission with a plausible `200` and sends nothing anywhere. So the
monitor exercises routing, the function, CORS and the gate, end to end, **without** writing
a row, emailing anyone or polluting the leads inbox. Document it as the intended use so
nobody later "fixes" it.

**5 · Cron secret unchanged.** `/api/cron/tick` keeps requiring `CRON_SECRET`. Health is
public; the tick is not.

## Acceptance

1. `GET /api/health` on both surfaces returns the documented shape and never leaks a secret,
   a URL, a project ref or a business metric — asserted by a test over the response keys.
2. Supabase unreachable → `503` with `checks.supabase: 'unreachable'`, and the endpoint
   still responds rather than hanging (bounded timeout).
3. `configured` is boolean-only for every integration.
4. Each tick persists `last_tick_at` and a per-rule summary.
5. A tick starting more than 2 hours after the previous one reports at `error` severity and
   still completes its work.
6. Portal health reports heartbeat staleness and goes `503` past the threshold.
7. A honeypot-tripped POST to `/api/intake` still returns `200`, writes no row and sends
   nothing — a regression test, since the monitor now depends on it.
8. `docs/RUNBOOK.md` gains a monitoring section with the four checks and their thresholds.

## Test plan

- `tests/health.test.mjs`: response shape; no value of any secret appears anywhere in the
  body (assert against a set of seeded fake secrets); Supabase failure → 503; timeout is
  bounded.
- `tests/intake.test.mjs`: keep and strengthen the existing honeypot case, with a comment
  naming SPEC-004 as a second consumer.
- `app/tests/notifications.test.ts`: heartbeat written; stale previous tick triggers exactly
  one report and does not abort the run.
- Manual: call both health endpoints on a preview; confirm the portal one goes red if the
  heartbeat is aged by hand.

## Files

`api/health.mjs` · `app/src/app/api/health/route.ts` ·
`app/src/app/api/cron/tick/route.ts` · `app/src/lib/notifications/scheduler.ts` ·
`supabase/migrations/<ts>_heartbeat.sql` (only if `settings` cannot hold it) ·
`tests/health.test.mjs` · `app/tests/` · `docs/RUNBOOK.md`

## Open decisions

- **`settings` row or a `heartbeats` table?** *Recommended: `settings`* if its shape allows
  a JSON value — one row, no migration, no new RLS surface. Inspect
  `20260910000006_reviews_notifications_settings.sql` first and say which you found.
- **Staleness threshold:** *Recommended: alert at 2 h, health red at 3 h* for an hourly
  schedule. Tight enough to catch a real outage the same morning, loose enough to survive
  one skipped invocation.
- **Is `/api/health` rate limited?** *Recommended: no, but `no-store` and cheap.* If it ever
  needs protection, it is doing too much work.
