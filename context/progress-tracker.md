# Progress Tracker

Updated: 2026-09-14. This file tracks the current implementation unit; [PROGRESS.md](../PROGRESS.md) retains the broader operational history and backlog.

## Current Phase

Marketing site refinement.

## Current Goal

Shorten the hero indicator from “SCROLL TO ASSEMBLE” to “SCROLL”, preserving its arrow and fade on scroll.

## Completed

- Confirmed the working tree was clean and the existing generated output passed its drift check before editing.
- Removed the badge and its exclusive styling; regenerated `index.html` and `css/site.css` from source.
- `node build.mjs`, `node build.mjs --check`, all 7 existing intake tests, and `git diff --check` passed.
- Visually verified the local hero at 1440×900 and 390×844: badge absent, opening copy visible, WebGL canvas rendered, no horizontal overflow, and no browser console errors or warnings.
- Updated the intro-copy rule in `ui-standards.md` and linked this unit from `PROGRESS.md`.
- Published the badge removal as `1387db3` to `origin/main`; exact-commit CI and both Vercel deployments passed, and production HTML/CSS matched the committed files.
- Shortened the scroll cue to “SCROLL ↓” and regenerated `index.html`; CSS and JavaScript are unchanged.
- Verified the shortened cue at 1440×900 and 390×844: visible at the top (opacity 1), hidden after scrolling 400px (opacity 0), with no browser console errors or warnings. Build, drift check, all 7 intake tests, and diff checks passed again.

## In Progress

None. The implementation and local validation are complete.

## Next Up

No further implementation is needed for this unit. Continue the authorized GitHub `main` production workflow; GitHub commit checks and deployment records track the release outcome.

## Open Questions

None for this unit.

## Architecture Decisions

No architecture changes. This unit changes only the cue's text; preserve the arrow, CSS fade, scroll animation, motion clocks, and fallback behavior.

## Session Notes

- Edit source files and regenerate with `node build.mjs`; never hand-edit generated HTML/CSS.
- Release authorization: commit the scoped hero change, push to `origin/main`, and verify the production site.
- Build retains the existing DPS licence placeholder warning. The passing intake suite logs existing notification-stub diagnostics; no API code changed.
