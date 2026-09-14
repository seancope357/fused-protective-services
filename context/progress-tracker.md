# Progress Tracker

Updated: 2026-09-14. This file tracks the current implementation unit; [PROGRESS.md](../PROGRESS.md) retains the broader operational history and backlog.

## Current Phase

Marketing site refinement, followed by a context and documentation audit after PR #10 merged.

## Current Goal

Address officer applications to Fused rather than to Cameron by name, simplify the careers application header, and bring `context/`, the root trackers and `docs/` back in line with the code.

## Completed

- Careers application lead now reads “Submit your operational profile directly to Fused Protective Services.” (`src/templates/careers/apply.mjs`, regenerated `careers.html`).
- Removed the “COMMAND INTAKE” badge and the word “TRANSMIT”; the heading is now “OFFICER APPLICATION”.
- Published as `6c0ffee` to `origin/main`; the production deployment reached Ready and the live `/careers` page shows the new header and copy.
- PR #10 (go-live gates, specs, SPEC-001/002/003/006/007/008/010/011) merged on top as `5047140`. The careers copy survived the merge and `node build.mjs --check` passes.
- Audited every context and tracking document against the code and corrected stale claims: eight context documents, seven divisions, the full generated-file list (including `vercel.json` and `css/noscript.css`), vendored three.js and fonts, Git-driven deploys for both projects, the removed `/api/stripe-checkout`, portal-based invoicing, migration count and hosted status, and spec status.
- Earlier today: hero badge removal (`1387db3`), the “SCROLL ↓” cue (`83003e0`), and the client-facing How It Works rewrite (`696e114`).

## In Progress

None.

## Next Up

1. **Apply the three unapplied migrations to the hosted Supabase project** — `20260914000000_source_env`, `20260914120000_candidates_ats`, `20260914140000_alert_gate` — then submit a test lead and confirm `delivery.persisted: true`. Deployed intake code writes `source_env`, which the hosted database does not have yet. Needs Sean's go-ahead.
2. Decide whether Cameron stays named in the careers executive-interview stage and the page keywords.

## Open Questions

- Should Cameron Harrell remain named in the vetting interview stage heading, its sign-off line, and the careers `keywords` meta tag?

## Architecture Decisions

- Careers application copy addresses the company, not a named person. Recorded in `context/ui-standards.md` and `context/business.md`.
- The audit changed documentation only; no source or generated output changed.

## Session Notes

- Edit source files and regenerate with `node build.mjs`; never hand-edit generated files.
- Hosted migration history was read through the Supabase connector on 2026-09-14: the last applied version is `20260910000009_audit_log`.
