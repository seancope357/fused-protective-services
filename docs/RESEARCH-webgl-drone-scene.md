# RESEARCH — WebGL motion for the drone security surface

**Status:** research only. No code written, no spec committed.
**Date:** 2026-10-10 · **Surface:** static marketing site · **Asked by:** Sean
**Question:** what is the best way to build a top-tier WebGL / three.js interactive
landing experience for the drone security service?

---

## 0 · The answer in five lines

1. **Extend the three.js engine that already exists** (`js/logo-forge.js`, vendored r160).
   React Three Fiber and Spline are both ruled out by this repository's invariants — not
   by taste.
2. **One hard idea, executed cleanly.** The 2026 award-winning cohort wins by picking a
   single technique, not by stacking effects.
3. **The idea should be a sensor, not a showreel:** a LiDAR-style point-cloud perimeter
   scan with a drone patrol path and live detection events. It *demonstrates the service*.
4. **Share one WebGL context.** A second renderer doubles the cost of a page that already
   runs a 65k-instance scene, a 2D ambient canvas and a cursor spotlight.
5. **It has to pass SPEC-009 or it does not ship.** LCP ≤ 2.5s, ≤ 250 KB script,
   Lighthouse ≥ 85 mobile. That budget already exists and already fails CI when broken.

---

## 1 · Stack decision, and why the obvious choices are wrong here

| Option | Verdict | Reason |
|---|---|---|
| **Vanilla three.js, vendored** | **USE THIS** | Already in the repo at r160, sha256-checked by `tests/csp.test.mjs`, imported statically. Zero new surface. |
| React Three Fiber | **Rejected** | Needs React + npm. Breaks invariant 2 ("the repository root has no `package.json` and never will") and the committed-output model that lets Vercel serve with no build step. |
| Spline | **Rejected, hardest** | Loads a scene from `prod.spline.design`. SPEC-006 deliberately removed *every* external script origin so `script-src` could be `'self'` with no allowlist. Spline would reopen the CSP. |
| Babylon.js | Rejected | A second engine for no capability we lack. |
| WebGPU renderer | Watch, don't adopt | The 2026 trend is a WebGPU renderer with a WebGL fallback (IVRESS). r160's WebGPU path is experimental and would mean two code paths to verify. Revisit at a three.js upgrade, per `docs/RUNBOOK.md`. |

**What already exists and must be reused, not reinvented:**

- `InstancedBufferGeometry` voxel engine, ~65k cubes, scroll-driven.
- **Dual motion clocks** on `<html>`: `--assembly` (scroll position) and
  `--assembly-settled` (real camera/cube arrival). Any new sequence must publish its own
  pair the same way — downstream CSS asserts completion on the *settled* clock.
- `html[data-forge-fallback="true"]` for no-WebGL / context-loss, collapsing the scroll
  track to a static plate.
- `prefers-reduced-motion` already disables kinetic scattering and snaps the camera home.

---

## 2 · The finding that decides the aesthetic

Tuch, Presslaber, Stöcklin, Opwis & Bargas-Avila (2012, *International Journal of
Human-Computer Studies*) measured that a page's **visual complexity shapes aesthetic
judgement within 50 ms**, detectable at 17 ms — before any conscious reading. But the same
study found the effect only works in the page's favour when the complexity matches what a
visitor expects of that category (**"prototypicality"**). A spectacular 3D hero on an
accountant's site works *against* it.

**This is the whole argument for the direction.** For most service businesses an elaborate
WebGL hero is a prototypicality mismatch. For a **drone security** operator it is the
opposite: sensors, thermal overlays, point clouds and perimeter geometry are *literally
what the service produces*. The 3D is prototypical here — provided it reads as an
operations display and not a design-studio demo. The moment it looks like art, the
advantage inverts.

Corollary, and it is a hard rule: **every motion element must be legible as capability.**
A rotating abstract blob is a mismatch. A property being scanned is a sales argument.

---

## 2b · Texas law constrains the content before the design does

**Drone security is a NEW service for FPS (confirmed 2026-10-10).** No track record, no
case studies, no telemetry. That changes both the copy and the legality of the visuals.
Verified against primary sources, not summaries:

- **Tex. Gov't Code § 423.003** — it is an offence (Class C misdemeanour) to use a drone
  to capture an image of an individual *or privately owned real property* in Texas **with
  intent to conduct surveillance**. § 423.004 makes possessing, disclosing, **displaying**
  or distributing such an image a separate offence.
- **§ 423.002(a)(6)** — it is lawful **"with the consent of the individual who owns or
  lawfully occupies the real property captured in the image."** *This single exemption is
  what the entire business model stands on.* Operating over a client's own property under
  written consent sits squarely inside it.
- **NPPA v. McCraw**, 5th Cir., 10 Jan 2024 — facial First Amendment challenges to the
  surveillance provisions **failed**; the court reversed and remanded for judgment in the
  State's favour, and separately held that **federal aviation law does not preempt** state
  drone regulation. Chapter 423 is live and enforceable. Anyone assuming those provisions
  were struck down is working from the withdrawn 2023 panel opinion.
- **§ 423.0045 / § 423.0046** — separate offences for operating over a **critical
  infrastructure facility** and over a **sports venue**. Both are plausible FPS pitches
  (industrial sites, events) and both need specific authority before they are advertised.

**Consequences, which are not negotiable:**

1. **The site plan in the scene must be synthetic.** Already recommended for operational
   security; now there is a statutory reason too — displaying a drone-captured image of
   private real property can itself implicate § 423.004.
2. **Copy must never imply surveillance beyond the client's own property.** No "we watch
   the whole block." Consent-bounded coverage is both the lawful position and the better
   sales story.
3. **Written property-owner consent becomes a product feature**, not paperwork — it is the
   § 423.002(a)(6) hook. Put it on the page.
4. **Unverified, must confirm before any claim ships:** whether a drone-based security
   operation requires a Texas DPS private security licence under Occupations Code
   Ch. 1702 (guard vs investigations company class). I did not establish this and will not
   guess — it is a licensing exposure. Cameron's counsel or DPS Private Security Bureau
   answers it, and the answer may gate the page going live at all.

**Not legal advice** — this is research for scoping. Every point above needs Cameron's
counsel to confirm before it becomes a public claim.

---

## 3 · The recommended scene: "Perimeter"

One idea. Scroll is the storytelling engine (the dominant 2026 pattern).

| Beat | What the visitor sees | What it says |
|---|---|---|
| 1 | A dark **synthetic** site plan resolves out of a sparse point cloud, points landing in sweeps as if being scanned | "We see the whole property" |
| 2 | A drone traces a patrol path above it; the sweep cone paints points as it passes | "Coverage is active, not static" |
| 3 | Points inside the fence line settle to gold; **everything beyond the property line stays dark and unscanned** | "Consent-bounded by design" — the § 423 posture, shown |
| 4 | The coverage envelope labels itself: altitude, sweep interval, response path to the on-ground officer | "Detection becomes response" |
| 5 | The cloud condenses into the gold shield plate — handing off to the existing emblem | Brand close, reuses what exists |

**Beat 4 changed, and this matters.** The original plan was two detection markers with
timestamps — a case study. **FPS has no detections yet, so that beat would be fabricated
proof**, which fails Sean's hard rule and would be the single most damaging thing on a
security vendor's site if a prospect asked about it. It is replaced with a *capability
envelope*: altitude, sweep cadence, and the handoff to a human officer. All of those are
true on day one, and the drone-plus-officer handoff is the actual differentiator against a
camera company.

Beat 3 also earns its keep twice: the dark area beyond the fence line is a design
flourish **and** a visual statement of the consent boundary that keeps the operation
inside § 423.002(a)(6).

Why this and not a drone model orbiting a hero: a GLB drone is a *product* shot, and
Cameron does not sell drones. He sells **coverage, detection and response** — and a GLB
plus textures is exactly the payload the budget cannot afford.

### Technique, concretely

- **Points, not meshes.** One `THREE.Points` + `BufferGeometry` with custom
  `ShaderMaterial` = **one draw call** for the entire cloud. Draw calls, not triangles,
  are what kill three.js scenes: the per-call CPU overhead is roughly constant whether it
  draws 10 triangles or 10,000, and 500+ calls/frame struggles on most hardware regardless
  of geometry. The existing engine already proves the instanced pattern on this codebase.
- **Scan reveal in the vertex/fragment shader, not in JS.** One `uScan` uniform (0→1) per
  beat; each point compares its own position against the sweep plane and lifts/colours
  itself. No per-point JS loop, no buffer re-upload per frame.
- **Store beats as attributes, not as state.** Give every point `aHome`, `aScatter` and
  `aZone`; interpolate in the shader on a progress uniform. This is exactly how the voxel
  forge already works, so the mental model and the review standard carry over.
- **Patrol path:** a `CatmullRomCurve3` sampled per frame for the drone marker; the sweep
  cone is a cheap additive quad oriented to the tangent, not a spotlight.
- **No postprocessing chain.** Bloom/DoF passes are the usual reason a hero misses LCP.
  Fake the glow with additive point sprites and a texture.

---

## 4 · The constraint everyone misses: this page already has three motion systems

Before adding anything, note what is already running on first view, per SPEC-009:

- the 65k-cube WebGL forge,
- a 2D ambient particle canvas (`js/modules/ambient.mjs`, `getContext('2d')`),
- a cursor spotlight.

So the honest framing is **not** "should we add WebGL" — the page is already a WebGL page.
It is "what is the total motion budget, and does a second scene earn its share?"

**Rules that follow:**

1. **One `WebGLRenderer`, one canvas.** Two contexts means two GPU allocations and two
   render loops on a page that is already the heaviest thing in the funnel. Swap scenes,
   or compose both into one scene graph and move the camera.
2. **Mutually exclusive by scroll.** Only one sequence may be animating at a time;
   `IntersectionObserver` pauses the other. The vavist budget guidance is blunt about
   this: a decorative loop that spins a laptop fan "feels careless."
3. **Dirty-flag the loop.** Render on change, not unconditionally:
   `if (visible && dirty) renderer.render(...)`. A static settled scene must cost nothing.
4. **Adaptive point count**, mirroring SPEC-009's adaptive cube count: derive from
   `hardwareConcurrency`, `devicePixelRatio` and viewport. The *site plan must still read
   as the site plan* at the lowest tier — that is the acceptance bar, not the number.
5. **DPR capped at 2**, 1 on phones. DPR above 2 is a review trigger on its own.

---

## 5 · Gates it must pass (all of these already exist)

| Gate | Source | Note |
|---|---|---|
| LCP ≤ 2.5s · CLS ≤ 0.1 · INP ≤ 200ms | SPEC-009 | CI fails below. A WebGL hero usually *is* the LCP element — one extra second pushes Core Web Vitals red. |
| ≤ 900 KB first view, ≤ 250 KB script | SPEC-009 | three.js r160 module is 1.27 MB raw — it is already deferred and must stay deferred. Nothing about the scene may block first paint. |
| Lighthouse ≥ 85 mobile, 3 runs median | SPEC-009 | measured against `python3 serve.py`, i.e. the committed artefact. |
| WCAG 2.1 AA | SPEC-008 / `docs/A11Y-AUDIT.md` | the scene is decorative: `aria-hidden`, never a focus trap, and every fact it conveys must also exist as text. |
| `prefers-reduced-motion` | existing engine behaviour | snap to the settled state, no loop at all. |
| CSP `script-src 'self'` | SPEC-006 | no CDN, no new origin, vendored only. |
| 300 LOC per file, no inline handlers/styles, `@layer` + `STYLE_ORDER` | invariants 7, code-standards | `logo-forge.js` is already 560 lines; a new scene is a **new module**, not an extension of that file. |
| Deterministic build | invariant 8 | no clock, no network at build time. |
| A test for every new behaviour | invariant 10 | `tests/*.test.mjs`. |

---

## 6 · What NOT to do

- **Do not add npm, React, or Spline.** Three separate invariants.
- **Do not hand-edit `index.html`.** Templates live in `src/templates/`; run
  `node build.mjs` and commit source + output together.
- **Do not patch `js/vendor/three.module.js`.** The hash is asserted in
  `tests/csp.test.mjs`; follow the upgrade recipe in `docs/RUNBOOK.md`.
- **Do not model a drone as the hero object.** Wrong story — he sells coverage, not
  aircraft — and a GLB plus textures is exactly the payload the budget cannot afford.
- **Do not put real client property geometry on a public page.** Use a synthetic site plan.
  Publishing a real protected perimeter is an operational-security problem, not a design
  decision. Flag to Cameron before any real address or layout appears.
- **Do not let the scene carry information that exists nowhere else.** It is `aria-hidden`
  decoration; the detection story must read in text for screen readers, for no-WebGL
  visitors and for Google.

---

## 7 · Proposed next step

A spec, not a branch: **SPEC-017 — perimeter scan sequence**, depending on SPEC-009
(budget must be measured and green *before* adding GPU work, same reasoning SPEC-009 used
to depend on SPEC-006/007). Sized M. Shape:

1. New module `js/perimeter.mjs` (< 300 LOC), sharing the renderer with `logo-forge.js`
   through a small `js/gl-context.mjs` owner.
2. Its own clock pair `--perimeter` / `--perimeter-settled`, published the same way.
3. Synthetic site-plan data in `src/data/` (invariant 5), not hardcoded in the module.
4. Adaptive point tiers + dirty-flag loop + IntersectionObserver mutual exclusion.
5. Static SVG fallback plate under `data-forge-fallback`, and a reduced-motion snap.
6. Tests: point-count tiering, clock monotonicity, fallback mount, and a Lighthouse run.

**Open questions for Cameron before speccing:**

- **Does a drone security operation need a Texas DPS private security licence** (Occupations
  Code Ch. 1702)? Unresolved, and it is a licensing exposure rather than a design question —
  it may gate the page going live at all. Counsel or the DPS Private Security Bureau.
- **Is he FAA Part 107 certificated, and who is the Remote Pilot in Command?** A new
  service with no case studies sells on credentials; the certificate number is the proof a
  prospect can actually verify. Without it there is no honest page.
- Which division leads the page — drone/aerial, or is drone one of seven? That decides
  whether this is *the* hero or a section.
- **What is genuinely true on day one:** fleet size, max sweep interval, altitude band,
  and the response path to a ground officer. Beat 4 is built from these, so every number
  must be real or the beat is cut.
- Which site types is he actually taking? Construction, acreage and private commercial are
  clean under § 423.002(a)(6); **events and industrial sites run into § 423.0045/.0046**
  and need specific authority before they are advertised.

## 8 · What a new service changes about the page

No track record means the page cannot borrow credibility from work already done, so it has
to manufacture it honestly from three things:

1. **Verifiable credentials over claims.** Part 107 certificate, DPS licence number,
   insurance, and the written-consent posture. A prospect who can check a number trusts
   faster than one who reads an adjective.
2. **Specificity about the mechanism**, since there are no results to show. Altitude, sweep
   cadence, what the camera can and cannot resolve, how fast a human responds. The
   drone-plus-officer handoff is the real differentiator against a camera vendor and
   against a guard-only competitor.
3. **A risk-reversal offer instead of a case study.** A free coverage assessment — a
   synthetic map of the prospect's own site with the patrol pattern drawn on it — is the
   lead magnet this service can actually deliver on day one, and it doubles as the first
   consent conversation.

**Explicitly out:** testimonials, "trusted by" logos, detection counts, and any implied
history. The WebGL scene is allowed to show *capability*; it is not allowed to imply
*experience* that does not exist yet.

---

## Sources

- Tuch, Presslaber, Stöcklin, Opwis, Bargas-Avila (2012), "The role of visual complexity
  and prototypicality regarding first impression of websites", *IJHCS*.
- Galletta, Henry, McCoy, Polak (2004), "Web Site Delays: How Tolerant are Users?",
  *JAIS* — delay tolerance is non-linear.
- utsubo.com/blog/best-threejs-websites-2026 — 2026 award cohort; WebGPU-with-fallback,
  one-hard-idea, scroll-as-storytelling.
- threejsroadmap.com/blog/draw-calls-the-silent-killer — draw-call overhead vs triangles.
- vavist.com/guides/three-js-performance-budget — budget-first, dirty-flag loop, DPR > 2
  as a review trigger.
- landerkit.fr/en/blog/hero-3d-webgl-landing-page-conversion — WebGL hero vs LCP.
- This repository: `context/architecture.md`, `context/ui-standards.md`,
  `specs/README.md`, `specs/SPEC-006`, `SPEC-008`, `SPEC-009`.
