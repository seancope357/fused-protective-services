/* interact.mjs — pure interaction math for the Perimeter scene.
 *
 * Deliberately free of three.js and of the DOM: every function here is a plain
 * transform, so the whole interaction model is unit-testable in `node --test`
 * with no browser and no GPU. Rendering stays in perimeter.mjs.
 *
 * The plan geometry is declared ONCE here and imported by the scene, so the
 * points you see and the zone you hover can never disagree.
 */

/* The synthetic site plan. Single source of truth for both the point sampler
 * and the hover classifier. Metres, origin at the yard centre. */
export const PLAN = {
  fence: { minX: -14, maxX: 14, minZ: -9, maxZ: 9 },
  building: { minX: -7, maxX: 1, minZ: -4, maxZ: 4 },
  drive: { minX: 2, maxX: 14, minZ: -1.4, maxZ: 1.4 },
};

export const ZONE = {
  OUTSIDE: 0,
  GROUND: 1,
  STRUCTURE: 2,
  DRIVE: 3,
  FENCE: 4,
};

/* Human-readable, and the ONLY place this copy lives. The DOM readout imports
 * these so the visible label and the classified zone cannot drift apart. */
export const ZONE_LABEL = {
  [ZONE.OUTSIDE]: 'Beyond property line — not scanned',
  [ZONE.GROUND]: 'Open ground — swept',
  [ZONE.STRUCTURE]: 'Structure — swept',
  [ZONE.DRIVE]: 'Access drive — swept',
  [ZONE.FENCE]: 'Boundary line — swept',
};

function inBox(x, z, b) {
  return x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;
}

/**
 * Classify a point on the ground plane.
 *
 * Order matters: structure and drive sit INSIDE the fence, so they must be
 * tested before the generic inside-the-fence case. Anything outside the fence
 * is ZONE.OUTSIDE and must never be treated as covered — that is the consent
 * boundary, not a styling decision.
 */
export function classify(x, z, plan = PLAN) {
  const f = plan.fence;
  if (!inBox(x, z, f)) return ZONE.OUTSIDE;
  // within `tol` of the fence rectangle's edge reads as the boundary line
  const tol = 0.6;
  const nearEdge = Math.min(
    Math.abs(x - f.minX), Math.abs(x - f.maxX),
    Math.abs(z - f.minZ), Math.abs(z - f.maxZ),
  ) <= tol;
  if (nearEdge) return ZONE.FENCE;
  if (inBox(x, z, plan.building)) return ZONE.STRUCTURE;
  if (inBox(x, z, plan.drive)) return ZONE.DRIVE;
  return ZONE.GROUND;
}

/** True when a zone is inside the consent boundary and therefore scannable. */
export function isCovered(zone) {
  return zone !== ZONE.OUTSIDE;
}

/**
 * Where does the ray through a normalised pointer position meet the ground?
 *
 * ndc: {x, y} each in -1..1 (y up, as WebGL expects).
 * Returns null when the ray is parallel to, or points away from, the ground —
 * the caller must treat null as "no hover" rather than clamping, or the
 * highlight sticks to the horizon.
 */
export function groundHit(ndc, camera) {
  // Build a direction in view space from the camera's vertical FOV and aspect,
  // then rotate it by the camera's yaw/pitch. Written out rather than using
  // three.js unproject so this file stays dependency-free and testable.
  const tanHalf = Math.tan((camera.fovDeg * Math.PI) / 360);
  const vx = ndc.x * tanHalf * camera.aspect;
  const vy = ndc.y * tanHalf;
  const vz = -1;

  const { pitch, yaw } = camera;
  // rotate X (pitch) then Y (yaw)
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const y1 = vy * cp - vz * sp;
  const z1 = vy * sp + vz * cp;
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const dx = vx * cy + z1 * sy;
  const dz = -vx * sy + z1 * cy;
  const dy = y1;

  if (Math.abs(dy) < 1e-6) return null;
  const t = -camera.position.y / dy;
  if (t <= 0) return null;
  return {
    x: camera.position.x + dx * t,
    z: camera.position.z + dz * t,
  };
}

/**
 * Clamp a pointer-driven orbit so the scene can never be flipped, mirrored or
 * tipped under the ground. Interactive, but not a toy — a marketing scene that
 * can be left upside down looks broken, not playful.
 */
export function clampOrbit(yaw, pitch, limits = {}) {
  const maxYaw = limits.maxYaw ?? 0.42;      // ~24 degrees either side
  const minPitch = limits.minPitch ?? -1.15; // looking down
  const maxPitch = limits.maxPitch ?? -0.32;
  return {
    yaw: Math.max(-maxYaw, Math.min(maxYaw, yaw)),
    pitch: Math.max(minPitch, Math.min(maxPitch, pitch)),
  };
}

/** Critically-damped-ish approach used for every smoothed value in the scene. */
export function approach(current, target, rate = 0.12) {
  return current + (target - current) * rate;
}
