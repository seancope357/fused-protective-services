/* perimeter.mjs — "Perimeter" scan sequence, prototype.
 *
 * ONE draw call for the whole cloud: a single THREE.Points with a custom
 * ShaderMaterial. Draw-call overhead, not triangle count, is what kills a
 * three.js hero, so every point in this scene lives in one buffer and every
 * beat is a uniform.
 *
 * Beats ride one progress value `u` in 0..1:
 *   0.00-0.22  scan      sweep bar paints the synthetic site plan out of noise
 *   0.22-0.48  patrol    drone marker traverses the path, cone paints as it goes
 *   0.48-0.70  boundary  inside-the-fence points go gold; OUTSIDE STAYS DARK
 *   0.70-1.00  envelope  coverage envelope lifts, handing off to the emblem
 *
 * Deliberate omissions, both load-bearing:
 *   * no detection markers / timestamps — FPS has no detections yet and
 *     inventing them would be fabricated proof on a security vendor's page.
 *   * the site plan is SYNTHETIC. Displaying a drone image of real private
 *     property can implicate Tex. Gov't Code 423.004.
 *
 * Attributes carry the choreography (aHome/aScatter/aZone) and the shader
 * interpolates on uniforms, so there is no per-point JS loop and no buffer
 * re-upload per frame. Same pattern as js/logo-forge.js.
 */

import * as THREE from '../js/vendor/three.module.js';
import { PLAN, ZONE, classify, isCovered, groundHit, clampOrbit, approach }
  from './interact.mjs';
import { buildDrone, updateDrone } from './drone.mjs';

const GOLD = new THREE.Color('#c6a25c');
const GOLD_DIM = new THREE.Color('#87693b');
const COLD = new THREE.Color('#2a3330');
const VOID_BG = 0x050504;

/* Point budget by device class. The site plan must still read as the site plan
 * at the lowest tier — that is the acceptance bar, not the number. Mirrors the
 * adaptive cube count SPEC-009 prescribes for the forge. */
export function pointBudget() {
  const cores = navigator.hardwareConcurrency || 4;
  const w = Math.min(window.innerWidth, window.innerHeight);
  if (w < 700 || cores <= 4) return 22000;
  if (w < 1100 || cores <= 8) return 48000;
  return 90000;
}

/* --- the synthetic site plan -------------------------------------------------
 * A yard with a building footprint, a fence line and an access drive. Returns
 * a point whose xz lies on plan features, plus which zone it belongs to:
 *   0 = outside the fence (never scanned — the consent boundary)
 *   1 = open ground inside
 *   2 = structure
 */
function samplePlan(i, n) {
  // Zone ids come from interact.classify(), the same function the hover test
  // uses, so what you see and what you hover can never disagree.
  const r = (a, b) => a + Math.random() * (b - a);
  const t = i / n;
  if (t < 0.18) {                                  // building footprint
    const x = r(-7, 1), z = r(-4, 4);
    const edge = Math.min(Math.abs(x + 7), Math.abs(x - 1), Math.abs(z + 4), Math.abs(z - 4));
    return [x, edge < 0.35 ? r(0, 3.2) : (Math.random() < 0.25 ? r(0, 3.2) : 0), z,
            1, classify(x, z)];
  }
  if (t < 0.34) {                                  // fence line (the boundary)
    const p = Math.random() * 4;
    const s = 14, d = 9;
    let fx, fz;
    if (p < 1) { fx = r(-s, s); fz = -d; }
    else if (p < 2) { fx = r(-s, s); fz = d; }
    else if (p < 3) { fx = -s; fz = r(-d, d); }
    else { fx = s; fz = r(-d, d); }
    return [fx, r(0, 1.5), fz, 1, classify(fx, fz)];
  }
  if (t < 0.44) {                                  // access drive
    const dx = r(2, 13.8), dz = r(-1.4, 1.4);
    return [dx, 0, dz, 1, classify(dx, dz)];
  }
  if (t < 0.96) {                                  // open ground inside
    const gx = r(-13.8, 13.8), gz = r(-8.8, 8.8);
    return [gx, 0, gz, 1, classify(gx, gz)];
  }
  // beyond the property line: exists, but is never lit. This is the statement.
  const side = Math.random() < 0.5 ? -1 : 1;
  const ox = side * r(15, 24), oz = r(-16, 16);
  return [ox, 0, oz, 0, classify(ox, oz)];
}

const VERT = `
  attribute vec3 aScatter;
  attribute float aZone;
  attribute float aSeed;
  uniform float uScan;      // 0..1 sweep position across x
  uniform float uPatrol;    // 0..1 patrol traverse
  uniform float uBoundary;  // 0..1 inside-fence gold
  uniform float uSettle;    // 0..1 scatter -> home
  uniform float uSize;
  uniform vec2 uPointer;     // ground-plane xz under the pointer
  uniform float uPointerOn;  // 0 when there is no valid hover
  uniform float uHoverZone;  // zone id under the pointer, -1 for none
  attribute float aKind;     // zone id baked per point
  varying float vLit;
  varying float vZone;
  varying float vHot;        // bounded radial pool: brightness + size
  varying float vZoneHot;    // whole-zone cue: COLOUR ONLY, never alpha

  void main() {
    vZone = aZone;
    vec3 home = position;
    // ease the scatter home; points arrive in a wave, not all at once
    float local = clamp(uSettle * 1.35 - aSeed * 0.35, 0.0, 1.0);
    float e = local * local * (3.0 - 2.0 * local);
    vec3 p = mix(aScatter, home, e);

    // the scan sweep: a point is "acquired" once the bar has passed its x
    float sweepX = mix(-26.0, 26.0, uScan);
    float acquired = smoothstep(2.5, -0.5, p.x - sweepX);

    // the patrol cone re-paints as the drone passes overhead
    float droneX = mix(-13.0, 13.0, uPatrol);
    float cone = 1.0 - smoothstep(0.0, 6.0, abs(p.x - droneX));

    // outside the fence is NEVER lit, at any beat
    float allowed = step(0.5, aZone);
    vLit = clamp(max(acquired, cone * 0.9) * allowed, 0.0, 1.0);

    // Pointer highlight. Two parts: a soft radial pool under the cursor, and a
    // flat lift for every point sharing the hovered zone, so hovering the drive
    // lights the whole drive rather than a disc of it.
    float d = distance(p.xz, uPointer);
    float pool = (1.0 - smoothstep(0.0, 5.5, d)) * uPointerOn;
    float sameZone = step(abs(aKind - uHoverZone), 0.5) * uPointerOn;
    // Outside the fence can never be highlighted, at any pointer position.
    //
    // MEASURED: letting the whole-zone cue drive alpha re-blew the scene —
    // hovering "open ground" lights most of the cloud at once and blown-out
    // pixels went 0.12 -> 0.71 with warmth collapsing 139 -> 39. So the two
    // cues are now separated: the bounded radial pool is the only thing
    // allowed to add brightness; matching a zone shifts COLOUR only.
    vHot = clamp(pool * 0.8, 0.0, 1.0) * allowed;
    vZoneHot = sameZone * allowed;

    // acquired points lift slightly - gives the cloud depth under the sweep
    p.y += vLit * 0.25 + cone * allowed * 0.35 + vHot * 0.35;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (1.0 + vLit * 0.6 + vHot * 0.5) * (300.0 / -mv.z);
  }
`;

const FRAG = `
  uniform vec3 uGold;
  uniform vec3 uGoldDim;
  uniform vec3 uCold;
  uniform float uBoundary;
  uniform vec3 uHot;
  varying float vLit;
  varying float vZone;
  varying float vHot;
  varying float vZoneHot;

  void main() {
    // round, soft points without a texture fetch
    vec2 d = gl_PointCoord - vec2(0.5);
    float r = dot(d, d);
    if (r > 0.25) discard;
    float alpha = smoothstep(0.25, 0.0, r);

    vec3 lit = mix(uGoldDim, uGold, uBoundary * step(1.5, vZone + 0.5));
    vec3 c = mix(uCold, lit, vLit);
    // zone cue tints without adding light; pool adds the actual highlight
    c = mix(c, uHot, clamp(vZoneHot * 0.35 + vHot * 0.6, 0.0, 1.0));
    // Additive blending accumulates, so per-point alpha has to be a small
    // fraction or dense regions saturate every channel and the gold reads as
    // white haze. Measured: alpha ~1.0 left 88-92% of lit pixels blown out.
    // vHot adds to the accumulation budget too — keep its contribution small
    // or hovering a dense zone blows the scene out exactly like defect 4.
    float a = alpha * mix(0.035, 0.16, vLit) * mix(0.30, 1.0, step(0.5, vZone))
              * (1.0 + vHot * 0.35);
    gl_FragColor = vec4(c, a);
  }
`;

export function createPerimeter(canvas, opts = {}) {
  const count = opts.count || pointBudget();
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false,
                                             powerPreference: 'high-performance',
                                             // prototype: lets a headless verifier read
                                             // the framebuffer. Drop for production.
                                             preserveDrawingBuffer: !!opts.verify });
  renderer.setClearColor(VOID_BG, 1);
  // DPR above 2 is a review trigger on its own; phones get 1.
  const dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1 : 2);
  renderer.setPixelRatio(dpr);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);

  const pos = new Float32Array(count * 3);
  const scatter = new Float32Array(count * 3);
  const zone = new Float32Array(count);
  const kind = new Float32Array(count);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const [x, y, z, zn, kd] = samplePlan(i, count);
    kind[i] = kd;
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    const a = Math.random() * Math.PI * 2, rad = 16 + Math.random() * 26;
    scatter[i * 3] = Math.cos(a) * rad;
    scatter[i * 3 + 1] = 6 + Math.random() * 22;
    scatter[i * 3 + 2] = Math.sin(a) * rad;
    zone[i] = zn;
    seed[i] = Math.random();
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aScatter', new THREE.BufferAttribute(scatter, 3));
  geo.setAttribute('aZone', new THREE.BufferAttribute(zone, 1));
  geo.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

  const uniforms = {
    uScan: { value: 0 }, uPatrol: { value: 0 }, uBoundary: { value: 0 },
    uSettle: { value: reduced ? 1 : 0 }, uSize: { value: 1.7 },
    uGold: { value: GOLD }, uGoldDim: { value: GOLD_DIM }, uCold: { value: COLD },
    uHot: { value: new THREE.Color('#f7e5b2') },
    uPointer: { value: new THREE.Vector2(0, 0) },
    uPointerOn: { value: 0 }, uHoverZone: { value: -1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);

  /* The aircraft. Procedural geometry (see drone.mjs) — it costs script bytes
   * but zero network payload, which is what keeps it inside the SPEC-009
   * budget that a GLB would break. It adds draw calls, so the count is
   * asserted in the verification notes rather than assumed. */
  const drone = buildDrone();
  drone.scale.setScalar(1.35);
  scene.add(drone);

  /* Minimal light rig: the point cloud is unlit (its own shader), so these
   * exist purely for the aircraft. Two lights, deliberately — more would cost
   * a shader recompile per material for no visible gain at this scale. */
  scene.add(new THREE.AmbientLight(0x6b7480, 1.1));
  const key = new THREE.DirectionalLight(0xfff0d0, 1.5);
  key.position.set(6, 12, 4);
  scene.add(key);

  // where the operator has commanded the patrol to look
  let commanded = null;
  let droneState = { x: -13, z: 0, vx: 0, vz: 0 };

  let dirty = true, visible = true, u = 0, raf = 0;

  /* --- interaction state ---------------------------------------------------
   * yaw/pitch are user-driven but clamped; pointer drives a ground-plane hover.
   * All of it is smoothed through approach() so a flick of the mouse does not
   * snap the camera. Reduced motion disables orbit entirely and keeps hover,
   * because hover conveys information while orbit is pure motion. */
  let yaw = 0, pitch = 0, yawT = 0, pitchT = 0;
  let basePitch = -0.5, camPitch = -0.5;
  let dragging = false, lastX = 0, lastY = 0;
  let hoverZone = -1, pointerOn = 0, pointerT = { x: 0, z: 0 };
  let onZoneChange = opts.onZoneChange || null;

  /* Pointer -> ground plane -> zone. Uses the shared classifier, never a
   * raycast against 90k points. */
  function updatePointer(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    const ndc = {
      x: ((clientX - r.left) / r.width) * 2 - 1,
      y: -(((clientY - r.top) / r.height) * 2 - 1),
    };
    const hit = groundHit(ndc, {
      fovDeg: camera.fov, aspect: camera.aspect, pitch: camPitch, yaw,
      position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
    });
    if (!hit) { setHover(-1, 0); return; }
    pointerT = hit;
    const z = classify(hit.x, hit.z, PLAN);
    setHover(z, 1);
  }

  function setHover(z, on) {
    if (z !== hoverZone || on !== pointerOn) {
      hoverZone = z; pointerOn = on;
      if (onZoneChange) onZoneChange(on ? z : -1);
      dirty = true;
    }
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
    dirty = true;
  }

  /* Dual clocks, same contract as logo-forge.js: `--perimeter` is raw scroll,
   * `--perimeter-settled` is real arrival. Downstream CSS must assert on the
   * settled clock, never the raw one. */
  function publish(settled) {
    const root = document.documentElement;
    root.style.setProperty('--perimeter', u.toFixed(4));
    root.style.setProperty('--perimeter-settled', settled.toFixed(4));
  }

  function setProgress(next) {
    u = Math.max(0, Math.min(1, next));
    dirty = true;
  }

  /* One simulation step: beats, flight, camera, uniforms, clocks. Shared by
   * the rAF loop and by stepTo() so the two can never diverge. */
  function advance() {
    // beat mapping
    const scan = Math.min(1, u / 0.22);
    const patrol = Math.max(0, Math.min(1, (u - 0.22) / 0.26));
    const boundary = Math.max(0, Math.min(1, (u - 0.48) / 0.22));
    const settleTarget = Math.min(1, u / 0.30);

    if (reduced) {
      uniforms.uSettle.value = 1;
    } else {
      // critically damped approach, so cubes/points keep settling after the
      // user stops scrolling — this is why the settled clock exists
      uniforms.uSettle.value += (settleTarget - uniforms.uSettle.value) * 0.08;
    }
    uniforms.uScan.value = scan;
    uniforms.uPatrol.value = patrol;
    uniforms.uBoundary.value = boundary;

    /* Flight. By default the aircraft flies the scripted patrol line; once the
     * operator clicks a point inside the boundary it diverts there, which is
     * the interaction that makes this a console rather than an animation. */
    const scripted = { x: -13 + 26 * patrol, z: 0 };
    const goal = commanded || scripted;
    const px = droneState.x, pz = droneState.z;
    droneState.x = approach(droneState.x, goal.x, commanded ? 0.045 : 0.28);
    droneState.z = approach(droneState.z, goal.z, commanded ? 0.045 : 0.28);
    droneState.vx = droneState.x - px;
    droneState.vz = droneState.z - pz;

    const alt = 6.4 + Math.sin(u * Math.PI) * 1.2;
    updateDrone(drone, {
      position: { x: droneState.x, y: alt, z: droneState.z },
      velocity: { x: droneState.vx, z: droneState.vz },
      target: { x: droneState.x, z: droneState.z },
      spin: 1,
      t: performance.now() / 1000,
    });
    drone.visible = u > 0.18;

    // Camera pulls back and tilts down as the plan assembles, then the user's
    // clamped orbit is applied on top. camPitch/yaw are recorded because
    // groundHit() must use the SAME angles that were rendered, or the hover
    // lands somewhere the user is not pointing.
    const cu = u * u * (3 - 2 * u);
    yaw = approach(yaw, yawT, 0.12);
    pitch = approach(pitch, pitchT, 0.12);
    const radius = 30 - cu * 6;
    const height = 9 + cu * 13;
    camera.position.set(Math.sin(yaw) * radius, height, Math.cos(yaw) * radius);
    camera.lookAt(0, 0, 0);
    basePitch = Math.atan2(-height, radius);
    camPitch = basePitch + pitch;

    // smooth the pointer so the highlight glides instead of teleporting
    uniforms.uPointer.value.set(
      approach(uniforms.uPointer.value.x, pointerT.x, 0.2),
      approach(uniforms.uPointer.value.y, pointerT.z, 0.2),
    );
    uniforms.uPointerOn.value = approach(uniforms.uPointerOn.value, pointerOn, 0.18);
    uniforms.uHoverZone.value = hoverZone;

    const settled = Math.min(uniforms.uSettle.value, 1);
    publish(settled);
    // Returned, not closed over: frame() needs settleTarget for its redraw
    // test, and scoping it inside advance() silently broke that. `node --check`
    // passes on a scope error — only running it catches this.
    return { settleTarget, settled };
  }

  function frame() {
    raf = requestAnimationFrame(frame);
    if (!visible) return;
    const { settleTarget } = advance();
    const moving = Math.abs(settleTarget - uniforms.uSettle.value) > 0.001
      || Math.abs(uniforms.uPointerOn.value - pointerOn) > 0.004
      || Math.abs(yaw - yawT) > 0.0005 || Math.abs(pitch - pitchT) > 0.0005;
    // the aircraft's rotors and strobe animate every frame while visible, so
    // it is its own reason to redraw — but only when actually on screen
    if (dirty || moving || (drone.visible && !reduced)) {
      renderer.render(scene, camera);
      dirty = moving;
    }
  }

  /* Pointer + drag. `touch-action: pan-y` in the CSS keeps vertical scrolling
   * working on phones, so the scene never traps the page — the orbit only
   * responds to horizontal drag. */
  if (!reduced) {
    canvas.addEventListener('pointerdown', (e) => {
      dragging = true; lastX = e.clientX; lastY = e.clientY;
      canvas.setPointerCapture?.(e.pointerId);
    });
    canvas.addEventListener('pointerup', (e) => {
      dragging = false; canvas.releasePointerCapture?.(e.pointerId);
    });
    canvas.addEventListener('pointercancel', () => { dragging = false; });
  }
  canvas.addEventListener('pointermove', (e) => {
    if (dragging && !reduced) {
      yawT -= (e.clientX - lastX) * 0.004;
      pitchT -= (e.clientY - lastY) * 0.0025;
      const c = clampOrbit(yawT, pitchT + basePitch);
      yawT = c.yaw; pitchT = c.pitch - basePitch;
      lastX = e.clientX; lastY = e.clientY;
      dirty = true;
    }
    updatePointer(e.clientX, e.clientY);
  });
  canvas.addEventListener('pointerleave', () => { setHover(-1, 0); dragging = false; });

  /* Click to command the patrol. Guarded by isCovered(): the aircraft can
   * never be directed beyond the property line, so the interaction itself
   * enforces the consent boundary rather than merely depicting it. */
  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const hit = groundHit({
      x: ((e.clientX - r.left) / r.width) * 2 - 1,
      y: -(((e.clientY - r.top) / r.height) * 2 - 1),
    }, { fovDeg: camera.fov, aspect: camera.aspect, pitch: camPitch, yaw,
         position: { x: camera.position.x, y: camera.position.y, z: camera.position.z } });
    if (!hit) return;
    const z = classify(hit.x, hit.z, PLAN);
    if (!isCovered(z)) {
      if (opts.onReject) opts.onReject(z);
      return;                       // refuse: outside the consent boundary
    }
    commanded = { x: hit.x, z: hit.z };
    if (opts.onCommand) opts.onCommand({ x: hit.x, z: hit.z, zone: z });
    dirty = true;
  });

  const io = new IntersectionObserver((es) => {
    visible = es[0].isIntersecting;
    dirty = true;
  }, { threshold: 0 });
  io.observe(canvas);

  window.addEventListener('resize', resize);
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    document.documentElement.dataset.forgeFallback = 'true';
    cancelAnimationFrame(raf);
  });

  resize();
  frame();

  return {
    setProgress,
    get count() { return count; },
    get calls() { return renderer.info.render.calls; },
    forceRender() { renderer.render(scene, camera); },
    /* Isolate one uniform at a fixed camera. Screen-coverage metrics confound
     * a colour change with camera movement, so beat 3 has to be tested by
     * toggling uBoundary alone. Prototype only. */
    /* Drive the pointer from code, in CLIENT coordinates, so a headless probe
     * exercises the same path a mouse does. Prototype only. */
    debugPointer(clientX, clientY) { updatePointer(clientX, clientY); },
    /* Park the camera for an inspection render. Prototype only — lets a
     * close-up of the airframe be captured without shipping a camera API. */
    debugCamera(px, py, pz, lx = 0, ly = 0, lz = 0) {
      camera.position.set(px, py, pz);
      camera.lookAt(lx, ly, lz);
      renderer.render(scene, camera);
    },
    debugCommand(x, z) {
      const zz = classify(x, z, PLAN);
      if (!isCovered(zz)) return { accepted: false, zone: zz };
      commanded = { x, z };
      return { accepted: true, zone: zz };
    },
    get dronePos() { return { x: +droneState.x.toFixed(3), z: +droneState.z.toFixed(3) }; },
    get droneVisible() { return drone.visible; },
    get commanded() { return commanded ? { ...commanded } : null; },
    debugClearPointer() { setHover(-1, 0); },
    get hoverZone() { return hoverZone; },
    debugBoundary(v) {
      uniforms.uBoundary.value = v;
      renderer.render(scene, camera);
    },
    /* Synchronous beat stepper for headless verification. requestAnimationFrame
     * is throttled (often to zero) in a background/headless tab, so a verifier
     * that waits on frames hangs. This advances the damped settle in a plain
     * loop and renders once — no rAF dependency. Prototype only. */
    /* Synchronous stepper for headless verification. It calls the SAME
     * advance() the render loop uses — an earlier version duplicated the beat
     * and flight code and silently kept driving a drone representation that
     * had already been deleted, so the verifier was measuring a path the user
     * never sees. Never re-implement frame logic here. */
    stepTo(next, iters = 160) {
      setProgress(next);
      for (let i = 0; i < iters; i++) advance();
      renderer.render(scene, camera);
    },
    readStats() {
      const gl = renderer.getContext();
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
      const px = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let lit = 0, goldish = 0, leftDark = 0, leftTot = 0;
      for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
        const i = (y * w + x) * 4;
        const r = px[i], g = px[i + 1], b = px[i + 2];
        const l = (r + g + b) / 3;
        if (l > 18) lit++;
        if (r > 90 && r > b + 25) goldish++;
        if (x < w * 0.08) { leftTot++; if (l <= 18) leftDark++; }
      }
      // Channel means over LIT pixels only. A chroma test like (r > b + 25)
      // silently fails under additive blending: accumulation drives every
      // channel up, so a brighter gold reads as less saturated, not more.
      let sr = 0, sg = 0, sb = 0, n = 0, white = 0;
      for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
        const i = (y * w + x) * 4;
        const r = px[i], g = px[i + 1], b = px[i + 2];
        if ((r + g + b) / 3 <= 18) continue;
        sr += r; sg += g; sb += b; n++;
        if (r > 225 && g > 215 && b > 200) white++;
      }
      const mean = n ? { r: +(sr / n).toFixed(1), g: +(sg / n).toFixed(1),
                         b: +(sb / n).toFixed(1) } : null;
      return { lit, goldish, edgeDarkRatio: leftDark / Math.max(leftTot, 1),
               mean, warmth: mean ? +(mean.r - mean.b).toFixed(1) : null,
               blownOut: n ? +(white / n).toFixed(3) : null };
    },
    dispose() {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('resize', resize);
      geo.dispose(); mat.dispose(); renderer.dispose();
    },
  };
}
