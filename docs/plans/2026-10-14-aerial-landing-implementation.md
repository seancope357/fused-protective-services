# Fused Aerial Landing Implementation Plan

> **For Hermes:** Use subagent-driven-development to implement and independently review the experience.

**Goal:** Build and run a local cinematic three.js aerial-service landing experience that Sean can inspect in a browser.

**Architecture:** Add a separately built, noindex preview at `/prototypes/aerial/` with sources in `src/` and one renderer in `js/aerial/`. Existing homepage output, portal, business contracts, security headers and original prototype remain unchanged.

**Tech Stack:** Vendored three.js r160, locally vendored matching glTF/HDR loaders, vanilla ESM, layered CSS, Node built-in tests, the existing Python preview server and installed Playwright for QA.

## Execution contract

Sean explicitly requested implementation and a running local server. Execute this plan now with an implementation agent, controller-owned asset provenance, then independent spec/code review and browser verification. No push or deployment. Work in place with strictly disjoint ownership: implementation agent owns new aerial source/build integration; controller owns downloaded assets, vendor files and QA artifacts. Preserve unrelated untracked research/prototype files and SPEC-016 work.

## Task 1 — asset vertical slice

Files: `assets/aerial/aircraft.glb`, `assets/aerial/PROVENANCE.md`, `js/vendor/aerial/GLTFLoader.mjs`, `js/vendor/aerial/BufferGeometryUtils.mjs`, `js/vendor/aerial/RGBELoader.mjs`, `js/vendor/aerial/PROVENANCE.md`.

1. Download an inspectable detailed aircraft and inspect GLB JSON: meshes, PBR maps, extensions, topology and author licence metadata.
2. Preserve exact source/version/checksum. An upstream attribution label does not resolve contradictory rights statements: if provenance is uncertain, identify it as local evaluation only and block public release.
3. Vendor matching r160 loader modules, rewriting only package-relative imports to the existing local engine; keep licence and source records.
4. Obtain a small licensed HDRI for image-based lighting. If network fails, use a genuinely rendered, original studio lighting environment and document the fallback rather than fake a downloaded asset.
5. Verify GLB parse and asset request success in the actual browser before polishing.

## Task 2 — deterministic preview shell

Files: `src/data/aerial.mjs`, `src/templates/aerial/page.mjs`, `src/styles/components/aerial.css`, `src/styles/components/aerial-responsive.css`, `build.mjs`, `tests/aerial.test.mjs`.

1. Write failing Node tests for opt-in preview build output, semantic buttons, noindex, inquiry target and invariant preservation.
2. Run `node --test tests/aerial.test.mjs` and record RED.
3. Add a separate `--aerial-preview` mode (and `--aerial-preview --check`) to build the new page/CSS using `html` escaping and explicit layered CSS ordering. Default generated files must remain byte-identical.
4. Compose a sparse luxury landing page around a full-viewport fixed scene with four scroll chapters. Use existing font and brand tokens; do not expose pretend telemetry.
5. Provide keyboard controls, real loading/error states, a static fallback, inquiry navigation and attribution.
6. Re-run tests; run `node build.mjs --check`.

## Task 3 — physical scene and continuous camera

Files: `js/aerial/boot.mjs`, `js/aerial/scene.mjs`, `js/aerial/world.mjs`, `js/aerial/aircraft.mjs`, `js/aerial/camera.mjs`, `js/aerial/state.mjs`.

1. Add tests before implementation for clamping, progress endpoints, finite camera values and frame-rate-independent damping.
2. Load the actual textured GLB, normalize scale/origin, use PBR environment lighting and a controlled blue-hour key/rim setup. No toy primitive substitute.
3. Build a fictional commercial property with detailed ground/material variation, building, glazing, drive, fence and vegetation. Instance repeated parts.
4. Author a continuous close-up-to-overview-to-final camera path, with portrait compositions and bounded inspection.
5. Add subtle hover/rotor motion only where model hierarchy supports it; never distort an unknown mesh as a rotor.
6. Pause offscreen/hidden; reduced motion freezes autonomous movement; dispose resources and handle context loss.

## Task 4 — sensor transition and controls

Files: `js/aerial/sensor.mjs`, `js/aerial/interaction.mjs`, existing new aerial modules.

1. Test sensor target, pause, inspection/reset/Escape and reduced-motion state transitions.
2. Cinematic/Sensor controls transition the actual same world materials and a bounded scan surface. Always display Illustrative visualization in sensor mode.
3. Inspect opt-in allows bounded pointer rotation with keyboard equivalents and Escape/reset. Normal touch/wheel remains native page scrolling.
4. Add a `?verify=1`-only synchronous QA handle to set progress/view, force rendering and inspect scene state. Document that handle as non-release scaffolding.

## Task 5 — local server and proof

Files: `scripts/verify-aerial.mjs`, `docs/AERIAL-PREVIEW.md`; captures/reports under the managed scratch directory.

1. Build twice and compare hashes; run `node --test tests/*.test.mjs`, `node build.mjs --check`, and `git diff --check`, preserving actual exit codes.
2. Launch the existing `serve.py` in a tracked background process on an unused port, retain the process id and leave it running for Sean.
3. Playwright loads the preview under actual CSP, waits for real asset readiness, rejects page/shader/CSP errors and missing assets, then exercises scroll, sensor, inspect, keyboard/reset, pause, reduced-motion, failed assets and context loss.
4. Capture close-up, overview, sensor and final states. Compute nonblank/frame-difference metrics; separately inspect render statistics and asset totals. Do not claim those metrics prove photorealism.
5. Test 320/375/414/768/1440 widths for overflow and controls. Record frame times on the actual available backend; real phone GPU performance remains unverified without a real phone.
6. Independent spec review first; independent code quality review second. Fix concrete defects and re-run affected checks.
7. Open the verified local URL for Sean and report the URL, working controls and honest limitations. No production commit/push is needed to view the page.

## Exact QA examples

```js
import assert from 'node:assert/strict';
// Implement as pure state math so endpoint tests do not need a GPU.
assert.equal(clampProgress(-1), 0);
assert.equal(clampProgress(2), 1);
for (const u of [0, .25, .5, .75, 1]) {
  assert.ok(cameraPose(u, false).position.every(Number.isFinite));
}
```

```bash
node build.mjs --aerial-preview
node build.mjs --aerial-preview --check
node build.mjs --check
node --test tests/*.test.mjs
python3 serve.py
```

No test should submit a lead, use production credentials, alter CSP, or silently pass a failed download/render.
