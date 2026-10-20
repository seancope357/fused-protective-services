/* Unit tests for the Perimeter interaction math.
 *
 *   node --test prototypes/interact.test.mjs
 *
 * These run with no browser and no GPU, which is the point: a zone
 * misclassification is a logic bug and should fail here in milliseconds rather
 * than be hunted through pixel statistics later.
 *
 * The consent-boundary cases are the ones that matter. If a point beyond the
 * property line ever classifies as covered, the scene is making a claim the
 * business is not allowed to make (Tex. Gov't Code 423.003 / 423.002(a)(6)).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLAN, ZONE, ZONE_LABEL, classify, isCovered, groundHit, clampOrbit, approach,
} from './interact.mjs';

test('classify: inside the fence is covered', () => {
  assert.equal(classify(0, 0), ZONE.STRUCTURE);      // building footprint
  assert.equal(classify(8, 0), ZONE.DRIVE);          // access drive
  assert.equal(classify(-11, 6), ZONE.GROUND);       // open ground
});

test('classify: the fence rectangle edge reads as the boundary line', () => {
  assert.equal(classify(-14, 0), ZONE.FENCE);
  assert.equal(classify(14, 0), ZONE.FENCE);
  assert.equal(classify(0, 9), ZONE.FENCE);
  assert.equal(classify(0, -9), ZONE.FENCE);
});

test('CONSENT BOUNDARY: anything beyond the fence is never covered', () => {
  const outside = [
    [15, 0], [-15, 0], [0, 10], [0, -10], [30, 30], [-24, 16], [14.7, 8.9],
  ];
  for (const [x, z] of outside) {
    const z0 = classify(x, z);
    assert.equal(z0, ZONE.OUTSIDE, `(${x},${z}) should be OUTSIDE, got ${z0}`);
    assert.equal(isCovered(z0), false, `(${x},${z}) must not be covered`);
  }
});

test('CONSENT BOUNDARY: no gap between the fence line and outside', () => {
  // Walk across the boundary in 5 cm steps; every sample must be either a
  // covered zone (inside) or OUTSIDE — never undefined, never a hole.
  for (let x = 13.0; x <= 15.0; x += 0.05) {
    const z = classify(x, 0);
    assert.ok(Object.values(ZONE).includes(z), `no classification at x=${x}`);
    if (x > PLAN.fence.maxX) assert.equal(z, ZONE.OUTSIDE, `leaked coverage at x=${x}`);
  }
});

test('every zone has a label, and only the outside one says not scanned', () => {
  for (const z of Object.values(ZONE)) {
    assert.equal(typeof ZONE_LABEL[z], 'string');
    assert.ok(ZONE_LABEL[z].length > 0);
  }
  assert.match(ZONE_LABEL[ZONE.OUTSIDE], /not scanned/i);
  for (const z of [ZONE.GROUND, ZONE.STRUCTURE, ZONE.DRIVE, ZONE.FENCE]) {
    assert.doesNotMatch(ZONE_LABEL[z], /not scanned/i);
  }
});

const CAM = { fovDeg: 42, aspect: 16 / 9, pitch: -0.5, yaw: 0, position: { x: 0, y: 20, z: 26 } };

test('groundHit: screen centre lands in front of the camera on the ground', () => {
  const hit = groundHit({ x: 0, y: 0 }, CAM);
  assert.ok(hit, 'centre ray should meet the ground');
  assert.ok(Math.abs(hit.x) < 1e-9, `centre should not drift in x, got ${hit.x}`);
  assert.ok(hit.z < CAM.position.z, 'hit should be in front of the camera');
});

test('groundHit: moving the pointer right moves the hit right', () => {
  const l = groundHit({ x: -0.5, y: 0 }, CAM);
  const r = groundHit({ x: 0.5, y: 0 }, CAM);
  assert.ok(l && r);
  assert.ok(r.x > l.x, `expected rightward motion, got ${l.x} -> ${r.x}`);
});

test('groundHit: returns null when the ray cannot reach the ground', () => {
  const up = { ...CAM, pitch: 0.5 };            // camera tilted upward
  assert.equal(groundHit({ x: 0, y: 0.9 }, up), null);
  const flat = { ...CAM, pitch: 0 };            // ray parallel to the ground
  assert.equal(groundHit({ x: 0, y: 0 }, flat), null);
});

test('clampOrbit: cannot be flipped, mirrored or tipped under the ground', () => {
  const a = clampOrbit(99, 99);
  assert.ok(a.yaw <= 0.42 && a.pitch <= -0.32, JSON.stringify(a));
  const b = clampOrbit(-99, -99);
  assert.ok(b.yaw >= -0.42 && b.pitch >= -1.15, JSON.stringify(b));
  const c = clampOrbit(0.1, -0.6);
  assert.equal(c.yaw, 0.1);
  assert.equal(c.pitch, -0.6);
});

test('approach: converges and never overshoots', () => {
  let v = 0;
  for (let i = 0; i < 400; i++) v = approach(v, 1, 0.12);
  assert.ok(v > 0.999 && v <= 1, `expected convergence to 1, got ${v}`);
  let w = 1;
  for (let i = 0; i < 400; i++) w = approach(w, 0, 0.12);
  assert.ok(w < 0.001 && w >= 0, `expected convergence to 0, got ${w}`);
});
