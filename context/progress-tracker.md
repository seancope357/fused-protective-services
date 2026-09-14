# Progress Tracker

Updated: 2026-09-14. This file tracks the current implementation unit; [PROGRESS.md](../PROGRESS.md) retains the broader operational history and backlog.

## Current Phase

SPEC-012 — the portal made mobile-first and ready for Cameron's first session. Merged to `main` and deployed 2026-09-14, together with the real DPS licence number (`01766480`).

## Current Goal

Every admin and client screen usable on a phone, a tablet and a desktop, and a first session Cameron can get through without Sean: his own password, two-factor explained, a getting-started checklist, Settings in plain English.

## Completed

- Mobile-first `app.css` (600px / 1024px), a new frame (top bar, bottom tab bar, More sheet; sidebar from 1024px), `DataTable` (cards on a phone, a table above), a pinned primary action per screen, 44px targets, 16px inputs, status tokens. Every portal, client, pay, review and officer screen converted.
- Ready for Cameron: getting-started checklist on Today, plain-English Settings with a collapsed Technical detail, forced own-password on first sign-in (enforced in the proxy; the portal shows no navigation until it is set), first-time two-factor explanation.
- Verified by a seeded local stack and `pnpm screens` against the production build. Before → after: screens scrolling sideways 27/36 → 0/37 at 320px, 26/36 → 0/37 at 375px, 9/36 → 0/37 at 768px, 5/36 → 0/37 at 1280px; sub-44px tap targets at 375px 734 → 3 (all the pay link printed inside the invoice paper). The only remaining axe rule is `color-contrast` (the pending `--text-tertiary` decision).
- Independent review: one major finding (the password change could be skipped by client-side navigation) and six minors, all fixed test-first.
- Pre-existing bugs fixed on the way: recurring shifts generated in UTC (wrong weekday; last evening dropped; INTERVAL by 7-day blocks; the autumn repeated hour), activity links 404ing for child records, saving a site erasing address line 2, checkout ignoring its return path, Today counting jobs from their first shift, calendar Previous/Next skipping months, calendar grid ARIA, the local banner reading "project 127".
- `pnpm typecheck`, `pnpm test` (194 passed) and `pnpm build` pass.
- Follow-up (branch `fix/site-client-contrast`): quote and job sites must belong to the chosen client — the pickers follow the client and every save checks the pair; `--text-tertiary` is `#8f8a86` (approved by Sean).

## In Progress

None.

## Next Up

Cameron's first sign-in on the real portal proves criterion 8: create his owner account from Settings, and he enrols an authenticator and sets his own password. Before that, confirm the hosted `secure_password_change` setting, and have Cameron confirm `01766480` is the company licence and give the DPS-record address.

## Open Questions

- Confirm the hosted Supabase `secure_password_change` setting before Cameron's account is created.

## Architecture Decisions

- A rule that must hold on every request (first-sign-in) lives in the proxy, not a layout: Next does not re-render shared layouts on client-side navigation.
- Layout work is verified by the capture suite, not by eye: `app/scripts/README-demo.md`.
- A Git deploy never migrates the hosted database (`docs/RUNBOOK.md` §1). SPEC-012 adds no migration.

## Session Notes

- Local stack: `supabase start -x vector` (546xx ports), `pnpm demo:seed`, then `pnpm dev --port 3100` or `pnpm build && PORT=3100 pnpm start`, then `pnpm screens`. Re-seed to clear the login gate between runs.
