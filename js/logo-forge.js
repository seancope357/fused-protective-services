/* ==========================================================================
   FUSED PROTECTIVE SERVICES — SCROLL-FORGED EMBLEM ("THE ASSEMBLY")
   Adapted from assets/o-scroll.html (Pixel Scroll Forge)

   The brand emblem is shattered into ~65k depth-scattered voxel cubes;
   the visitor's scroll pulls the camera back until every fragment lands
   flush and the shield reads whole — the company name, acted out.

   Every cube is scaled so its front face projects to an identical screen
   size once the camera reaches ASSEMBLE_Z — scattered in depth they read
   as noise, and the scroll collects them into the photograph.

   Seams the page uses:
     --assembly on <html> and a pixelScroll event carry SCROLL progress 0-1;
       css/forge.css keys the intro copy beats off that clock, so the words
       move with the reader's thumb
     --assembly-settled and a pixelScroll:settled event carry the CAMERA's
       progress; anything that asserts completion in words reads this one,
       because --assembly reaches 1 the moment the scroll does, while the
       camera is still easing the last of the way in
     data-forge-fallback appears on <html> when WebGL or the CDN is
       missing and the emblem is mounted as a still instead
     prefers-reduced-motion holds the assembled emblem still and the
       track collapses (css/forge.css) so there is no dead scroll
   ========================================================================== */

/* ── configuration ─────────────────────────────────────────────── */

const IMAGE_SRC    = 'assets/logo.png';   // same plate the nav and hero already load
const GRID_ROWS    = 256;      // vertical resolution; columns follow the image ratio
const CUBE_SIZE    = 1.00;
const ASSEMBLE_Z   = 180;      // camera z at full scroll
const START_ZOOM   = 5.0;      // camera starts at ASSEMBLE_Z / START_ZOOM
const DEPTH_SPREAD = 0.990;    // 0 = flat, < 1 keeps cubes behind the camera
const FOV          = 75;       // used as-is when AUTO_FIT is off
const AUTO_FIT     = true;
const FIT          = 0.90;     // share of the viewport the emblem fills
const FRAMING      = 'contain';
const DAMPING      = 0.12;     // scroll follow, 1 = instant
const ALPHA_CUTOFF = 8;        // 0-255; below this a pixel becomes no cube at all
const BACKGROUND   = null;     // transparent: the site's void + particle mesh show through
const TRACK_ID     = 'assembly-intro';   // css/forge.css owns the track height

const START_Z = ASSEMBLE_Z / START_ZOOM;

/* ── three.js ──────────────────────────────────────────────────── */
/* One pinned version, mirrored. This import is the only thing the page
   fetches beyond its own assets and Google Fonts; if both hosts are
   unreachable the fallback below mounts the emblem as a still. */

const THREE_SOURCES = [
  'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js',
  'https://unpkg.com/three@0.160.0/build/three.module.js'
];

let THREE = null;

function loadThree(at) {
  const i = at || 0;
  return import(THREE_SOURCES[i]).catch(function (err) {
    if (i + 1 >= THREE_SOURCES.length) throw err;
    console.warn('[logo-forge] ' + THREE_SOURCES[i] + ' did not load; trying the next host');
    return loadThree(i + 1);
  });
}

/* ── the trick ─────────────────────────────────────────────────── */
/* distance = ASSEMBLE_Z - z, scale = distance / ASSEMBLE_Z, therefore
   apparent size = CUBE_SIZE * scale / distance = CUBE_SIZE / ASSEMBLE_Z.
   Constant, whatever the depth. The vertex shader below is where
   this is actually applied — nothing but the depth is stored. */

/* ── sampling ──────────────────────────────────────────────────── */
/* Halve repeatedly before the final draw. A single big downscale
   point-samples and shreds fine detail; this box-filters it. */

function sample(img, w, h) {
  let sw = img.naturalWidth, sh = img.naturalHeight, src = img;

  while (sw > w * 2 && sh > h * 2) {
    sw = Math.max(w, sw >> 1);
    sh = Math.max(h, sh >> 1);
    const step = document.createElement('canvas');
    step.width = sw; step.height = sh;
    const sctx = step.getContext('2d');
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(src, 0, 0, sw, sh);
    src = step;
  }

  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h).data;
}

/* ── texture ───────────────────────────────────────────────────── */
/* The photograph goes to the GPU whole and every cube draws its own tile
   of it. Sharpness is then a property of the source and the screen, not
   of GRID_ROWS. */

function makeTexture(img) {
  const texture = new THREE.Texture(img);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  texture.needsUpdate = true;
  return texture;
}

/* ── material ──────────────────────────────────────────────────── */
/* Neighbouring faces are only *mathematically* coincident — grow every
   face a hair so neighbours overlap instead of abut, or the background
   sparkles through along hard edges. The pitch is untouched. */

const SEAM_OVERLAP = 0.02;

function makeMaterial(cols, rows, texture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      grid: { value: new THREE.Vector2(cols, rows) },
      cubeSize: { value: CUBE_SIZE },
      assembleZ: { value: ASSEMBLE_Z },
      overlap: { value: SEAM_OVERLAP },
      map: { value: texture },
      alphaCutoff: { value: ALPHA_CUTOFF / 255 }
    },
    vertexShader: `
      attribute vec3 place;     // column, row, and the depth it is parked at

      uniform vec2 grid;
      uniform float cubeSize;
      uniform float assembleZ;
      uniform float overlap;
      varying vec2 vTileUv;

      void main() {
        /* the trick, applied: scale by distance / assembleZ and the front
           face projects to cubeSize / assembleZ whatever the depth */
        float s = (assembleZ - place.z) / assembleZ;
        vec2 centre = vec2(
          (place.x - grid.x * 0.5 + 0.5) * cubeSize,
          (grid.y * 0.5 - place.y - 0.5) * cubeSize
        ) * s;

        /* image rows run top-down, uv runs bottom-up; the window grows
           with the face so the overlap shows the neighbour's own pixels */
        float bleed = overlap * 0.5;
        vec2 origin = vec2((place.x - bleed) / grid.x,
                           1.0 - (place.y + 1.0 + bleed) / grid.y);
        vTileUv = origin + uv * (1.0 + overlap) / grid;

        vec4 world = vec4(vec3(centre, place.z) + position * s, 1.0);
        gl_Position = projectionMatrix * modelViewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform sampler2D map;
      uniform float alphaCutoff;
      varying vec2 vTileUv;

      void main() {
        vec4 texel = texture2D(map, vTileUv);
        if (texel.a < alphaCutoff) discard;   // per pixel, so cut-outs keep their edge
        gl_FragColor = vec4(texel.rgb, 1.0);
        #include <colorspace_fragment>
      }
    `
  });
}

/* ── mesh ──────────────────────────────────────────────────────── */

function build(img) {
  const rows = GRID_ROWS;
  const cols = Math.max(1, Math.round(rows * (img.naturalWidth / img.naturalHeight)));
  const px = sample(img, cols, rows);   // read for alpha only; colour comes from the texture
  gridCols = cols;

  const face = CUBE_SIZE * (1 + SEAM_OVERLAP);
  const geometry = new THREE.InstancedBufferGeometry().copy(
    new THREE.BoxGeometry(face, face, face).translate(0, 0, -0.5 * face)
  );

  /* Twelve bytes an instance instead of a sixty-four byte matrix — which
     is what makes a large grid cheap to *load*, not just cheap to draw. */
  const place = new Float32Array(cols * rows * 3);

  /* Not scaled by CUBE_SIZE: the scatter must stay strictly inside
     ±ASSEMBLE_Z or cubes land at or past the camera plane, where the
     scale factor goes to zero and then negative. */
  const spread = 2 * ASSEMBLE_Z * DEPTH_SPREAD;
  let n = 0;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = (row * cols + col) * 4;
      if (px[i + 3] < ALPHA_CUTOFF) continue;

      place[n * 3]     = col;
      place[n * 3 + 1] = row;
      place[n * 3 + 2] = THREE.MathUtils.randFloatSpread(spread);

      n++;
    }
  }

  geometry.setAttribute('place', new THREE.InstancedBufferAttribute(place, 3));
  geometry.instanceCount = n;

  const material = makeMaterial(cols, rows, makeTexture(img));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  return mesh;
}

/* ── scroll ────────────────────────────────────────────────────── */

let targetZ = START_Z;

/* The track is the #assembly-intro section, so css/forge.css owns its
   length (and collapses it for reduced motion and fallback). Content
   below the track scrolls over the finished emblem while the hand-off
   fade (below) carries the canvas out from under it. */

const trackEl = document.getElementById(TRACK_ID);

function trackLength() {
  const el = trackEl;
  return el ? Math.max(0, el.offsetHeight - window.innerHeight) : 0;
}

/* Progress is published as well as consumed: --assembly on the root
   element and a pixelScroll event carrying the same number, so the
   intro copy beats and HUD readout move on the camera's clock instead
   of guessing at a second one. */

let assembly = -1;   // starts off-scale so the first publish always lands

let needsFrame = true;   // the very first frame lands before anything moves

function invalidate() { needsFrame = true; }

function onScroll() {
  const track = trackLength();
  const r = track > 0 ? Math.min(1, Math.max(0, window.scrollY / track)) : 1;
  targetZ = START_Z + (ASSEMBLE_Z - START_Z) * r;
  invalidate();
  publish(r);
}

function publish(r) {
  if (r === assembly) return;
  assembly = r;
  document.documentElement.style.setProperty('--assembly', r.toFixed(4));
  window.dispatchEvent(new CustomEvent('pixelScroll', { detail: { assembly: r } }));
}

/* --assembly is a *position* signal: it reads 1.0000 the instant the scroll
   reaches the end of the track, while the camera is still easing the last of
   the way in. That is the right clock for the copy beats, which should move
   with the reader's thumb — but it is the wrong one for a readout that makes
   a claim in words, because on a slow renderer it announces a finished shield
   over cubes that are visibly still arriving.

   So the camera publishes its own progress. Anything asserting completion
   should read this one; anything pacing itself against the scroll should read
   --assembly. */

let settled = -1;

function publishSettled(s) {
  const value = Math.min(1, Math.max(0, s));
  if (Math.abs(value - settled) < 0.0005 && value !== 1) return;
  if (value === settled) return;
  settled = value;
  document.documentElement.style.setProperty('--assembly-settled', value.toFixed(4));
  window.dispatchEvent(new CustomEvent('pixelScroll:settled', { detail: { settled: value } }));
}

/** Where the camera actually is, as a 0-1 fraction of its travel. */
const cameraProgress = () =>
  camera ? (camera.position.z - START_Z) / (ASSEMBLE_Z - START_Z) : 0;

/* ── hand-off ──────────────────────────────────────────────────── */
/* Once the visitor scrolls past the track, the page below takes over:
   the stage (canvas or fallback still) fades across the next 45vh and
   is then hidden outright — gone before the hero heading arrives, so
   the settled emblem never stacks behind the hero's own emblem card or
   ghosts behind the translucent sections further down. Runs in every
   mode — reduced motion and fallback included — because the stage
   exists in all of them. */

let stageEl = null;

function onHandOff() {
  if (!stageEl) return;
  const over = window.scrollY - trackLength();
  const fade = Math.min(1, Math.max(0, over / (window.innerHeight * 0.45)));
  stageEl.style.opacity = (1 - fade).toFixed(3);
  stageEl.style.visibility = fade >= 1 ? 'hidden' : '';
}

window.addEventListener('scroll', onHandOff, { passive: true });
window.addEventListener('resize', onHandOff);

/* ── HUD readout ───────────────────────────────────────────────── */
/* Consumes the published pixelScroll event like any other page seam.
   Hidden entirely by css/forge.css when data-forge-fallback is up — a
   progress figure over a static image would be a lie. */

const readoutEl = document.getElementById('forgeReadout');

window.addEventListener('pixelScroll:settled', function (e) {
  if (!readoutEl) return;
  const r = e.detail.settled;
  if (r >= 0.999) {
    readoutEl.textContent = 'SHIELD INTEGRITY 100% · OPERATIONAL';
    readoutEl.classList.add('is-set');
  } else {
    readoutEl.textContent = 'ASSEMBLING ' + (r * 100).toFixed(1).padStart(5, '0') + '%';
    readoutEl.classList.remove('is-set');
  }
});

/* Scroll-coupled camera travel is the whole-field motion vestibular
   guidance warns about. When it is unwelcome, present the assembled
   emblem instead — the same payoff, held still. */

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

/* A page may also dispatch pixelScroll:motion with { still: true } to
   hold the picture. The two are OR-ed, never swapped: a page toggle can
   add stillness, but the OS preference is the floor. */

let pageStill = false;

function still() { return reduced.matches || pageStill; }

function applyMotion() {
  if (still()) {
    targetZ = camera.position.z = ASSEMBLE_Z;
    publish(1);          // content keyed to progress must show its resting state
    publishSettled(1);   // and the camera really is there, so say so
  } else {
    onScroll();
  }
  /* the jump above moves no camera the loop can notice, so say so */
  invalidate();
}

let gridCols = 0;

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;

  if (AUTO_FIT && gridCols > 0) {
    /* Fit by widening the lens, never by rescaling the cubes: the
       equal-apparent-size invariant is a function of their absolute
       depths, so the geometry must not move. */
    const halfH = (GRID_ROWS * CUBE_SIZE) / (2 * FIT);
    const halfW = (gridCols * CUBE_SIZE) / (2 * FIT);
    const byHeight = Math.atan(halfH / ASSEMBLE_Z);
    const byWidth = Math.atan(halfW / ASSEMBLE_Z / camera.aspect);

    /* Contain keeps the whole picture, cover keeps the whole screen —
       there is no third option when the ratios differ. */
    camera.fov = THREE.MathUtils.radToDeg(2 * (FRAMING === 'cover'
      ? Math.min(byHeight, byWidth)
      : Math.max(byHeight, byWidth)));
  }

  camera.updateProjectionMatrix();
  invalidate();   // a new projection is a new picture of the same scene
}

/* ── fallback ──────────────────────────────────────────────────── */
/* three.js and a GPU context are how the picture is *delivered*; the
   picture itself is already here. When delivery is impossible, mount
   the emblem where the settled canvas would have been and publish a
   finished assembly so the copy beats lay out over a resolved image
   instead of waiting for one that is never coming. css/forge.css also
   collapses the track so there is no dead scroll. */

let fellBack = false;

function fallback(reason, notice) {
  if (fellBack) return;
  fellBack = true;
  console.error('[logo-forge] ' + reason);
  document.documentElement.setAttribute('data-forge-fallback', '');

  const img = document.createElement('img');
  img.src = IMAGE_SRC;
  /* Presentational for the same reason the canvas is: whatever it shows,
     the page says in text. */
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  Object.assign(img.style, {
    position: 'fixed', top: '0', left: '0',
    width: '100%', height: '100%',
    objectFit: FRAMING === 'cover' ? 'cover' : 'contain',
    zIndex: '0', pointerEvents: 'none'
  });
  document.body.prepend(img);
  stageEl = img;
  onHandOff();

  /* A missing GPU is the visitor's permanent situation and nothing they
     can act on; an unreachable host is neither, so that one says so. */
  if (notice) {
    const say = document.createElement('p');
    say.textContent = notice;
    Object.assign(say.style, {
      position: 'fixed', left: '50%', bottom: '16px', transform: 'translateX(-50%)',
      zIndex: '2', margin: '0', maxWidth: 'min(90vw, 36em)',
      padding: '10px 14px', borderRadius: '8px', textAlign: 'center',
      background: 'rgba(0, 0, 0, .74)', color: '#fff',
      font: '500 13px/1.5 ui-sans-serif, -apple-system, system-ui, sans-serif'
    });
    document.body.appendChild(say);
  }

  publish(1);
  publishSettled(1);   // a still image is, by definition, fully arrived
}

/* ── run ───────────────────────────────────────────────────────── */

let renderer = null, scene = null, camera = null, clock = null;

function boot() {
  try {
    renderer = new THREE.WebGLRenderer({
      alpha: BACKGROUND === null,
      antialias: true,
      powerPreference: 'high-performance'
    });
  } catch (err) {
    fallback('WebGL is unavailable, so the emblem cannot be assembled (' + err.message + ')');
    return;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();
  if (BACKGROUND !== null) scene.background = new THREE.Color(BACKGROUND);

  camera = new THREE.PerspectiveCamera(FOV, 2, 0.1, ASSEMBLE_Z * 6);
  camera.position.set(0, 0, START_Z);

  clock = new THREE.Clock();

  Object.assign(renderer.domElement.style, {
    position: 'fixed', top: '0', left: '0',
    width: '100%', height: '100%',
    zIndex: '0', pointerEvents: 'none'
  });

  /* The emblem it assembles carries no information the page does not
     also say in text, so it is presentational to assistive technology. */
  renderer.domElement.setAttribute('aria-hidden', 'true');

  /* Rendering on demand: the loop keeps ticking, but the draw — the part
     that costs a battery anything — only happens for a frame that
     differs from the one already on screen. */
  renderer.setAnimationLoop(function () {
    /* frame-rate independent easing: same feel at 60 and 144 Hz. The
       clamp only guards a tab frozen for minutes — keep it far above any
       real frame interval or the ease stops following the clock. */
    const dt = Math.min(clock.getDelta(), 0.5);
    const k = DAMPING >= 1 ? 1 : 1 - Math.pow(1 - DAMPING, dt * 60);
    const gap = targetZ - camera.position.z;
    if (gap !== 0) {
      /* Snap once we are close: the last fraction of the ease is
         magnified into visible seams by the nearest cubes — land it
         exactly instead of approaching forever. */
      camera.position.z = Math.abs(gap) < 0.001 ? targetZ : camera.position.z + gap * k;
      needsFrame = true;
    }
    if (!needsFrame) return;
    needsFrame = false;
    /* Published from here, after the camera has moved and before the frame
       that shows it — so the figure on screen describes the frame on screen. */
    publishSettled(cameraProgress());
    renderer.render(scene, camera);
  });

  window.addEventListener('resize', resize);
  document.addEventListener('scroll', function () { if (!still()) onScroll(); }, { passive: true });
  reduced.addEventListener('change', applyMotion);
  window.addEventListener('pixelScroll:motion', function (e) {
    pageStill = !!(e.detail && e.detail.still);
    applyMotion();
  });

  document.body.prepend(renderer.domElement);
  stageEl = renderer.domElement;
  resize();
  applyMotion();
  onHandOff();

  new Promise(function (resolve, reject) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () { resolve(img); };
    img.onerror = function () { reject(new Error('could not load ' + IMAGE_SRC)); };
    img.src = IMAGE_SRC;
  }).then(function (img) {
    scene.add(build(img));
    resize();
    applyMotion();
    invalidate();   // the texture exists now; this is the first frame that can show it
  }).catch(function (err) {
    console.error('[logo-forge]', err);
    fallback('the emblem image did not load (' + err.message + ')');
  });
}

loadThree().then(function (three) {
  THREE = three;
  boot();
}).catch(function (err) {
  fallback('three.js did not load from any known host (' + err.message + ')',
    'This page assembles its emblem with three.js, and every host it knows is unreachable.');
});
