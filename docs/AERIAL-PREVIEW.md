# Fused Aerial — hosted page

## Where it lives

**https://fusedprotectiveservices.com/aerial** (generated as `aerial.html`,
served at the clean URL by `cleanUrls` in the generated `vercel.json`).

It is a normal page of the marketing site: built by the default `node build.mjs`,
linked from the nav island and mobile drawer, listed in `sitemap.xml`, canonical
and crawlable. It is no longer an opt-in preview and no longer carries `noindex`.

Locally it is `http://localhost:5050/aerial` via `serve.py`.

### Controls

- Scroll: continuous camera journey from the detailed aircraft to the fictional
  property. Camera and look target converge with elapsed-time exponential damping.
- Sensor view: toggle the actual parcel-clipped scanning shader. The sensor chapter
  also introduces the visualization unless the visitor explicitly overrides it.
- Inspect: enter an aircraft-centred composition from any chapter. Drag or use the
  arrow buttons/keyboard, Reset to clear the orbit, Escape to restore the story view.
- On touch, vertical scrolling remains native during inspection; horizontal drag
  can adjust inspection. Ordinary viewing never captures wheel/touch zoom.
- Pause: stop autonomous hover, rotor motion and scanning. Explicit user-controlled
  transitions remain available. Reduced motion starts stable without autonomous
  movement and restores the authored blade pose.

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
shader pixel changes, inspection/reset/Escape, reduced motion, responsive toolbar
and overflow, absent QA globals on the normal URL, required-asset failure and
Retry, context-loss fallback and Retry, asset bytes and renderer counts. It never
submits a lead. Intentional failure tests are isolated from normal-load errors.

`scripts/verify-aerial-nav.mjs` separately proves the new nav entry: no horizontal
overflow and no nav link outside the viewport at 375/414/768/1024/1440, the Aerial
link present on the homepage, the page reachable with a live model and four
recognized rotors, no `noindex`, and the canonical pointing at `/aerial`.

### Latest evidence — 2026-10-19

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
- **Service claims are unconfirmed.** Whether Fused holds a Part 107 certificated
  pilot and Texas-compliant coverage was asked and not answered. The copy was
  therefore left as capability language — "can complement a protective plan",
  "Operational scope and aircraft availability are confirmed during inquiry",
  and an explicit "No live surveillance, thermal readings or incident detection".
  Do not upgrade this page to assert live operational capability without that
  confirmation.
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
