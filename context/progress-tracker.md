# Progress Tracker

Updated: 2026-10-20. This file tracks the current implementation unit; [PROGRESS.md](../PROGRESS.md) retains the broader operational history and backlog.

## Current Phase

**2026-10-20 — Public design and aerial protection release handoff.**
Sean authorized committing and pushing the reviewed changes to GitHub `main` on 2026-10-20.
Source/generated output, release readiness and 146 static/API/geometry tests pass. Exact publication,
CI and auto-deployment evidence belongs to the GitHub commit checks and Vercel deployment records.
The separate launch and operations tracks retain their previous state below.

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

Turn the aerial page into a focused pilot-operated drone protection inquiry funnel, based on
official competitor copy research and Sean's confirmed service capability. Preserve the scene,
Day/Night and refined visual system. The CTA → form → mocked delivery path is verified locally;
Sean has now authorized GitHub `main` publication of the complete reviewed public-site update.

### Previous aerial / operations handoff

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

- Publication preflight (2026-10-20): `node build.mjs --verify-release` and all 146 site/API/geometry
  tests pass. Portal `pnpm typecheck`, `pnpm test` (204 pass; 189 database/browser tests skipped
  without their test services) and `pnpm build` pass. Staged scope covers the approved design,
  aerial refinements/funnel, tests and documentation; GitHub CI supplies the independent DB/a11y
  gates. Existing local perimeter prototype commit is included in the requested `main` push.

- Aerial sales funnel (2026-10-20): researched four official competitor pages and wrote original
  copy around Sean's confirmed pilot-operated patrols. All four chapters and the header share
  “Request drone protection”; the existing form receives closed aerial intent, adapted copy and
  a required explicit division choice. Drone context survives edited notes and reaches the
  existing intake payload. Confirmation distinguishes an inquiry from a booked flight.
- Fixed a conversion-path defect: network/invalid-response failures no longer report quote success
  merely because a local backup exists. Visitor values remain for retry. Build/drift and all 146
  tests pass; 80 aerial funnel browser checks pass, including two clean Day/Night AA scans.
  The existing public keyboard/conversion smoke suite also passes all 56 checks. No real intake
  was sent. Continue anchors clear the fixed header, and form reset retains the consultation preference.
- Research and claim boundaries are recorded in `docs/fused-aerial-competitive-brief-2026-10-20.html`,
  `context/business.md`, `context/data-model.md`, `context/ui-standards.md` and architecture/workflows.
  Desktop/mobile screenshots were visually reviewed. This implementation evidence predates the
  later authorized GitHub publication; current release state is recorded by exact commit checks.
- Full scene regression: all 53 checks pass after correcting an event-order race in the test's
  native scroll round-trip check. The assertion now awaits the actual scroll event before checking
  camera convergence, retaining the same distance thresholds. A focused reproduction also returns
  to the exact initial position. No runtime camera change was needed. Current scene report is
  `output/playwright/aerial-funnel-scene/verification.json`; draw calls/triangles/assets are unchanged.

- Intro typography follow-up: both `.forge-line` statements now use self-hosted Cinzel 600,
  matching the Fused wordmark, at 30–64px with balanced wrapping and light positive tracking.
  Visually inspected at 375/1440px; computed font loading, sizing and no overflow verified at
  320/375/768/1440px. Build/drift and all 142 tests pass. The explicit exception to Outfit headings
  is recorded in `context/ui-standards.md`. No animation or interaction logic changed.

- Aerial follow-up, 2026-10-20: resolved overlapping pavilion/wing facades and near-coplanar terrace
  line geometry. Added true glazed openings/interiors, layered roof/coping, limestone/timber/paver
  finishes, rolling ground, 55 fuller trees, planted borders, rocks and grass. Filtered shader joints,
  mipmapped alpha-to-coverage leaf edges and higher phone DPR reduce shimmer/pixelation. Day/Night
  replaces Sensor/Pause/Inspect, including the obsolete overlay/orbit code. Loading/error themes
  retain the choice without rendering incomplete scenes; Retry applies it to the recovered scene.
- Earlier environment validation: build/drift pass; 142 static/API/geometry tests pass; all 53 browser
  checks pass; four Day/Night × motion-mode WCAG AA scans have zero violations. Keyboard/touch,
  native forward/reverse scroll, 320–1440px controls, phone DPR 1.75/shadows 2048, reduced-motion
  stationary pixels, load/context failure and Retry, optional HDR failure, shader console and asset
  completeness are verified. Main pass max: 25 draw calls / 248,219 triangles; deferred asset bytes
  remain 7,867,553. Real-device GPU/FPS remains unmeasured. Latest visual captures and report are in
  `output/playwright/aerial-refinement/`; no commit/push/deploy was performed.

- 2026-10-20: all seven public pages share aerial-derived Outfit headings, tight tracking, restrained
  flat gold, outlined controls and quieter panels. Main/careers headings use sentence case; Cinzel
  stays on wordmarks. Reading sections have opaque backing, preserving the emblem intro while
  keeping it out of subsequent copy. Input text is 16px and reduced-motion entrance delays are zero.
- Verified: build and drift check; 142 static/API/geometry tests; 350 browser checks spanning 320,
  375, 768, 1024 and 1440px in both motion modes; 14 WCAG AA scans with zero violations. Browser
  flows cover menu focus/escape, all seven division prefills, protocol keyboard navigation,
  assessment note preservation, all estimator tiers and sliders, quote failure/retry, recruiting
  filters/requirements/eligibility/application, invoice empty/saved states and no-JavaScript headings.
  Both intake deliveries were intercepted fixtures; no real leads were sent.
- Earlier public design-unification snapshot: aerial navigation/integration passes, including the real model and four rotors. All 35 aerial
  computed-style reference measurements match the deployed page. Public HTML IDs, links, field names,
  ARIA and data bindings match the pre-change snapshot. Screenshot review covers home, services,
  estimator, quote, careers, legal and export pages; captures remain local in `output/playwright/`.
- `context/ui-standards.md` records the approved system, `context/architecture.md` reflects the
  marketing style, and `docs/A11Y-AUDIT.md` records the latest checks and their limits. The old
  two-register prototype is explicitly historical.

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

- Sean authorized GitHub `main` publication on 2026-10-20; verify exact remote SHA, CI and the
  automatic Vercel deployment. Real phone/GPU checks and existing aerial rights/coverage questions
  remain separate follow-ups.

- Pilot-operated patrols confirmed 2026-10-20. Certification details, specific flight territories
  and night/thermal availability still need operational confirmation before advertising them.
- Sean: view `/aerial` on a phone and direct the next visual pass.

Cameron's first sign-in on the real portal proves criterion 8: create his owner account from Settings, and he enrols an authenticator and sets his own password. Before that, confirm the hosted `secure_password_change` setting, and have Cameron confirm `01766480` is the company licence and give the DPS-record address.

## Open Questions

- Aerial: specific pilot credentials, flight territories and night/thermal availability remain
  unconfirmed. These do not block the scoped inquiry funnel and must not become marketing claims.

- Confirm the hosted Supabase `secure_password_change` setting before Cameron's account is created.

## Architecture Decisions

- 2026-10-20 aerial conversion: use the existing quote endpoint and seven division contracts.
  A closed `service=aerial` value adapts form copy; source-controlled notes annotation preserves
  aerial intent without a new schema or speculative service division. No flight reservation is
  created. Explicit backend success is required to show successful quote delivery.

- 2026-10-20 aerial: Day is the default; explicit Day/Night selection survives scroll and Retry.
  Sensor overlay and inspection controls/interaction are removed at Sean's request. Native scroll
  still drives the camera. Lighting changes sky, fog, directional/ambient lights and real property
  fixtures. Static shadow maps update on mode changes, not every rotor frame. Phone DPR cap rises
  from 1 to 1.75; shadow maps are 2048 on phones/coarse pointers and 4096 on desktop. Materials,
  geometry and planting remain original procedural code with no new runtime dependencies/assets.

- 2026-10-20: Sean's request supersedes the earlier two-register public design. Outfit 400 and the
  aerial display tokens govern content; Cinzel is reserved for wordmarks. Existing components own
  their styling; no theme override bundle or frontend dependencies. Shared tokens are additive so
  the separate portal's existing palette/layout are preserved. Public page IDs, field names,
  links, ARIA and `data-*` bindings remain byte-identical to the pre-change contract snapshot.

- A rule that must hold on every request (first-sign-in) lives in the proxy, not a layout: Next does not re-render shared layouts on client-side navigation.
- Layout work is verified by the capture suite, not by eye: `app/scripts/README-demo.md`.
- A Git deploy never migrates the hosted database (`docs/RUNBOOK.md` §1). SPEC-012 adds no migration.

## Session Notes

- Funnel: `node scripts/verify-aerial-funnel.mjs`; ignored captures/report in
  `output/playwright/aerial-funnel/`. Uses existing portal Playwright/axe modules. 80 checks pass;
  503/offline/invalid-response/success are mocked. Standard conversion regression:
  `SITE_FLOWS_ONLY=1 PLAYWRIGHT_MODULE="$PWD/app/node_modules/playwright/index.mjs" node scripts/verify-design-system.mjs`
  (56 pass). This is not live delivery or operational flight acceptance.

- Aerial verification: `PLAYWRIGHT_MODULE="$PWD/app/node_modules/playwright/index.mjs" node scripts/verify-aerial.mjs`
  against `python3 serve.py`; uses `/aerial.html?verify=1` because the local clean-URL translator does
  not map query strings. `verification.json` records 53 passing checks; no native-phone FPS claim.
- Public-site verification: `node build.mjs --check`, `node --test 'tests/*.test.mjs'`, then
  `PLAYWRIGHT_MODULE="$PWD/app/node_modules/playwright/index.mjs" AXE_MODULE="$PWD/app/node_modules/@axe-core/playwright/dist/index.mjs" node scripts/verify-design-system.mjs`
  against `python3 serve.py`. Uses existing portal test tooling without adding root dependencies.
  The `SITE_FLOWS_ONLY=1` option runs the conversion/keyboard smoke checks alone. Do not treat mocked
  deliveries as live ingestion evidence or automated AA scans as native screen-reader acceptance.

- Local stack: `supabase start -x vector` (546xx ports), `pnpm demo:seed`, then `pnpm dev --port 3100` or `pnpm build && PORT=3100 pnpm start`, then `pnpm screens`. Re-seed to clear the login gate between runs.

## Aerial implementation handoff — 2026-10-14

- Built deterministic opt-in page/CSS; production build drift check passes unchanged.
- Tests first: initial missing-module RED, then shader and lifecycle regressions fixed; current full static/API/geometry suite 134 passed.
- Aircraft normalized to a 1.8-unit span in the same physical scene, with close-up hero cameras and aircraft-centred inspection. No identified rotor rig; only subtle whole-aircraft hover is animated.
- QA exists only with `?verify=1`: `window.__aerial.ready` boolean; synchronous `setProgress(u)`, immediate `setSensor(boolean)`, `render()`, `stats()` (calls, triangles, camera position/target/direction, modelLoaded, original bounds/scale), and `context` WebGL context. PreserveDrawingBuffer only in this mode.
- Controller browser run passed 35 checks with zero normal-load shader/page/CSP errors and a measured maximum of 13 main-pass draw calls. This is functional evidence, not photorealism or native-device FPS acceptance; see docs/AERIAL-PREVIEW.md.
- Existing unrelated files, controller-owned assets/vendor directory, production homepage/API/security policy remain untouched. Asset rights stay local-evaluation-only.
