/* drone.mjs — a fully modelled quadcopter, built procedurally.
 *
 * NO GLB, NO EXTERNAL ASSET. Every part is three.js primitive geometry
 * generated at runtime, so the whole aircraft costs zero network bytes and
 * cannot blow the ≤250 KB script budget in SPEC-009. That is the entire reason
 * this is code and not a model file — it is not a compromise on fidelity.
 *
 * Parts: fuselage, canopy, four booms, four motor nacelles, four spinning
 * rotors (blades + blur disc), a gimbal camera that always aims at its target,
 * landing skids, and navigation lights (port red / starboard green, plus a
 * white strobe) that actually blink to a realistic cadence.
 *
 * Flight model: the airframe banks into turns and pitches into acceleration,
 * the way a real multirotor must in order to translate. A drone that slides
 * flat across the sky reads as a sprite; the bank is what sells it as an
 * aircraft.
 */

import * as THREE from '../js/vendor/three.module.js';

const CARBON = 0x15171a;
const CARBON_LIT = 0x23262b;
const GOLD = 0xc6a25c;
const GOLD_BRIGHT = 0xf7e5b2;
const GLASS = 0x0a0d10;

const ARM = 0.62;        // boom length from centre
const ROTOR_R = 0.34;

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color, metalness: opts.metalness ?? 0.65, roughness: opts.roughness ?? 0.42,
    emissive: opts.emissive ?? 0x000000, emissiveIntensity: opts.emissiveIntensity ?? 1,
    transparent: opts.transparent ?? false, opacity: opts.opacity ?? 1,
    depthWrite: opts.depthWrite ?? true,
  });
}

/** One rotor assembly: hub, two blades, and a translucent blur disc. */
function buildRotor(materials) {
  const g = new THREE.Group();

  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.09, 0.11, 12), materials.motor);
  g.add(hub);

  // Two tapered blades. BoxGeometry scaled along x gives a convincing blade at
  // a fraction of the vertices of a lathe or extrusion.
  for (let i = 0; i < 2; i++) {
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(ROTOR_R * 2, 0.012, 0.062), materials.blade);
    blade.rotation.y = i * Math.PI;
    blade.position.y = 0.072;
    // a touch of pitch on the blade, like a real prop
    blade.rotation.z = 0.14;
    g.add(blade);
  }

  // Motion blur disc — switched on only while spinning fast. This is the trick
  // that makes 30fps rotors read as fast rather than strobing backwards.
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(ROTOR_R, 24),
    new THREE.MeshBasicMaterial({ color: 0x9fb0c0, transparent: true, opacity: 0.1,
                                  side: THREE.DoubleSide, depthWrite: false }));
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.075;
  disc.name = 'blur';
  g.add(disc);

  return g;
}

export function buildDrone() {
  const root = new THREE.Group();
  const airframe = new THREE.Group();   // everything that banks
  root.add(airframe);

  const materials = {
    body: mat(CARBON, { metalness: 0.5, roughness: 0.5 }),
    panel: mat(CARBON_LIT, { metalness: 0.7, roughness: 0.35 }),
    gold: mat(GOLD, { metalness: 0.95, roughness: 0.22 }),
    motor: mat(0x2b2f35, { metalness: 0.85, roughness: 0.3 }),
    blade: mat(0x3a4048, { metalness: 0.4, roughness: 0.6 }),
    glass: mat(GLASS, { metalness: 0.2, roughness: 0.08 }),
  };

  // --- fuselage: a stretched, bevelled body -------------------------------
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.15, 0.72), materials.body);
  airframe.add(body);

  // bevel strip along the waist, in brand gold — reads at small scale
  const waist = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.022, 0.74), materials.gold);
  waist.position.y = 0.012;
  airframe.add(waist);

  // canopy / sensor hood, angled forward
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.11, 0.26), materials.glass);
  canopy.position.set(0, 0.10, -0.18);
  canopy.rotation.x = -0.22;
  airframe.add(canopy);

  // --- booms and motors ----------------------------------------------------
  const rotors = [];
  const diag = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
  diag.forEach(([sx, sz], i) => {
    const boom = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.045, ARM * 1.32, 8), materials.panel);
    boom.rotation.z = Math.PI / 2;
    boom.rotation.y = Math.atan2(sz, sx);
    boom.position.set(sx * ARM * 0.46, 0, sz * ARM * 0.46);
    airframe.add(boom);

    const nacelle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.085, 0.13, 10), materials.motor);
    nacelle.position.set(sx * ARM, 0.02, sz * ARM);
    airframe.add(nacelle);

    const rotor = buildRotor(materials);
    rotor.position.set(sx * ARM, 0.09, sz * ARM);
    // counter-rotating pairs, like a real quad
    rotor.userData.dir = (i % 2 === 0) ? 1 : -1;
    airframe.add(rotor);
    rotors.push(rotor);
  });

  // --- landing skids -------------------------------------------------------
  [-1, 1].forEach((s) => {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.018, 0.5), materials.panel);
    skid.position.set(s * 0.19, -0.14, 0.02);
    airframe.add(skid);
    [-0.16, 0.16].forEach((z) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.12, 0.028), materials.panel);
      leg.position.set(s * 0.19, -0.08, z);
      airframe.add(leg);
    });
  });

  // --- gimbal camera: a yoke plus a ball that aims independently ----------
  const gimbalYoke = new THREE.Mesh(
    new THREE.TorusGeometry(0.075, 0.012, 6, 16), materials.panel);
  gimbalYoke.position.set(0, -0.12, -0.2);
  gimbalYoke.rotation.y = Math.PI / 2;
  airframe.add(gimbalYoke);

  const gimbal = new THREE.Group();
  gimbal.position.set(0, -0.14, -0.2);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.062, 14, 12), materials.body);
  gimbal.add(ball);
  const lens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.034, 0.038, 0.045, 14), materials.glass);
  lens.rotation.x = Math.PI / 2;
  lens.position.z = -0.055;
  gimbal.add(lens);
  const lensRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.038, 0.007, 6, 16), materials.gold);
  lensRing.position.z = -0.072;
  gimbal.add(lensRing);
  airframe.add(gimbal);

  // --- navigation lights ---------------------------------------------------
  function navLight(color, x, z) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 8, 8),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 }));
    m.position.set(x, -0.02, z);
    airframe.add(m);
    return m;
  }
  const lights = {
    port: navLight(0xff3b30, -ARM, -ARM * 0.2),       // red, left
    starboard: navLight(0x30d158, ARM, -ARM * 0.2),   // green, right
    strobe: navLight(0xffffff, 0, 0.3),               // white tail strobe
  };

  // A faint gold key light travelling with the aircraft so it reads against the
  // dark plan without needing a scene-wide light rig.
  const keyLight = new THREE.PointLight(GOLD_BRIGHT, 1.4, 6, 2);
  keyLight.position.set(0, 0.6, 0);
  root.add(keyLight);

  root.userData = { airframe, rotors, gimbal, lights, keyLight };
  return root;
}

/**
 * Advance the aircraft.
 *
 * state: { position:{x,y,z}, velocity:{x,z}, target:{x,z}|null, spin:0..1, t }
 * The bank/pitch are derived from velocity rather than authored, so the
 * aircraft is always leaning the way its motion requires.
 */
export function updateDrone(drone, state) {
  const { airframe, rotors, gimbal, lights } = drone.userData;
  const { position, velocity, target, spin = 1, t = 0 } = state;

  drone.position.set(position.x, position.y, position.z);

  // face the direction of travel (yaw), ignoring near-zero motion
  const speed = Math.hypot(velocity.x, velocity.z);
  if (speed > 0.0005) {
    const yaw = Math.atan2(velocity.x, velocity.z);
    // shortest-path yaw interpolation
    let d = yaw - airframe.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    airframe.rotation.y += d * 0.12;
  }

  // bank into the turn, pitch into acceleration — clamped so it never looks
  // acrobatic on a security patrol
  const bankTarget = Math.max(-0.42, Math.min(0.42, -velocity.x * 6.5));
  const pitchTarget = Math.max(-0.3, Math.min(0.3, speed * 5.0));
  airframe.rotation.z += (bankTarget - airframe.rotation.z) * 0.08;
  airframe.rotation.x += (pitchTarget - airframe.rotation.x) * 0.08;

  // gentle idle bob so it never looks frozen in the air
  drone.position.y += Math.sin(t * 2.1) * 0.035;

  // rotors: fast spin, blur disc fades in with rpm
  for (const r of rotors) {
    r.rotation.y += r.userData.dir * (0.55 + spin * 0.9);
    const blur = r.getObjectByName('blur');
    if (blur) blur.material.opacity = 0.04 + spin * 0.16;
  }

  // gimbal keeps the camera on the scan target, which is the whole point of
  // the aircraft — it looks where it is working, not where it is going
  if (target) {
    const dx = target.x - position.x;
    const dz = target.z - position.z;
    const dy = -position.y;
    gimbal.rotation.y = Math.atan2(dx, dz) - airframe.rotation.y;
    gimbal.rotation.x = Math.atan2(dy, Math.hypot(dx, dz)) + Math.PI / 2;
  }

  // nav lights: steady port/starboard, white strobe at ~1.2 Hz double-flash
  const ph = (t * 1.2) % 1;
  lights.strobe.material.opacity = (ph < 0.06 || (ph > 0.12 && ph < 0.18)) ? 1 : 0.05;
  lights.port.material.opacity = 0.85;
  lights.starboard.material.opacity = 0.85;
}
