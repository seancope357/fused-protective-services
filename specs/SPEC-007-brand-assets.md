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
| `assets/logo.webp` | 1000×1000 | brand plate **and** voxel source |
| `assets/logo-512.png` | 512×512 | the portal's copy |
| `assets/logo.png` | 1000×1000 | master; not served |

> **Amended after measurement (see Open decisions).** This table originally called for
> `assets/logo-512.webp` as a downscaled plate with `logo.png` kept separately as the voxel
> source. Both assumptions were wrong. The plate and the voxel source are the *same fetch*
> on `/`, so splitting them adds a request rather than removing bytes; and a 512 downscale
> loses more of the settled emblem than q95 re-encoding does while producing a *larger*
> file. One full-resolution WebP does both jobs.

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

> **Amended after measurement.** The premise above conflates two things the code keeps
> separate, and the instrumented sampler settled it:
>
> * **Cube placement never used the source resolution.** `GRID_ROWS` is already `256`, and
>   `sample()` box-filters the plate to 256×256 before reading a pixel. The master has no
>   alpha channel, so `ALPHA_CUTOFF` culls nothing and all 65,536 cells become cubes — at
>   1000², 512² and 256² alike. Shrinking the file would not have removed one cube.
> * **Sharpness is the thing the source controls.** `makeTexture()` uploads the plate whole
>   and each cube samples its own tile, so the settled emblem is as sharp as the file. At
>   2× DPR a 512² source retains 78.4% of the master's acutance and 256² about 68%, against
>   0.6% run-to-run noise — visible on the shield bevel and the sub-line.
>
> So the answer is neither "shrink it" nor "keep a separate full-resolution copy": re-encode
> in place. q95 WebP at full size keeps 94.6% for 133,962 bytes — smaller than the 512² PNG
> (157,501) and 16 points sharper. The plate and the forge share it, as they already did.
>
> There is also nothing to "exclude from the pages that do not need it": `careers.html`
> never loaded the forge, and `index.html` paints the plate in the nav, hero and footer
> anyway. The two jobs were always one fetch.

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
   > **Cannot be met before DNS cutover.** Both validators fetch a *public* URL, and
   > `fusedprotectiveservices.com` does not resolve yet (`docs/OPEN_QUESTIONS.md`: DNS).
   > What is checkable now is checked in `tests/assets.test.mjs`: the card is a 1200×630
   > PNG under 300 KB, and `og:image`, `:width`, `:height`, `:alt`, `:type` and
   > `twitter:card=summary_large_image` are all present on `index.html` and `careers.html`.
   > Re-run both validators as part of the E2 gate once DNS is live.
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

`scripts/build-assets.sh` · `scripts/og-card.mjs` · `assets/icon-{32,180,512}.png` ·
`assets/og-card.png` · `assets/logo.webp` · `assets/logo-512.png` ·
`src/data/site.mjs` (asset paths) · `src/templates/head.mjs` ·
`src/templates/careers/head.mjs` · `src/templates/invoice/head.mjs` ·
`src/templates/legal/page.mjs` · `build.mjs` (assertion) · `js/logo-forge.js` ·
`app/scripts/sync-shared.mjs` · `tests/assets.test.mjs` ·
`tests/placeholder-gate.test.mjs` (fixture) · `context/ui-standards.md` ·
regenerated output

Wider than first listed, for reasons that only show up in the code:

* **`src/data/site.mjs`** — asset paths are facts, and invariant 5 puts facts in `src/data`.
  `site.logo` already lived there; `icons`, `ogCard` and `logoFallback` join it, and
  `build.mjs` asserts against that list rather than a second one.
* **The other three head templates** — `careers/head.mjs`, `invoice/head.mjs` and
  `legal/page.mjs` each carried `<link rel="icon" type="image/png" href="${site.logo}">`.
  Changing `site.logo` to WebP would have left all three declaring a PNG that is not one,
  still at 1000×1000. They now link `icon-32.png` like `head.mjs` does.
* **`tests/placeholder-gate.test.mjs`** — its fixture builds a checkout of `src/` and
  `build.mjs` only. The new existence assertion correctly refuses to build there, so the
  fixture now supplies empty stand-ins for `assets/`. No assertion in that file changed.

## Open decisions

- **Does `assets/logo.png` shrink?** Decided by design 3's measurement, not in advance. Say
  in the PR what you measured and what you chose.
  **Decided: no — it is re-encoded, not resized, and kept as the uncommitted-to-any-page
  master.** `assets/logo.webp` (1000², q95, 133,962 B) replaces it on every page. The
  master stays in `assets/` because `scripts/build-assets.sh` reads it; no page links it,
  so it costs a first view nothing.
- **A web app manifest?** *Recommended: not now.* Nobody installs a security contractor's
  marketing site to their home screen. `icon-512.png` exists so adding one later is trivial.
  **Decided: not now**, as recommended. `icon-512.png` is generated and linked as
  `rel="icon" sizes="512x512"`, so a manifest is a file away.
- **WebP with PNG fallback, or PNG alone?** *Recommended: WebP with fallback* for the brand
  plate only — universally supported now, and it is the largest rendered image. Keep the
  icons and the OG card as PNG; some social scrapers still handle WebP badly.
  **Decided: WebP with no `<picture>` fallback**, against the recommendation, for two
  reasons found while building:
  1. `css/site.css` declares `@layer` (Chrome 99 / Safari 15.4, March 2022). WebP was
     universal from Safari 14, September 2020. Every browser that can lay this page out
     can decode the plate; a fallback would never be served.
  2. A `<picture>` wrapper is not free here. `.brand-img` is a flex item of `.brand-link`,
     so wrapping it makes `<picture>` the flex item and the inline `<img>` inside gains a
     line-box descender — the nav mark grows by several pixels. Correcting that needs a
     `picture { display: contents }` rule in `src/styles/base.css`, which SPEC-006 is
     rewriting. Ship the format now; SPEC-006 or SPEC-009 can add `<picture>` for free
     when it is already in that file.
  Icons and the OG card stay PNG, as recommended. `assets/logo-512.png` still exists as the
  portal's copy and as the fallback source if one is ever wanted.
