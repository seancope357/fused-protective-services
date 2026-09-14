# SPEC-010 — Candidate ATS in the portal
**Gate:** GO_LIVE.md → F3 · **Surface:** portal + database
**Size:** L · **Depends on:** SPEC-002 · **Human blocker:** candidate email waits on Gate B1 (Resend)

## Why

`/careers` is a complete recruiting front end — five positions, a pre-qualification
checker, a five-stage vetting protocol, `JobPosting` structured data for Google Jobs — and
it writes real applications to `public.candidate_applications` through `/api/intake`.

**The portal has no screen for any of it.** Searching `app/src` for
`candidate_applications` returns nothing. A candidate who applies exists only as a row and
an email. There is no way to review, stage, note or reject anyone except the Supabase table
editor.

So the recruiting funnel is live and advertised, the table already carries a
`vetting_stage` column with the exact five-stage vocabulary, and nobody can work it. This
is the largest built-but-unreachable capability in the system.

Two further gaps the same work should close: `candidate_applications` is **not** in the
audit-log trigger list (`20260910000009_audit_log.sql` names eleven tables and not this
one), so stage changes would leave no trail; and no notification rule mentions candidates,
so an applicant hears nothing after the confirmation email.

## Scope

**In**
- Candidate list and detail screens with stage transitions, notes and rejection.
- Audit-log coverage and a timeline.
- Notification rules for applying, advancing and rejection.
- One machine-readable stage vocabulary shared by the careers page and the database.

**Out**
- Officer onboarding and the roster — Phase 2, and `officers` / `shift_assignments`
  already exist as seams. A candidate reaching `active_roster` does **not** become an
  officer record here.
- Résumé or document upload.
- Interview scheduling or calendar integration.
- Any change to the careers page's public design.

## Design

**1 · One stage vocabulary — the contract.** The database CHECK already fixes it:
`application_received`, `tops_audit`, `background_mmpi2`, `range_physical`,
`command_interview`, `active_roster`, `rejected`. But `src/data/careers.mjs` describes the
same pipeline with display-only entries keyed `step: '01'…'05'`, with **no machine id**.
Two descriptions of one pipeline, already drifting.

Add an explicit `id` to each `vettingStages` entry matching the database vocabulary, and
derive every label in the portal from that file through `@/lib/shared`. This is the
`quoteValue` pattern applied to recruiting: one list, read by the careers page, the portal
and the constraint. A test must assert the two vocabularies agree, so a future stage cannot
be added to one and not the other.

**2 · Migration** (additive, forward-only):
- `assigned_to UUID REFERENCES auth.users`, `stage_changed_at TIMESTAMPTZ`,
  `rejection_reason TEXT`, `internal_notes TEXT`;
- `candidate_applications` added to the audit trigger array, and `'candidate'` added to the
  `v_entity` CASE in `audit_row_change()` — re-declare the function in the new migration
  rather than editing the applied one;
- an index on `(vetting_stage, created_at DESC)`;
- `source_env` comes from SPEC-002; do not duplicate it.

**3 · RLS.** `staff_all_candidates` already exists from
`20260910000001_profiles_and_roles.sql`. Do not widen it. Prove in `app/tests/db/` that
anon, a client and an **officer** all read nothing — the officer case matters, because
officers are authenticated users who must not see the pipeline they came through.

**4 · Screens.**
- `/portal/candidates` — list with filters (stage, licence level, position), newest first,
  the count of `application_received` as the nav badge. Match the Leads inbox layout; this
  is the same job for a different pipeline.
- `/portal/candidates/[id]` — the application as submitted (including TOPS number and
  service branch), stage control, internal notes, assign-to-staff, reject with reason, and
  the timeline from `app/src/lib/domain/timeline.ts`.

**5 · Transitions.** Forward one stage at a time, or reject from any stage. No skipping —
the five stages are a compliance narrative the site publishes, and a candidate jumping from
application straight to the roster is exactly the record we do not want. Re-opening a
rejection is allowed (back to `application_received`) and audited. `stage_changed_at`
updates on every transition. Server actions in `app/src/lib/actions/candidates.ts`, using
the existing `util.ts` wrapper.

**6 · Notifications** — new rules in `app/src/lib/notifications/templates.ts`, engine
unchanged:

| Trigger | Audience | Channel |
| :--- | :--- | :--- |
| `candidate_applied` | owner | email, SMS only if it is a Level IV application |
| `candidate_stage_advanced` | candidate | email |
| `candidate_rejected` | candidate | email |

Honest, compliant and quiet by default: every send goes through the existing consent and
opt-out checks, skips with `no_verified_sender` until Gate B1, and is deduplicated by
`notifications.dedupe_key`. **No automatic email on reaching `active_roster`** — a job
offer is Cameron's to make in person, not the notification engine's.

Rejection email wording matters more than the mechanism: brief, respectful, no reason
disclosed (the internal reason stays internal), no implication about background-check
results. Draft it in the PR for Cameron to approve rather than shipping your own words.

**7 · Retention.** Applications carry identity documents-adjacent data (TOPS numbers,
service history). State a retention period in the privacy policy and enforce it in the
existing cron tick — see decisions.

## Acceptance

1. `vettingStages` entries carry ids matching the database CHECK exactly, and a test fails
   if the two lists diverge.
2. Portal labels for every stage derive from `src/data/careers.mjs`; no stage name is
   restated in `app/`.
3. `/portal/candidates` lists, filters and badges correctly, excluding non-production rows.
4. `/portal/candidates/[id]` shows the full application, notes, assignment and timeline.
5. Transitions advance one stage, reject from any stage, and re-open — each audited with
   actor and diff.
6. `stage_changed_at` is maintained.
7. An audit row appears for every insert, update and delete on the table.
8. Anon, client and officer roles read nothing — proven in `app/tests/db/`.
9. The three notification rules fire once each, respect consent and opt-out, and skip with
   a logged reason with no verified sender.
10. Reaching `active_roster` sends the candidate nothing.
11. The migration is additive and re-runnable; `pnpm test:db` green from a fresh database.
12. Nothing about the public careers page changes; `node build.mjs --check` clean.

## Test plan

- `app/tests/candidates.test.ts`: transition rules (forward one, reject any, re-open, no
  skipping); stage-vocabulary agreement between `src/data/careers.mjs` and the CHECK.
- `app/tests/db/candidates.test.ts`: RLS for anon, client, officer, staff; audit rows for
  each operation; the CHECK rejects an unknown stage.
- `app/tests/notifications.test.ts`: the three rules, consent and opt-out paths, dedupe,
  and that `active_roster` produces nothing.
- Manual: apply through `/careers` on a preview, work the candidate to `active_roster`,
  confirm the timeline reads correctly end to end.

## Files

`supabase/migrations/<ts>_candidates_ats.sql` · `src/data/careers.mjs` (stage ids) ·
`app/src/app/portal/candidates/page.tsx` · `app/src/app/portal/candidates/[id]/page.tsx` ·
`app/src/lib/actions/candidates.ts` · `app/src/lib/domain/queries.ts` ·
`app/src/lib/notifications/templates.ts` · `app/src/lib/db/types.ts` ·
`app/src/app/portal/layout.tsx` (nav + badge) · `app/src/lib/shared.ts` ·
`app/tests/**` · `src/data/legal.mjs` (retention) · `docs/GO_LIVE.md` (F3)

## Open decisions

- **Build it, or decide recruiting runs out of email?** F3 is written as a decision for
  Cameron. *Recommended: build it* — the careers page is already advertised and indexed for
  Google Jobs, so applications are arriving whether or not anyone can work them, and the
  table editor is not a place to keep candidate records. Confirm before starting the L-sized
  build.
- **Retention period:** *Recommended: 24 months for unsuccessful applicants*, then delete,
  stated in the privacy policy. Texas DPS record-keeping may impose its own floor for hired
  officers — flag it for the same counsel review as Gate A3 rather than choosing alone.
- **Does `active_roster` create an `officers` row?** *Recommended: no, not in this spec.*
  That is the Phase 2 seam and it needs pay rates and assignment rules that do not exist
  yet. Leave the handoff manual and obvious.
- **Rejection email at all?** *Recommended: yes, and short.* Silence from a security
  employer reads badly and candidates talk. Cameron approves the wording.
