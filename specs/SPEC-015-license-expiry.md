# SPEC-015 — DPS licence expiry: alerts and assignment guard
**Gate:** — (post-launch operations; [`docs/OPERATIONS-PLAN.md`](../docs/OPERATIONS-PLAN.md) item 2) · **Surface:** portal
**Size:** S · **Depends on:** 014 · **Human blocker:** Cameron confirms the warning windows and whether expiry hard-blocks

## Why

`officers.dps_license_expires_on` has existed since
`20260910000004_jobs_and_shifts.sql`. Grepping `app/src/` for it on 2026-10-07 returns
**zero references.** The column is stored and never read.

Texas private security officers work under a DPS licence or commission with an expiry date.
An officer working a detail on a lapsed credential is a regulatory exposure for the
company that posted them, and the kind of thing an insurer asks about after an incident.
Nothing in the system currently knows or cares.

The notification engine already has everything needed to do this well: a table-driven rule
matrix (`src/lib/notifications/templates.ts`), an hourly tick with isolated per-rule error
handling (`scheduler.ts`), and `alreadySent()` dedupe keyed on
`(trigger, entity, suffix)`. This is one rule, one query and one card.

## Scope

**In**
- A `officer_license_expiring` trigger in the rule matrix, owner audience, **email**
  channel.
- A scheduler rule, isolated like every other, warning at **30 / 14 / 7 days** before
  expiry and once **on/after** expiry, deduped per officer per window via
  `dedupeSuffix` (the `invoice_overdue` `day{n}` pattern is the precedent).
- An **Expiring credentials** card on Today for anything inside 30 days or already
  expired, and an expiry state on the officer row in `/portal/officers`.
- The assignment guard decided in SPEC-014 open decision 2: assigning an officer whose
  licence expires before the shift **ends**.

**Out — binding**
- Any channel other than email. Owner SMS/push is SPEC-013, which is **parked** — this
  spec must not depend on it and must not wait for it.
- Storing licence scans or documents.
- Candidate-side licence checks (`candidate_applications.license_level` exists; the ATS is
  SPEC-010's territory).
- Auto-deactivating an expired officer. Expiry is a fact to surface; deactivation is
  Cameron's decision.
- Any new table.

## Design

- **Email, deliberately.** Owner push over Telegram is parked (SPEC-013), and a compliance
  warning must not be blocked on a parked spec. Email is already wired; until Resend is
  verified (GO_LIVE **B1**) the rule renders, logs, and skips with `no_verified_sender` —
  honest, visible in `/portal/notifications`, and it starts working the moment B1 lands
  with no code change. Do not special-case this.
- **The dashboard card is the real feature.** An email can be missed; a card Cameron passes
  every morning cannot. The alert is the backstop, not the mechanism.
- **Windows, not a countdown.** Warning at discrete 30/14/7/expired windows with a
  `dedupeSuffix` per window means the hourly tick cannot produce a daily nag — the same
  property that keeps `invoice_overdue` to three messages.
- **Date-only comparison.** `dps_license_expires_on` is a `DATE`. Compare in the business
  timezone using the existing `localYmd` / `todayYmd` helpers; do not subtract
  milliseconds off a `Date`, or the window boundary moves with the deploy region.
- Derivation goes in `src/lib/domain/` as a pure function so the windows are unit-tested
  without a database or a clock.

## Acceptance

1. An officer whose licence expires in 30, 14 or 7 days produces exactly **one**
   `officer_license_expiring` notification per window, per officer.
2. An officer already expired produces exactly one alert, and keeps showing on the card
   until the date is updated or they are deactivated.
3. Re-running the tick in the same window produces **no** additional row — asserted, not
   assumed, because this is precisely the class of bug fixed in `f814565`.
4. With no verified sender the row is `status='skipped'`, `error='no_verified_sender'`, and
   the alert still appears on the dashboard card.
5. Today shows **Expiring credentials** for ≤30 days or expired, and nothing at all when
   every active officer is clear.
6. `/portal/officers` shows each officer's expiry with a visibly distinct state for
   expiring-soon and expired.
7. Assigning an officer whose licence expires before the shift's `ends_at` behaves as
   Cameron decided in *Open decisions* 1 — and whichever it is, the reason is stated in
   operator wording.
8. A deactivated officer raises no alerts and occupies no card space.
9. A rule failure does not abort the rest of the tick (the `rule()` wrapper already
   guarantees this; assert it for this rule).

## Test plan

- `app/tests/` — the pure window derivation: 31/30/15/14/8/7 days, day-of-expiry, expired,
  null expiry, deactivated officer. Boundaries are the whole point; test both sides of each.
- `app/tests/` — dedupe: two ticks inside one window yield one dispatch (the engine's
  injected deps make this a no-database test).
- `app/tests/` — `no_verified_sender` path produces a logged skip, never a claimed send.
- `app/tests/db/` — only if the assignment guard lands as a database constraint rather than
  an action-level check.
- `pnpm screens` — the Today card and the officers list at the four widths, no new axe
  violations.

## Files

- `app/src/lib/domain/licensing.ts` — new (pure windows)
- `app/src/lib/notifications/templates.ts` — the `officer_license_expiring` rule
- `app/src/lib/notifications/scheduler.ts` — one isolated rule, following `invoice_overdue`
- `app/src/app/portal/page.tsx` — the card
- `app/src/app/portal/officers/page.tsx` — expiry state (SPEC-014 creates this file)
- `app/src/lib/actions/officers.ts` — the assignment guard
- `app/tests/notifications.test.ts`, plus a new domain test
- `docs/OPERATIONS-PLAN.md` — tick item 2 · `docs/RUNBOOK.md` if a window becomes configurable

## Open decisions

1. **Warn or hard-block an assignment past expiry?** Recommendation: **block, with an
   override that is audited.** A soft warning is the option that ends with an officer on
   post holding a lapsed commission, and the audit trail is what makes the override
   defensible later. Needs Cameron's agreement — it is his liability, and it changes how
   the screen behaves under time pressure.
2. **Are 30/14/7 the right windows?** Recommendation: yes to start; DPS renewal paperwork
   is not a same-week job. Make the set a single exported constant so it is one edit.
3. **Should the daily digest carry expiring credentials too?** Recommendation: yes, one
   line, once the digest is actually being delivered (B1). Cheap, and it is the summary
   Cameron reads at 7am.
4. **Commission vs non-commissioned levels.** `dps_license_level` already distinguishes
   them. If armed shifts require a commissioned officer, that is a *different* guard and
   belongs in its own spec — note it in the PR, do not widen this one.
