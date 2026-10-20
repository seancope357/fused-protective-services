# Fused Aerial — hosted page

## Where it lives

**https://fusedprotectiveservices.com/aerial** (generated as `aerial.html`,
served at the clean URL by `cleanUrls` in the generated `vercel.json`).

It is a normal page of the marketing site: built by the default `node build.mjs`,
linked from the nav island and mobile drawer, listed in `sitemap.xml`, canonical
and crawlable. It is no longer an opt-in preview and no longer carries `noindex`.

Locally it is `http://localhost:5050/aerial` via `serve.py`.

### Controls (updated 2026-10-20)

- **Day / Night:** mutually exclusive, keyboard- and touch-operable selections. Day starts selected.
  The choice changes the sky, fog, sun/moon and ambient light, exposure and actual property fixtures.
  It persists through scrolling, reduced-motion changes and Retry.
- **Scroll:** continuous native camera journey from the aircraft to the fictional property. Camera
  and look target converge using elapsed-time damping. Touch/wheel scrolling are never captured.
- **Reduced motion:** fixed camera, hover and authored rotor pose, with Day/Night still usable.
- **Retry:** real recovery after required-asset failure or graphics-context loss. During loading or
  error, mode selection updates the static poster and saves the choice without rendering a failed
  scene. The requested Sensor/Pause/Inspect replacement removes the old overlay and orbit controls.

## Rebuild and serve

From the repository root:

```bash
node build.mjs
node build.mjs --check
python3 serve.py
```

There is no new dependency installation or root package.json. HTML and CSS are
generated from `src/`; never edit `aerial.html` or `css/aerial.css` by hand.
JavaScript modules reload when the browser is refreshed; this server is not a
hot-module-reloading bundler.

## Verification

```bash
node --test tests/*.test.mjs
node build.mjs --verify-release
node scripts/verify-aerial.mjs
node scripts/verify-aerial-nav.mjs
```

The unquoted test glob matters with the older default Node 20 on this machine.
The Node-only three.js loader helper explicitly treats the unchanged vendored
.js engine as ESM for geometry tests; no runtime/browser engine modification.

Browser verification defaults to the installed Playwright module, local port
5050 and `/aerial.html`. It can be redirected without editing code:

```bash
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
AERIAL_PREVIEW_URL=http://127.0.0.1:5050 \
AERIAL_PAGE_PATH=/aerial.html \
AERIAL_QA_DIR=/absolute/path/to/output \
node scripts/verify-aerial.mjs
```

The browser harness captures real rendered frames and checks native scroll,
Day/Night pixel changes and camera stability, reduced motion, responsive toolbar
and overflow, absent QA globals on the normal URL, required-asset failure and
Retry, optional HDR fallback, context-loss recovery, asset bytes and renderer counts. It never
submits a lead. Intentional failure tests are isolated from normal-load errors.

`scripts/verify-aerial-nav.mjs` separately proves the new nav entry: no horizontal
overflow and no nav link outside the viewport at 375/414/768/1024/1440, the Aerial
link present on the homepage, the page reachable with a live model and four
recognized rotors, no `noindex`, and the canonical pointing at `/aerial`.

### Environment refresh — 2026-10-20

The house uses real facade openings, recessed glazing, room furnishings, limestone masonry,
timber shading, separate coping and a recessed roof bed. The prior 1m overlap between pavilion
and wing is removed. Subpixel nearly coplanar terrace strips are replaced with derivative-filtered
paver joints. Rolling terrain, denser mipmapped/alpha-to-coverage leaf sprays, irregular inner
crowns, planted borders, rock outcrops and grass tufts replace the sparse setting. All additions
are original procedural code; asset transfer remains unchanged.

Day/Night is a physical lighting change, not a full-screen tint. Static property shadow maps are
cached, with 4096 desktop / 2048 phone/coarse-pointer maps. The aircraft does not cast a stale
moving shadow into that cache. Phone resolution now caps at 1.75 DPR instead of being forced to 1;
desktop retains its cap of 2. This deliberately spends more geometry/pixels on environmental detail;
real-device GPU acceptance remains outstanding.

Current local evidence:

- Build and drift check pass; all **142 static/API/geometry tests** pass.
- **53 browser checks** pass, including actual rendered pixels, both modes, fixed camera on lighting
  selection, keyboard/touch, scroll round-trip, 320–1440px controls, phone resolution, reduced motion,
  failed aircraft/HDR, static fallback, context loss and Retry with selection preservation.
- **Four WCAG AA scans** (Day/Night × default/reduced motion): **zero violations**.
- Maximum measured desktop main pass: **25 calls / 248,219 triangles**. Deferred aircraft/images/HDR
  remain **7,867,553 bytes**. The new environment is more detailed than the previous version; these
  are render counters, not physical-device FPS evidence.
- Final day/night and phone captures plus `verification.json` are local at
  `output/playwright/aerial-refinement/`. Normal-load shader/page console is clean.
- No publishing was requested. The 2026-10-19 evidence below is historical.

### Previous evidence — 2026-10-19 (before the environment refresh)

- Static/API/geometry tests: **142 passed, zero failed**.
- Browser suite against `/aerial.html`: **35 passing checks**, zero failures,
  including actual HDR decoding and exact-length required-asset validation.
- Nav/integration suite: **25 passing checks** across five widths.
- Accessibility: axe `wcag2a,wcag2aa,wcag21a,wcag21aa` reports **0 violations**
  on `/aerial` in both default and reduced-motion presentation. `/aerial` is now
  in both blocking CI axe scan lists, and all seven public pages are still clean
  after the nav change (14 scans, 0 violations).
- `vercel.json` is **byte-identical** after integration: the page carries no
  inline script, so it contributes no new CSP hash and the policy is unchanged.
- `node build.mjs --check` and `node build.mjs --verify-release` both pass;
  `git diff --check` is clean.
- Measured maximum main-pass draw calls: **17** (13 scene + 4 rotor groups).
- Rendered triangles at the hero composition: **137,255**.
- Deferred aircraft/images/HDR response-body bytes: **7,867,553**. This is not a
  claim that the entire page including the engine has that transfer size.
- Managed scratch captures/report: `/Users/cope/.hermes/cache/scratch/fused-aerial-qa/`.
  These are inspection evidence, not production assets or permanent storage.

### Fixed on 2026-10-19

The rotor rig had been written and unit-tested but never wired in: `scene.mjs`
imported `prepareAircraft` while line 53 still called the un-imported
`batchStatic`. Every load therefore threw `ReferenceError: batchStatic is not
defined`, was swallowed by the asset-failure catch, and the page showed
"Scene asset could not load" with a static poster. The rig is now wired — held in
scope, driven by `rig.update()` on the pause-aware elapsed clock, disposed with
the scene, and reporting real draw/rotor counts through `stats()`. Pause and
reduced motion restore the authored blade pose rather than freezing a blur disc.

## Honest limitations / open risks

- **Aircraft rights remain unresolved, and the risk was knowingly accepted.**
  The mirrored model declares CC BY 4.0, but its uploader says it came from DJI's
  website. Original-rights permission is not established. Sean was shown this and
  chose on 2026-10-19 to publish as-is. See assets/aerial/PROVENANCE.md for the
  recorded decision and the removal mitigation. No claim Fused owns or operates
  this aircraft. A rights-cleared replacement is still the correct fix.
- **Pilot-operated patrols are confirmed; additional claims remain unconfirmed.** Sean supplied
  that service capability on 2026-10-20. The page now sells drone protection inquiries, with scope,
  flight permissions and availability confirmed before booking. Specific certification details,
  flight territories, thermal/night operations and autonomy have not been supplied. The fictional
  scene and Day/Night do not demonstrate actual operations or aircraft ownership.
- **Payload is heavy for a marketing page.** ~7.9MB of deferred assets and
  127,011 source triangles, above the proposed 100k mobile target. There is no
  mobile low-detail tier or LOD yet. Phones will download the full aircraft.
- Headless Chromium uses **SwiftShader software rendering**, not the Mac/phone GPU.
  The measured short headless sample was about 167ms median and 217ms p95. It does
  not meet a 60fps target and is not evidence of native GPU or phone performance.
  Real-device performance and the 20-second performance gate are unverified.
- Human visual acceptance is still required. Nonblank pixels, geometry counts,
  passing controls and zero axe violations do not prove photorealism or aesthetic
  quality. Rotor blur opacity in particular wants a human eye on real hardware.
- Rotor direction is a balanced visualization choice from measured geometry, not
  certified motor handedness or measured RPM.
- Inquiry links navigate to the existing homepage form. No new aerial intake
  contract, booking flow, service credentials or operating capabilities were invented.

Keep the old perimeter prototype and research files intact.


## Aerial sales funnel — 2026-10-20

Four chapters now lead from pilot-operated patrols to property concerns, the pilot's role and a
scoped inquiry. “Request drone protection” appears in the header and each chapter, pointing to
`/?service=aerial#quote`. That form shows drone-specific introduction/prompts, requires an explicit
existing division choice and retains aerial intent in submitted notes. No new division, rate,
backend or instant-booking contract was added. Competitor research is recorded in
[`fused-aerial-competitive-brief-2026-10-20.html`](fused-aerial-competitive-brief-2026-10-20.html).

`node scripts/verify-aerial-funnel.mjs`: 80 checks passed, including 320/375/768/1440px copy and CTA
geometry, two Day/Night WCAG AA scans with zero violations, actual CTA navigation, field validation,
intent/notes preservation, explicit delivery failures, offline and malformed responses, mocked
success, consent, normal/unknown-intent behavior and no-JS links. Quotes are intercepted fixtures;
no live lead was sent. Source/build drift and all 146 tests pass. Local captures are in
`output/playwright/aerial-funnel/`. This copy update has not been deployed.

The full scene regression also passes all 53 checks. Its native scroll round-trip check now waits
for the native scroll event before reading convergence, preventing a stale settled camera state
from racing the assertion. The distance thresholds are unchanged; no runtime camera code changed.
Current report: `output/playwright/aerial-funnel-scene/verification.json`. The existing public
keyboard/conversion smoke suite passes all 56 checks.
