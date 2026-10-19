# Fused Aerial — cinematic interactive landing experience

Date: 2026-10-14
Status: creative direction approved; written design awaiting Sean's review.
Environment: LOCAL / DEV. No deployment, public navigation change, or production mutation is authorized.

## 1. Intent and success

Sean's purpose for this session is a truly stunning, ultra-realistic, interactive
WebGL / three.js landing experience for Fused's additional drone service. This is
visual experience work, not another service card or a copywriting pass.

Approved creative direction: a blue-hour physical world transitions into an
illustrative sensor visualization, then returns to the physical scene. A detailed
aircraft, believable property, continuous camera choreography, and restrained
Fused black-and-gold interface are the core of the experience.

Working audience: property owners considering premium security. The experience
explains aerial coverage and provides a path to the existing service inquiry.
These audience/conversion assumptions must not displace the visual priority.

Success means a working local landing page with convincing rendered materials,
lighting, scale, motion, and interactions. A running renderer, particle count,
model polygon count, or screenshot alone cannot establish visual quality.
Sean approves the visual result; automated evidence establishes functionality,
rendering continuity, and measured performance.

## 2. Scope and alternatives

Chosen: a dedicated, locally previewed landing page using the existing vendored
three.js r160. One renderer owns the entire experience. It does not boot the
homepage's logo forge or ambient canvas.

Rejected as the main experience: extending the sparse point-cloud prototype.
It is useful concept research, but a sensor display is not physical realism.
Rejected: a prerendered movie masquerading as interactive WebGL. Still images
may provide fallbacks, but the principal aircraft, environment, camera and view
transition must be rendered and interactive in three.js.

In: detailed aircraft, synthetic commercial property, blue-hour lighting,
scroll-directed camera, bounded inspection controls, illustrative sensor mode,
responsive landing layout, accessible alternatives, functional inquiry link,
asset provenance and browser evidence.

Out: homepage replacement, changing division/intake contracts, new backend or
form submission, authentic operational telemetry, service-performance promises,
real client property, live surveillance, audio autoplay, deployment, and paid
asset purchases without separate approval.

## 3. Art direction and asset gate

Use the existing Outfit / Cinzel / JetBrains Mono font assets and Fused tokens.
Physical surfaces use plausible composite, metal, glass, concrete and vegetation
materials; brand gold is reserved for the interface and coverage visualization.
The site must read as a premium security service, not a game or fabricated
command dashboard. Keep text sparse and readable over scene-specific scrims.

The aircraft requires a properly licensed, inspectable, detailed mesh with
credible silhouette, propellers, motors, camera gimbal and landing hardware.
Use PBR materials, coherent roughness, reflection lighting and texture scale.
A generic illustrative aircraft must not be labelled as Fused's actual fleet.
Do not invent an aircraft specification or imply manufacturer endorsement.

No aircraft GLB/glTF asset was found under assets/ during design reconnaissance.
Acquiring or authoring the main aircraft is therefore a real dependency, not a
completed task. Before scene implementation, select a redistribution-permitted
asset or original authored model, inspect its geometry/materials, and record its
source, author, exact licence, attribution and any modifications. Do the same
for environment maps and textures. No search-result licence inference.
If a suitable free asset cannot be obtained, report the gap and request a
specific asset decision; do not quietly substitute a primitive toy drone and
call the result ultra-realistic.

The environment is a fictional, plausibly scaled commercial property, with a
building, access drive, fence, terrain and planted edges. Repeat geometry with
instancing. Ground contact, shadow direction, atmospheric distance and material
variation matter more than adding arbitrary objects. Use a licensed environment
map processed with PMREM, a controlled key light and restrained distance haze.
Avoid gratuitous bloom and expensive full-screen effects in the initial slice.

## 4. Experience choreography

### Opening — aircraft presence

An editorial composition places a close, readable aircraft against the blue-hour
property. Light reveals its construction and camera. There is useful HTML copy
and a static visual immediately; a progress indicator reports actual asset
loading, never an artificial wait. No blank canvas intro or scroll lock.

### Traverse — reveal the world

Native scrolling drives a continuous camera path from the aircraft to an oblique
property overview. Camera and look target are authored together, with eased,
frame-rate-independent convergence. Avoid clipping through geometry or extreme
wide-angle distortion. Hovering, rotor motion and gimbal movement remain subtle
and plausible. A pause control stops autonomous motion.

### Inspect — visitor control

A labelled Inspect control enters a bounded aircraft inspection state. Pointer
drag rotates within safe angular limits; keyboard buttons offer equivalent
rotation and reset. Pointer movement outside inspection adds only small depth
response on fine-pointer devices. Wheel/touch scrolling remains page scrolling;
no unannounced zoom capture. Escape exits inspection and restores the current
scroll composition. Touch inspection requires an explicit opt-in.

### Reveal — physical world to sensor view

A two-state labelled control switches Cinematic / Sensor. Both show the same
property geometry and camera. A continuous shader transition reveals a scanning
surface and coverage boundary, rather than swapping to a disconnected graphic.
Only the synthetic authorized parcel receives the coverage effect. Occlusion
must not imply impossible see-through detection capabilities.

Sensor mode permanently labels itself Illustrative visualization. No invented
incident markers, timestamps, temperature readings, flight altitude, sweep
cadence, certifications, response guarantees or live-feed badges.

### Resolve — return to Fused

The final camera composition holds the property and aircraft with a restrained
service explanation and inquiry link. The link uses the existing canonical
site/quote target from src/data rather than inventing a new intake value. The
local preview does not submit a lead or claim a booking succeeded.

## 5. Architecture and state ownership

All page sources remain in src/. Register an opt-in aerial-preview build target
in build.mjs that writes prototypes/aerial/index.html and its stylesheet without
changing existing default page output. Do not hand-edit generated files. The
preview is noindex, unlinked from public navigation, and is not deployed in this
work session. Local files under prototypes/ are not intrinsically private;
shipping any preview path needs a later explicit deployment review.

Expected implementation boundaries:
- src/data/aerial.mjs: editorial copy, synthetic site description, asset manifest,
  choreography and quality-tier configuration; business facts reuse site.mjs.
- src/templates/aerial/: page shell, semantic controls, accessible explanation.
- src/styles/components/aerial-*.css: scoped responsive presentation using existing
  tokens and explicit layers/order; no global brand or portal stylesheet rewrite.
- js/aerial/: boot/lifecycle, scene assembly, aircraft/world, camera path,
  sensor materials and interaction modules, each with one responsibility.
- assets/aerial/: licensed models/textures/environment map, fallback poster and
  provenance manifest with exact pinned asset identities.
- tests/aerial-*.test.mjs plus a pinned browser QA harness: state, build, rendering
  and interaction proof; verification output stored separately from source.
- build.mjs: only the additive preview target and necessary style registration.

Use vanilla modules and self-hosted assets, no root package.json or CDN. If a
GLTF loader is needed, vendor the exact r160 loader and its required modules with
licence/provenance; resolve its imports locally without an inline import map or
loosening CSP. Do not patch the existing vendored three.module.js.

One lifecycle owner loads assets, creates renderer/scene and tears them down.
One state model owns scroll target, settled camera, inspection angles, view mode,
motion pause, visibility, quality tier and loading/failure state. DOM controls
and render uniforms derive from that state. Shader variants reuse geometry.
The renderer pauses when hidden/offscreen and releases owned resources on
teardown. Context loss and loading failure immediately expose the static scene
and HTML explanation with a truthful retry/status path.

## 6. Responsive behaviour and performance

Compose the camera and text separately for portrait and landscape; do not just
crop a desktop view. Native touch scroll must work at 320, 375, 414 and 768px;
also test desktop at 1440px. Controls have at least 44px hit areas.

Reduced-motion mode starts at a stable composition, removes scroll camera travel,
parallax, rotor/hover loops and spatial view transitions, and preserves explicit
view/inspection access without automatic motion. No-WebGL and failed-assets
states retain a useful static poster, complete explanation and inquiry link.

Initial proposed delivery budgets for this dedicated preview (targets, not
measurements): critical HTML/CSS/poster <= 900 KB transferred; deferred scene
assets <= 8 MB transferred; desktop <= 500k visible triangles and <= 100 draw
calls; mobile low tier <= 100k visible triangles and <= 60 draw calls. DPR caps
are 2 desktop and 1 phone. Measure actual transfer/compression and render cost;
counting local raw bytes is not transfer proof. Use texture/mesh quality tiers
and delta-time clamping. No expensive decoding dependency is added implicitly.

Targets: desktop median frame time <= 16.7ms and p95 <= 25ms over a reproducible
20-second active walkthrough; mobile target median <= 33.3ms and p95 <= 50ms on
real mobile hardware. Identify browser, GPU/backend, viewport, DPR and workload.
Desktop viewport emulation is responsive proof, not phone GPU performance proof.
If real mobile hardware is unavailable, explicitly report that target unverified.

The earlier research says SPEC-009 budgets already fail CI. specs/README.md
instead marks SPEC-009 recommended-cut/unimplemented. Do not claim a performance
gate is armed or green without inspecting and exercising the actual CI target.

## 7. Verification and acceptance

1. A real browser loads the dedicated page under serve.py's existing CSP with no
   missing requests, shader errors, page errors or CSP violations.
2. The aircraft asset, PBR maps and environment lighting actually render. Capture
   close-up, overview, midpoint sensor transition and final composition. Inspect
   actual frames for silhouette, textures, exposure, ground contact and clipping;
   present them to Sean. Numeric pixel checks supplement, not replace, review.
3. Native scrolling moves through the authored scene forward and backward without
   jumps, blank/frozen sections, invalid camera matrices or hidden stuck content.
4. Inspect, keyboard rotate/reset, Escape, Cinematic/Sensor and pause controls
   perform the stated actions; pointer/touch does not hijack page scrolling.
5. The sensor transition changes the real rendered world. Image comparisons and
   render state confirm this is not merely a changing UI label. Synthetic coverage
   remains inside the specified parcel; the illustration label remains visible.
6. Responsive screenshots and DOM measurements show no horizontal overflow or
   clipped controls at every named viewport. Keyboard focus and touch targets are
   checked; reduced-motion and forced no-WebGL/context-loss paths are exercised.
7. Record network bytes, geometry, draw calls and real frame-time samples with
   hardware/browser context. Report every missed or unverified budget honestly.
8. The inquiry link resolves to the existing form; no test submits a live inquiry.
9. Two successive preview builds are byte-identical; the existing default build
   check and static/API test suite remain green. No root dependency manifest,
   production config weakening, business-data drift or homepage change is present.
10. Asset provenance is complete and the licensed files can be redistributed.

## 8. Rollback and handoff boundary

This design stage creates only this document. Implementation must be isolated
from the existing SPEC-016 licence work and preserve the untracked research and
original perimeter prototype. No file deletion is planned.

The local experience is reversible by stopping its preview server and leaving
the current public site unchanged. Future integration must be a separately
reviewed, small commit series; a production rollout and its rollback require
explicit operator approval. No push to main is authorized here.

Next gate: Sean reviews this written design. After approval, write the
implementation plan with asset acquisition first, a rendered vertical slice
second, then full choreography and verification. Select the execution method
when reviewing that plan; creative-direction approval alone is not approval to
skip the written-design and implementation-plan gates.
