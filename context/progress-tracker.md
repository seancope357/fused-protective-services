# Progress Tracker

Updated: 2026-10-14. This file tracks the current implementation unit; [PROGRESS.md](../PROGRESS.md) retains the broader operational history and backlog.

## Current Phase

**2026-10-07 — two tracks, deliberately separate.**

*Launch* (GO_LIVE): blocked on attorney review and DNS → Resend. Not engineering.
SPEC-008 landed via PR #11 (a11y gate armed, gate E4 closed). SPEC-004 sits in draft
PR #12 with CI green and is the last launch spec that matters.

*Operations* (new): [`docs/OPERATIONS-PLAN.md`](../docs/OPERATIONS-PLAN.md) — can Cameron
run a guard company on the portal once it is live? Today he cannot add a guard to it.
SPEC-014 (roster/assignment/coverage) and SPEC-015 (licence expiry) are written and Ready.

*Parked:* SPEC-013, free owner alerts over Telegram. Branch
`feat/telegram-owner-alerts` holds a WIP commit that does not typecheck, by design —
`main` is clean. See the spec's *Where it stopped*.

## Current Goal

**2026-10-19 aerial is public:** live page at `/aerial` (generated `aerial.html`),
linked from the nav island and drawer, in `sitemap.xml`, canonical and crawlable.
Evidence in [`docs/AERIAL-PREVIEW.md`](../docs/AERIAL-PREVIEW.md). The rotor rig
was wired (it had been dead code throwing `batchStatic is not defined`, so every
load fell back to the error poster). `vercel.json` is byte-identical — no CSP
change. Aircraft rights remain unresolved and Sean accepted that risk on
2026-10-19; see `assets/aerial/PROVENANCE.md`. Previous portal context remains below.

Previous operations priorities (before this aerial session): Sean's call between
reviewing/merging PR #12 (SPEC-004, launch), resuming SPEC-013 (removes 10DLC from the
critical path), or starting SPEC-014 (the operations core). Before any of them,
GO_LIVE **F1** — Cameron pushing one fake client through quote → proposal → job →
invoice → paid — is the highest-value item, and it is not an engineering task.

## Completed

- Mobile-first `app.css` (600px / 1024px), a new frame (top bar, bottom tab bar, More sheet; sidebar from 1024px), `DataTable` (cards on a phone, a table above), a pinned primary action per screen, 44px targets, 16px inputs, status tokens. Every portal, client, pay, review and officer screen converted.
- Ready for Cameron: getting-started checklist on Today, plain-English Settings with a collapsed Technical detail, forced own-password on first sign-in (enforced in the proxy; the portal shows no navigation until it is set), first-time two-factor explanation.
- Verified by a seeded local stack and `pnpm screens` against the production build. Before → after: screens scrolling sideways 27/36 → 0/37 at 320px, 26/36 → 0/37 at 375px, 9/36 → 0/37 at 768px, 5/36 → 0/37 at 1280px; sub-44px tap targets at 375px 734 → 3 (all the pay link printed inside the invoice paper). The only remaining axe rule is `color-contrast` (the pending `--text-tertiary` decision).
- Independent review: one major finding (the password change could be skipped by client-side navigation) and six minors, all fixed test-first.
- Pre-existing bugs fixed on the way: recurring shifts generated in UTC (wrong weekday; last evening dropped; INTERVAL by 7-day blocks; the autumn repeated hour), activity links 404ing for child records, saving a site erasing address line 2, checkout ignoring its return path, Today counting jobs from their first shift, calendar Previous/Next skipping months, calendar grid ARIA, the local banner reading "project 127".
- `pnpm typecheck`, `pnpm test` (194 passed) and `pnpm build` pass.
- Follow-up (branch `fix/site-client-contrast`): quote and job sites must belong to the chosen client — the pickers follow the client and every save checks the pair; `--text-tertiary` is `#8f8a86` (approved by Sean).

## In Progress

- Aerial: shipped as a public page. Remaining before it is genuinely finished —
  Sean's aesthetic sign-off on real hardware (rotor blur opacity especially),
  real-device GPU/FPS measurement, a mobile low-detail tier for the ~7.9MB /
  127k-triangle payload, and a rights-cleared replacement aircraft.

## Next Up

- Sean: confirm Part 107 / Texas coverage so the aerial copy can either stay
  capability-worded or be upgraded to a live service claim. Asked 2026-10-19,
  unanswered; copy deliberately makes no operational claim until then.
- Sean: view `/aerial` on a phone and direct the next visual pass.

Cameron's first sign-in on the real portal proves criterion 8: create his owner account from Settings, and he enrols an authenticator and sets his own password. Before that, confirm the hosted `secure_password_change` setting, and have Cameron confirm `01766480` is the company licence and give the DPS-record address.

## Open Questions

- Confirm the hosted Supabase `secure_password_change` setting before Cameron's account is created.

## Architecture Decisions

- A rule that must hold on every request (first-sign-in) lives in the proxy, not a layout: Next does not re-render shared layouts on client-side navigation.
- Layout work is verified by the capture suite, not by eye: `app/scripts/README-demo.md`.
- A Git deploy never migrates the hosted database (`docs/RUNBOOK.md` §1). SPEC-012 adds no migration.

## Session Notes

- Local stack: `supabase start -x vector` (546xx ports), `pnpm demo:seed`, then `pnpm dev --port 3100` or `pnpm build && PORT=3100 pnpm start`, then `pnpm screens`. Re-seed to clear the login gate between runs.

## Aerial implementation handoff — 2026-10-14

- Built deterministic opt-in page/CSS; production build drift check passes unchanged.
- Tests first: initial missing-module RED, then shader and lifecycle regressions fixed; current full static/API/geometry suite 134 passed.
- Aircraft normalized to a 1.8-unit span in the same physical scene, with close-up hero cameras and aircraft-centred inspection. No identified rotor rig; only subtle whole-aircraft hover is animated.
- QA exists only with `?verify=1`: `window.__aerial.ready` boolean; synchronous `setProgress(u)`, immediate `setSensor(boolean)`, `render()`, `stats()` (calls, triangles, camera position/target/direction, modelLoaded, original bounds/scale), and `context` WebGL context. PreserveDrawingBuffer only in this mode.
- Controller browser run passed 35 checks with zero normal-load shader/page/CSP errors and a measured maximum of 13 main-pass draw calls. This is functional evidence, not photorealism or native-device FPS acceptance; see docs/AERIAL-PREVIEW.md.
- Existing unrelated files, controller-owned assets/vendor directory, production homepage/API/security policy remain untouched. Asset rights stay local-evaluation-only.
