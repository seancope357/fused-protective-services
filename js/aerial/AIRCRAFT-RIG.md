# Local aircraft rig evidence — 2026-10-19

Scope: only `aircraft.mjs`, `tests/aerial-aircraft.test.mjs`, and this note.
Scene/controller integration and browser acceptance remain controller-owned.
Source ownership is unresolved: local evaluation only; no redistribution clearance.

## Inspected source

`assets/aerial/aircraft.glb` SHA-256:
`ec73c4f95dbdd821bce151a95cc6813e6853dd18a2581c069ebf80b785df6cf4`.
Offline GLTFLoader inspection used the registered Three ESM loader and removed
textures only from an in-memory GLB copy. The disk asset was not changed.
458 nodes, 147 mesh primitives, 127,011 triangles. World AABB:
`[-0.174183925, 0, -0.175]` → `[0.174183925, 0.085779161, 0.175]`.

The actual materials are `jishen` (base colour, metal/roughness, normal, AO maps)
and alpha-BLEND `glass` (base colour and normal maps, roughness 0.00392157).
Both materials and every texture reference are retained unchanged. No recoat,
transmission pass, environment render, image rewrite, or glass guesswork.

## Anatomy proof (original world coordinates)

Each rotor consists of two separately meshed long, narrow blades on opposite sides
of a compact motor assembly. Repeated left/right pairs establish four centres.
No arm, motor casing, shaft or unknown hub part is rotated. Mesh parents are
identity transforms; accumulated world transforms have scale approximately
0.007983361, with tilt baked into geometry, **not** a useful parent rotation.
Thus local Y or a bounding-box centre alone would give an incorrect rotor axis.
Stacked circular motor-ring centres establish the shaft line; paired attachment
centres establish the blade plane. Pivot is their midpoint projected onto that line.
Radius is the maximum perpendicular vertex distance from the shaft, not a box diagonal.

| Blade nodes (`Object_`) | Ring evidence | Attachment evidence | Pivot x, y, z | Unit axis x, y, z | Radius |
| --- | --- | --- | --- | --- | --- |
| 88, 91 | 67, 70 | 76, 79 | .103134082, .048346669, .108447299 | .144227, .989279, -.022910 | .095352492 |
| 117, 120 | 99, 102 | 108, 111 | -.129652011, .053829415, -.084960471 | -.128808, .991554, -.015119 | .095350749 |
| 152, 155 | 134, 131 | 140, 143 | -.103133997, .048304195, .108448501 | -.144210, .989282, -.022901 | .095352636 |
| 172, 178 | 184, 163 | 166, 169 | .129633850, .053736918, -.084958954 | .128808, .991554, -.015125 | .095350695 |

Blade triangle counts are 676+680, 788+788, 680+676, 788+788 (5,864 total).
Maximum attachment-plane error is 0.000010452; maximum paired-radius mismatch
is 0.000018281. Diagonally opposite rotors share a direction; adjacent rotors
counter-rotate. These are balanced visualization directions, not certified motor
handedness or measured RPM. Runtime recognition requires this asset's mesh/triangle
counts, named evidence, blade counts/material, plane and radius consistency.
Unrecognized/incomplete anatomy falls back to an intact static batch with zero rotors.

## Rendering and ownership

Resting output preserves original world AABB, all 127,011 triangles and all attributes
(including reflected winding/tangent handedness via existing `batchStatic`). Body:
121,147 triangles in two batches; blades: four independently pivoted batches.
Motion uses four low-opacity, single-pass, depth-tested annular exposure surfaces,
512 procedural triangles total, aligned to measured axes/radii. Real blade geometry
is retained and its phase calculated, but hidden during motion to avoid strobing.
Reduced motion or time zero restores the exact authored pose and removes blur meshes
from the group, so even Box3 traversal cannot include hidden enlarged disc bounds.
Normalize **before** the first moving update; a moving swept volume naturally differs
from the resting blade AABB. No banking or whole-aircraft stabilization in this module.

Six aircraft main-pass draws in either mode: +4 versus the previous two. Relative
to the supplied 13-draw full-scene baseline, expected total is 17, not GPU-measured.
Blur opacity/appearance and actual main/shadow pass counts still need browser review.
No claim of FPS, operational capabilities, or photographic accuracy.

`prepareAircraft` consumes source meshes/geometries as `batchStatic` does. Do not
reuse or batch the source afterward. Artist materials/maps stay controller-owned.
`dispose()` is idempotent and frees output geometry plus the procedural blur material,
including detached discs. Dispose artist materials/maps once through the controller's
shared-resource cleanup; avoid separately disposing rig geometry a second time.

## Exact integration example (not wired here)

```js
import { prepareAircraft } from './aircraft.mjs';

// After GLTFLoader completion and existing shadow/material setup:
const box = new THREE.Box3().setFromObject(gltf.scene);
const center = box.getCenter(new THREE.Vector3());
const size = box.getSize(new THREE.Vector3());
const rig = prepareAircraft(gltf.scene); // replaces batchStatic(gltf.scene)
const normalized = new THREE.Group();
normalized.add(rig.object);
rig.object.position.sub(center);
normalized.scale.setScalar(aircraftSpan / Math.max(size.x, size.y, size.z));
aircraft.add(normalized); // existing aircraft parent owns placement/stabilization

// Every render, use the existing pause-aware elapsed clock, never wall time:
rig.update(time, reducedMotion);
const aircraftStats = rig.stats();
// Teardown: rig.dispose(); controller separately disposes shared artist materials/maps.
```

Validation: test-first missing-module RED (3 failures), then GREEN; final focused
suite covers source geometry/attribute totals and bounds, motor evidence, disc planes,
absolute-time determinism, pause, reduced pose, unknown-asset fallback, map identity,
and detached-resource cleanup. `node --test tests/aerial-aircraft.test.mjs` passes 4/4.
Final `node --test tests/*.test.mjs`: **138 passed, 4 failed**. All four failures
are existing camera tests in `tests/aerial.test.mjs`, raising `ReferenceError: keys
is not defined` at controller-owned `js/aerial/state.mjs:21` after concurrent edits.
An earlier full run passed 141/141 before the additional cleanup test and those edits.
No controller code or legacy tests were changed by this unit. Both
`node build.mjs --check` and `node build.mjs --aerial-preview --check` pass;
syntax checks for both new modules and `git diff --check` pass.
Runtime available here is Node 24.14.0;
tests register the supplied loader before dynamic vendor imports for Node 20
compatibility, but a separate Node 20 execution was not performed.
No server, browser, install, Git publication, deployment, or asset download performed.
Shared context/progress files deliberately untouched under the three-file ownership rule.
