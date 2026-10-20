# Perimeter prototype — measured results

**Prototype only.** `node build.mjs` does not touch `prototypes/`. Nothing here is linked
from the site or served in production. Companion to
[`../docs/RESEARCH-webgl-drone-scene.md`](../docs/RESEARCH-webgl-drone-scene.md).

```bash
python3 serve.py   # from the repo root — applies the real production headers
#  → http://localhost:5050/prototypes/perimeter.html
```

Serving through `serve.py` rather than a bare static server is deliberate: it applies the
production CSP, which is what caught the first two defects below.

## Files

| File | What |
|---|---|
| `perimeter.mjs` | the scene. One `THREE.Points`, one draw call, four beat uniforms |
| `perimeter.html` | the scroll track and the copy beats |
| `perimeter.css` | external by necessity — see defect 1 |
| `perimeter-boot.mjs` | external by necessity — see defect 1 |

## Measured, in a real browser

Point tier on the test machine: **22,000** (lowest tier — the harness reports low
`hardwareConcurrency`). Desktop tier is 90,000.

**Draw calls: 1** for the entire cloud, at every beat. That was the primary design goal.

### Beat 3 isolated (boundary uniform toggled at a fixed camera)

| `uBoundary` | mean R | mean B | warmth (R−B) | blown out | edge dark |
|---|---|---|---|---|---|
| 0.0 | 195.8 | 50.1 | 145.7 | 0.000 | 1.000 |
| 0.5 | 234.2 | 81.1 | 153.1 | 0.063 | 1.000 |
| 1.0 | 242.7 | 107.5 | 135.2 | 0.123 | 1.000 |

### Full scroll

| u | lit px | warmth | blown out | edge dark |
|---|---|---|---|---|
| 0.00 | 1,846 | 25.5 | 0.000 | 0.940 |
| 0.12 | 71,570 | 62.0 | 0.000 | 0.428 |
| 0.30 | 44,290 | 156.4 | 0.014 | 1.000 |
| 0.60 | 57,933 | 150.8 | 0.081 | 1.000 |
| 1.00 | 61,710 | 143.6 | 0.115 | 1.000 |

Reading: lit pixels climb as the sweep acquires the plan; warmth (R−B) climbs from cold
teal to gold; `edge dark` is the fraction of the left 8% of the frame — i.e. beyond the
property line — that stays unlit. **It reaches 1.000 once the cloud settles and stays
there**, which is the consent boundary holding visually.

`edge dark` is below 1.0 at u ≤ 0.12 because the pre-settle scatter cloud spans the whole
frame. That is abstract scatter, not site geometry, so it makes no coverage claim — but it
is worth knowing before anyone reads the number as a violation.

## Four defects found by measuring, not by looking

1. **Inline `<style>` and inline `<script type="module">` were both refused.** The
   production CSP is `script-src 'self'` with the production inline scripts allowlisted by
   sha256, plus `style-src 'self'` — so a new inline block of either kind is blocked
   outright. The page booted to a 300×150 default canvas and the HUD never left
   "booting…". Fix: external `perimeter.css` and `perimeter-boot.mjs`. This matches the
   repo's existing no-inline-handlers/styles invariant; the header enforces it.
2. **`requestAnimationFrame` is throttled to near zero in a headless/background tab**, so
   a verifier that waits on frames hangs — two eval timeouts before the cause was clear.
   Fix: `stepTo()` advances the damped settle in a plain synchronous loop and renders once.
3. **A chroma test (`r > b + 25`) silently inverted under additive blending.** Gold pixel
   counts *fell* as the gold beat advanced, which looked like a shader bug. It was the
   metric: additive accumulation raises every channel, so brighter gold measured as *less*
   saturated. Fix: measure channel means over lit pixels and report R−B warmth.
4. **The scene was genuinely blown out — the real bug, found behind defect 3.** With
   per-point alpha near 1.0, **88–92% of lit pixels were saturated to white** (mean RGB
   248/245/234, warmth 9–15). The gold tactical scan rendered as a white haze. Additive
   blending accumulates, so per-point alpha must be a small fraction: alpha dropped to
   0.035 unlit / 0.16 lit and `uSize` 2.4 → 1.7. Warmth went **9–15 → 135–156** and blown
   out **0.88–0.92 → ≤ 0.12**.

Defect 4 is the one to carry forward: **on a dense additive point cloud, alpha is a
budget, not a style choice.** At the 90,000-point desktop tier the accumulation is ~4×
higher again, so the alpha budget must be re-measured per tier before this ships.

## Not yet done

- Sharing one `WebGLRenderer` with `js/logo-forge.js` (the prototype owns its own).
- Desktop-tier (90k) alpha re-measurement and an FPS measurement on real hardware.
- Lighthouse against the SPEC-009 budget.
- Static fallback art for `data-forge-fallback`.
- The `verify: true` flag, `window.__perimeter`, `preserveDrawingBuffer`, `stepTo`,
  `debugBoundary` and `readStats` are **prototype scaffolding and must not ship**.
- Every number in the envelope row is still a `TBC` placeholder pending Cameron.
