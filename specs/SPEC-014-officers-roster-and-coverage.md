# SPEC-014 — Officers roster, shift assignment, and coverage
**Gate:** — (post-launch operations; see [`docs/OPERATIONS-PLAN.md`](../docs/OPERATIONS-PLAN.md) item 1) · **Surface:** portal
**Size:** L · **Depends on:** — · **Human blocker:** officer pay rates and DPS details from Cameron

## Why

This is a security-staffing portal in which **you cannot add a guard**.

Checked 2026-10-07 against `app/src/`:

- There is no `src/lib/actions/officers.ts`. Every other entity has one
  (`candidates`, `clients`, `invoices`, `jobs`, `pay`, `quotes`, `reviews`, `settings`).
  The `officers` table has **no write path at all**.
- `shift_assignments` appears exactly **once** in the entire application —
  `src/lib/notifications/scheduler.ts:73`, counting assignments for the
  `job_unstaffed_24h` alert. **No screen displays an assignment.**
- `shifts.officers_required` is read for the billing estimate
  (`portal/jobs/[id]/page.tsx:38`) and the job form, but is never compared against
  assignments, so "short-staffed" is not a state the UI can represent.
- Production row counts: `officers` 0, `shift_assignments` 0, `shifts` 0.

The consequence: the one failure that permanently loses a security client — an uncovered
post — is invisible in the console. The only existing guard is `job_unstaffed_24h`, a
notification 24 hours out, which (a) depends on email/SMS that is not yet configured, and
(b) fires once rather than being a state Cameron can scan.

The schema is already right. `officers`, `shift_assignments` (with clock-in columns),
`shifts.officers_required` and `shifts.pay_rate_cents` all exist. This spec is almost
entirely UI and server actions over tables that are already modelled and already have RLS.

## Scope

**In**
- `/portal/officers` — list, create, edit, deactivate. Name, email, phone,
  `dps_license_level`, `dps_license_number`, `dps_license_expires_on`, `active`.
- `src/lib/actions/officers.ts` — create / update / deactivate, audited like every other
  action, with plain-operator error wording.
- Assigning officers to a shift from the job detail screen, and unassigning.
- Coverage as a first-class, scannable state:
  - `assigned / required` per shift on `/portal/jobs/[id]`.
  - A short-staffed indicator per job on `/portal/jobs` and on the job cards.
  - A **"Short-staffed"** card on Today (`/portal/page.tsx`) for jobs inside the next
    7 days whose shifts are not fully assigned — beside the existing lead/job/invoice cards.
- Deactivating an officer must not rewrite history: existing assignments stand.

**Out — binding**
- Clock-in / clock-out and anything geo (OPERATIONS-PLAN item 3). The columns stay unused
  by this spec.
- Licence **expiry alerting** and assignment-time licence blocking — that is SPEC-015. This
  spec stores and displays the expiry date; it raises no alert and blocks no assignment.
- Officer-facing screens. `/officer` stays the honest stub it is today.
- Timesheets, payroll export, invoicing from worked hours.
- Margin display (OPERATIONS-PLAN item 4).
- Conflict detection beyond the single rule in Acceptance 6 — no travel time, no
  availability calendar, no fatigue rules.

## Design

Follow the shapes the portal already uses; this spec should look like it was always here.

- **Screens** mirror `/portal/clients`: a `DataTable` with a `primary` column, cards on a
  phone and a table from 600px, one pinned primary action (`Add officer`), 44px targets and
  16px inputs (SPEC-012's rules — see `app/scripts/README-demo.md`).
- **Assignment lives on the job**, not on the officer. Cameron's question is "who is
  covering this detail", not "what is this officer doing this month". A per-officer view can
  come later if asked for.
- **Coverage is computed, never stored.** One query per job:
  `shifts` for the job joined to a count of `shift_assignments` per shift. Storing a
  denormalised `assigned_count` would drift the moment an assignment is deleted.
- **Today's query budget.** `/portal/page.tsx` already runs five parallel queries and is
  `force-dynamic`. Add **one** more — shifts in the next 7 days with their assignment
  counts — and derive the short-staffed list in `src/lib/domain/`, where
  `nextJobsFromShifts` already lives and is unit-tested without a database.
- **No migration is expected.** If one proves necessary (e.g. an index on
  `shift_assignments.shift_id`), it is additive and forward-only per invariant 9.

## Acceptance

1. An officer can be created, edited and deactivated from `/portal/officers`; every change
   lands in `audit_log` with actor and diff, like clients and candidates.
2. A deactivated officer no longer appears in the assignment picker but their existing
   assignments remain visible and intact.
3. `/portal/jobs/[id]` shows `assigned / required` per shift, and marks a shift
   short-staffed when `count(shift_assignments) < officers_required`.
4. An officer can be assigned to, and removed from, a shift; the action is audited and the
   coverage figure updates on the next render.
5. Today shows a **Short-staffed** card listing jobs in the next 7 days that are not fully
   assigned, and shows nothing when every upcoming shift is covered — the empty state
   reads like the existing `Empty` components, not a zero.
6. The same officer cannot be assigned twice to one shift, nor to two shifts whose times
   overlap; the attempt fails with operator wording, not a database error string.
7. Coverage counts production rows only, consistent with SPEC-002 and with how Today
   already filters leads.
8. `/officer` is unchanged.

## Test plan

- `app/tests/` (vitest, no database): the coverage derivation in `src/lib/domain/` —
  fully covered, short by one, zero assigned, a cancelled shift excluded, and the overlap
  rule in Acceptance 6. These are pure functions; test them as such.
- `app/tests/db/`: RLS on `officers` and `shift_assignments` — a client session can read
  neither; a staff session without MFA is refused, consistent with
  `20260910000008_require_mfa_for_staff.sql`.
- `pnpm screens` (the seeded capture suite) at 320 / 375 / 768 / 1280 for
  `/portal/officers` and the job detail screen: no sideways scroll, no sub-44px targets,
  no new axe violations. SPEC-008's gate is armed and blocking, so a `color-contrast`
  regression now fails CI.
- Seed `pnpm demo:seed` with at least one short-staffed job so the Today card has
  something to render in the capture.

## Files

- `app/src/app/portal/officers/page.tsx`, `officers/new/page.tsx`, `officers/[id]/page.tsx` — new
- `app/src/lib/actions/officers.ts` — new
- `app/src/lib/domain/coverage.ts` — new (pure; the derivation and the overlap rule)
- `app/src/app/portal/page.tsx` — one added query, one added card
- `app/src/app/portal/jobs/page.tsx`, `jobs/[id]/page.tsx` — coverage column and per-shift state
- `app/src/components/` — an officer picker, following `job-form.tsx`
- `app/src/lib/db/types.ts` — any missing row types
- `app/scripts/seed-demo.mjs` — officers and a deliberately short-staffed job
- `docs/OPERATIONS-PLAN.md` — tick item 1 · `PROGRESS.md` — milestone

## Open decisions

1. **Does `officers_required` mean distinct officers, or headcount including repeats?**
   Recommendation: distinct officers per shift. It is the only reading under which
   Acceptance 6's overlap rule makes sense.
2. **Should assigning an officer whose DPS licence expires before the shift ends be
   blocked, or warned?** Recommendation: **warn** in this spec and leave blocking to
   SPEC-015, so the compliance decision ships with the alerting that explains it. Blocking
   silently here would strand Cameron with no way to see why.
3. **Does an officer need a login?** `profiles` already carries an `officer` role and
   `/officer` exists. Recommendation: **no account in this spec** — SPEC-010 set the
   precedent that reaching `active_roster` deliberately creates no `officers` row, and
   accounts should arrive with the officer-facing screens in item 3, not before.
4. **Pay rate placement.** `pay_rate_cents` is on `shifts`, not on `officers`, so the same
   officer can cost different amounts on different details. Recommendation: keep it on the
   shift (it is already there), and treat a default rate per officer as a later
   convenience, not part of this spec.
