# Progress Tracker

Updated: 2026-09-14. This file tracks the current implementation unit; [PROGRESS.md](../PROGRESS.md) retains the broader operational history and backlog.

## Current Phase

Marketing site refinement.

## Current Goal

Rewrite the protocol section for prospective clients and remove the “TACTICAL INTELLIGENCE BRIEF” element.

## Completed

- Confirmed the working tree was clean and the existing generated output passed its drift check before editing.
- Removed the badge and its exclusive styling; regenerated `index.html` and `css/site.css` from source.
- `node build.mjs`, `node build.mjs --check`, all 7 existing intake tests, and `git diff --check` passed.
- Visually verified the local hero at 1440×900 and 390×844: badge absent, opening copy visible, WebGL canvas rendered, no horizontal overflow, and no browser console errors or warnings.
- Updated the intro-copy rule in `ui-standards.md` and linked this unit from `PROGRESS.md`.
- Published the badge removal as `1387db3` to `origin/main`; exact-commit CI and both Vercel deployments passed, and production HTML/CSS matched the committed files.
- Shortened the scroll cue to “SCROLL ↓” and regenerated `index.html`; CSS and JavaScript are unchanged.
- Verified the shortened cue at 1440×900 and 390×844: visible at the top (opacity 1), hidden after scrolling 400px (opacity 0), with no browser console errors or warnings. Build, drift check, all 7 intake tests, and diff checks passed again.
- Published the simplified scroll cue as `83003e0`; exact-commit CI and production deployment passed, and the live cue retained its fade.

- Rewrote all four protocol steps for clients; removed tactical badges and simulated logs; added expectations lists and consistent “How It Works” navigation.
- Build, drift check, all 7 intake tests, and diff checks passed. Browser checks at 1440px, 1024px, and 390px verified all four tabs, single-panel visibility, arrow/Home/End keyboard focus, focusable panels, quote links, and no horizontal overflow or console errors. Visually reviewed all four desktop panels and the mobile layout.

## In Progress

None. The implementation and local validation are complete.

## Next Up

No further implementation is needed for this unit. Continue the authorized GitHub `main` production workflow; GitHub commit checks and deployment records track the release outcome.

## Open Questions

None for this unit.

## Architecture Decisions

Retain the four existing stage IDs, accessible tab behavior, `#lifecycle` section anchor, and `#quote` conversion path. Replace the protocol data fields `badge`, `meta`, and `terminal` with `expectations`; synchronize `data-model.md`, `business.md`, and `ui-standards.md`. Avoid new service promises or changes to internal procedures.

## Session Notes

- Edit source files and regenerate with `node build.mjs`; never hand-edit generated HTML/CSS.
- Release workflow: continue the authorized website refinements on `origin/main` and verify the production site.
- Build retains the existing DPS licence placeholder warning. The passing intake suite logs existing notification-stub diagnostics; no API code changed.
