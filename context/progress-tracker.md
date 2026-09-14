# Progress Tracker

Updated: 2026-09-14. This file tracks the current implementation unit; [PROGRESS.md](../PROGRESS.md) retains the broader operational history and backlog.

## Current Phase

Marketing site refinement, a context and documentation audit after PR #10, and repair of the hosted database that PR #10's deploy outran.

## Current Goal

Address officer applications to Fused rather than to Cameron by name, bring `context/`, the trackers and `docs/` in line with the code, and bring the hosted Supabase project up to the deployed code.

## Completed

- Careers application header: “COMMAND INTAKE” badge and “TRANSMIT” removed; heading “OFFICER APPLICATION”; lead says applications go directly to Fused Protective Services (`6c0ffee`, live).
- Careers page no longer names Cameron anywhere: the vetting interview stage (“Executive Interview with Fused Leadership”), its sign-off line, the careers `keywords`, and the post-submit confirmation (“Application Received … sent to Fused Protective Services”) (`66a0884`). `node build.mjs --check` and all 114 static-site tests pass.
- PR #10 merged on top as `5047140`; the careers copy survived.
- Audited every context and tracking document against the code and corrected stale claims (`1397db4`).
- Found the hosted project three migrations behind deployed code, then applied `20260914000000_source_env`, `20260914120000_candidates_ats` and `20260914140000_alert_gate` through the Supabase connector in filename order and aligned their recorded versions to the filenames. Hosted history is now 15 of 15; the new columns, `alert_gate()` and `set_candidate_stage_changed_at()` exist.
- Verified: a labelled production test lead (`TX-FPS-Z8NHSG`) returned `delivery.persisted: true` with `source_env = production` and was then deleted; the portal `/api/cron/tick` returns `200 ok`. The only other quote on file predates the PR #10 deploy, so no real submission hit the gap.
- Closed the threat-assessment safety gap: “Elevated / Immediate Known Threat” carried no routing, so the environment decided (a construction site under threat was recommended routine patrol at standard priority). It now recommends `rapid` (Emergency Tactical Dispatch, armed officers, “call 911 first”) and routes the quote form to `Emergency Tactical Dispatch`, which the intake and database triage as `emergency`. Threat answers carry `recommend` / `division` / `armed` instead of `escalate`; `resolve()`, the `#fps-config` island and `js/modules/assessment.mjs` share the rule. `tests/assessment.test.mjs` adds four tests; 118 pass and the drift check is clean.
- Earlier today: hero badge removal (`1387db3`), the “SCROLL ↓” cue (`83003e0`), and the client-facing How It Works rewrite (`696e114`).

## In Progress

None.

## Next Up

Publish the assessment fix to `main` and confirm the production island routes the immediate-threat answer to Emergency Tactical Dispatch. (The docs audit, careers copy and migration record are already live.)

## Open Questions

- The homepage `seo.keywords` in `src/data/site.mjs` still includes “Cameron Harrell security”. Keep or replace?

## Architecture Decisions

- Visitor-facing careers copy addresses the company, never a named person. Recorded in `context/ui-standards.md` and `context/business.md`.
- A Git deploy never migrates the hosted database; migrations are applied by hand before or with the code that needs them (`docs/RUNBOOK.md` §1).

## Session Notes

- Edit source files and regenerate with `node build.mjs`; never hand-edit generated files.
- Migrations applied through the connector are recorded with a timestamp version; update `supabase_migrations.schema_migrations.version` to the filename so the history stays aligned.
