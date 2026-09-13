# SPEC-007 — Favicon, social card, and the 1 MB logo
**Gate:** GO_LIVE.md → E2 · **Surface:** static site
**Size:** S · **Depends on:** — · **Human blocker:** none

## Why

`assets/logo.png` is **1,095,464 bytes at 1000×1000** and is doing four different jobs:

| Job | Consumer | Problem |
| :--- | :--- | :--- |
| Brand plate | hero, portal, emails | 1 MB for a rendered element of a few hundred px |
| Voxel source | `js/logo-forge.js` | the only job that might need the resolution |
| Favicon | `<link rel="icon">` in `head.mjs:99` | a 1 MB favicon, fetched on every page |
| `og:image` | OpenGraph + Twitter card | 1:1 image under `summary_large_image`, which wants 1200×630 |

So every share of this site renders a megabyte square letterboxed into a wide frame, and
every page load pays for a favicon a hundred times larger than it needs to be. It is also
the single heaviest asset on a page that already asks a lot of a mobile connection.

## Scope

**In**
- A proper icon set and a purpose-built social card.
- A right-sized brand plate.
- Measuring what the voxel forge actually needs before shrinking its source.
- A build assertion that every referenced asset exists.

**Out**
- Redesigning the logo or the brand.
- Image optimisation for anything else (SPEC-009 covers page weight generally).
- Adding an image toolchain to the build — see the constraint below.

## Design

**1 · Generate once, commit the outputs.** `build.mjs` is zero-dependency and stays that
way: it must never depend on an image library. Derivatives are produced by a documented
one-off script, `scripts/build-assets.sh`, which may use ImageMagick or `npx sharp-cli`
(pinned) and is **not** part of the build. Commit the outputs; commit the script so the
work is reproducible; record the command in `context/ui-standards.md`.

**2 · The set.**

| File | Size | Purpose |
| :--- | :--- | :--- |
| `assets/icon-32.png` | 32×32 | favicon |
| `assets/icon-180.png` | 180×180 | apple-touch-icon |
| `assets/icon-512.png` | 512×512 | manifest / Android |
| `assets/og-card.png` | 1200×630 | OpenGraph + Twitter, ≤ 300 KB |
| `assets/logo-512.webp` | 512×512 | brand plate, with the PNG as fallback |
| `assets/logo.png` | see decision | voxel source |

The OG card is a **composition**, not a crop: emblem, wordmark, and a short line of
positioning copy, on the carbon/gold palette from `context/ui-standards.md`. A 1200×630
frame with a centred square logo and two-thirds empty is the same failure in a different
aspect ratio.

**3 · Measure before shrinking the voxel source.** `js/logo-forge.js` samples the logo to
place ~65,000 cubes. 65k cubes needs on the order of a 256×256 sample grid, not 1000×1000
— but *measure* it: instrument the sampler, render at 1000², 512² and 256², compare
visually and record the three screenshots in the PR. If 512² is indistinguishable, ship it
and note the saving; if it is not, keep the full-resolution file for that one job and
exclude it from the pages that do not need it. Do not guess.

**4 · Wire it up.** `src/templates/head.mjs` gains the icon links and points `og:image` and
`twitter:image` at the card with explicit `og:image:width`/`height` and `og:image:alt`.
`app/scripts/sync-shared.mjs` copies the brand plate into the portal — update it if the
filename changes, or the portal logo 404s.

**5 · Assert existence at build time.** `build.mjs` fails if a referenced asset is missing
from `assets/`. Reading the filesystem is deterministic; this is exactly the class of
error — a renamed file, a deploy without it — that otherwise ships as a broken image.

## Acceptance

1. Favicon requests fetch ≤ 10 KB, not 1 MB.
2. `og-card.png` is 1200×630, ≤ 300 KB, and a designed composition.
3. The Twitter/X card validator and Facebook's sharing debugger both render the wide card
   correctly — screenshots in the PR.
4. `og:image:width`, `og:image:height` and `og:image:alt` are present.
5. The brand plate renders identically to today at every breakpoint, from the smaller file.
6. The voxel assembly is visually unchanged — three comparison screenshots in the PR.
7. `build.mjs` exits non-zero if any referenced asset is missing.
8. The portal logo still resolves after the sync script change.
9. Total bytes for a first view of `/` drop by at least 800 KB, measured and stated in
   the PR.
10. `node build.mjs --check` clean.

## Test plan

- `tests/assets.test.mjs`: every asset referenced from `src/templates/` exists; the
  existence assertion fails the build when one is removed; the OG card is 1200×630 (read
  the PNG IHDR directly — no image library needed, 8 bytes at offset 16).
- Manual: both social validators; the three voxel renders; a before/after byte count from
  the network panel with the cache disabled.

## Files

`scripts/build-assets.sh` · `assets/icon-{32,180,512}.png` · `assets/og-card.png` ·
`assets/logo-512.webp` · `src/templates/head.mjs` · `build.mjs` (assertion) ·
`js/logo-forge.js` (if the source changes) · `app/scripts/sync-shared.mjs` ·
`tests/assets.test.mjs` · `context/ui-standards.md` · regenerated output

## Open decisions

- **Does `assets/logo.png` shrink?** Decided by design 3's measurement, not in advance. Say
  in the PR what you measured and what you chose.
- **A web app manifest?** *Recommended: not now.* Nobody installs a security contractor's
  marketing site to their home screen. `icon-512.png` exists so adding one later is trivial.
- **WebP with PNG fallback, or PNG alone?** *Recommended: WebP with fallback* for the brand
  plate only — universally supported now, and it is the largest rendered image. Keep the
  icons and the OG card as PNG; some social scrapers still handle WebP badly.
