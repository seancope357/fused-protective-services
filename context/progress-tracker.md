# Progress Tracker

Updated: 2026-09-14. This file tracks the current implementation unit; [PROGRESS.md](../PROGRESS.md) retains the broader operational history and backlog.

## Current Phase

Marketing site refinement.

## Current Goal

Remove the “FPS // Assembly Protocol” hero badge to reduce visual clutter, as requested by Sean.

## Completed

- Confirmed the working tree was clean and the existing generated output passed its drift check before editing.
- Removed the badge and its exclusive styling; regenerated `index.html` and `css/site.css` from source.
- `node build.mjs`, `node build.mjs --check`, all 7 existing intake tests, and `git diff --check` passed.
- Visually verified the local hero at 1440×900 and 390×844: badge absent, opening copy visible, WebGL canvas rendered, no horizontal overflow, and no browser console errors or warnings.
- Updated the intro-copy rule in `ui-standards.md` and linked this unit from `PROGRESS.md`.

## In Progress

None. The implementation and local validation are complete.

## Next Up

No further implementation is needed for this unit. Sean authorized committing and pushing to GitHub `main` for production on 2026-09-14; GitHub commit checks and deployment records track the release outcome.

## Open Questions

None for this unit. The requested label is a span styled as a badge; removal is limited to that badge and its CSS.

## Architecture Decisions

No architecture changes. Preserve the existing intro copy, scroll animation, motion clocks, and fallback behavior.

## Session Notes

- Edit source files and regenerate with `node build.mjs`; never hand-edit generated HTML/CSS.
- Release authorization: commit the scoped hero change, push to `origin/main`, and verify the production site.
- Build retains the existing DPS licence placeholder warning. The passing intake suite logs existing notification-stub diagnostics; no API code changed.
