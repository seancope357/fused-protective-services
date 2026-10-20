# Aerial scene lifecycle

The public scene defaults to **Day**. The only viewing controls are **Day** and **Night**,
with explicit pressed states. The visitor's selection survives native scroll, reduced-motion
changes, required-asset failure and Retry. Sensor overlay, pause and inspection UI were removed
at Sean's request on 2026-10-20; scroll still drives the authored aircraft-to-property journey.

`world.mjs` composes original batched architecture (`property.mjs`), rolling terrain and instanced
vegetation/landscaping. Windows are real openings with separate glass and room geometry. The main
pavilion and service wing are separated rather than sharing overlapping facade faces. Paving joints
use derivative-filtered shading instead of subpixel, nearly coplanar geometry. Finishes have original
world-space color/roughness/normal variation; no external texture dependency is introduced.
Trees combine irregular inner crowns and mipmapped leaf sprays with MSAA alpha-to-coverage. Local
planting, limestone outcrops and grass tufts are instanced. Heights follow the terrain while the
property footprint remains level.

`lighting.mjs` changes the sky, fog, ambient/sun/moon illumination, exposure and real warm building/
approach fixtures together. Static world shadows update when modes change, not on every rotor frame.
The aircraft does not cast a frozen shadow into the cached map. Desktop shadow maps are 4096;
phone/coarse-pointer maps 2048. DPR caps are 2 and 1.75 respectively, replacing the old phone DPR 1.

`boot.mjs` handles synchronous inputs and elapsed-time camera convergence. Reduced motion fixes the
camera and authored rotor pose but allows Day/Night choices. Hidden tabs cancel RAF; visibility
restoration resets the timestamp. Context loss stops rendering and reveals Retry. Retry replaces
the canvas and disposes the old scene. Pagehide invalidates pending loads; BFCache restoration reloads.

Aircraft primitives retain complete world matrices, material/texture references, normals, tangents
and UVs through batching/rotor preparation. Required aircraft/image failure is fatal. Optional HDR
failure leaves the original PMREM studio lighting and reports `studio-fallback` honestly. Resources
are disposed on teardown, including shader maps, instance geometry and cached shadow targets.

With `?verify=1`, `window.__aerial` exposes synchronous `setProgress(u)`, `setTimeOfDay('day'|'night')`,
`render()`, `stats()` and `context`. No QA global or preserved drawing buffer exists on normal URLs.
Stats include lighting choice, shadow-map size, property geometry, draw calls and normalized aircraft.

Validate with `node build.mjs --check`, `node --test 'tests/*.test.mjs'` and
`scripts/verify-aerial.mjs` against `python3 serve.py`. The browser harness covers both lighting modes,
rendered pixels, keyboard/touch, mobile DPR, reduced motion, native scrolling, load/context failure,
Retry, resource bytes and actual draw counts. Physical-device GPU acceptance remains separate.
