/* Boot script. EXTERNAL on purpose: `script-src 'self'` allowlists only the
 * production inline scripts by sha256, so any new inline <script> is blocked.
 * Keep boot logic in a file; never ask for a CSP exception for a prototype. */
import { createPerimeter, pointBudget } from './perimeter.mjs';
import { ZONE, ZONE_LABEL } from './interact.mjs';

  const canvas = document.getElementById('c');
  const hud = document.getElementById('hud');
  let engine;
  try {
    const readout = document.getElementById('zone-readout');
    engine = createPerimeter(canvas, {
      verify: true,
      /* The hover answer is published as real DOM text in an aria-live region,
       * not only as pixels. The canvas is aria-hidden decoration, so anything
       * the scene conveys must also be readable by a screen reader, by a
       * visitor with WebGL disabled, and by a crawler. */
      onCommand({ zone }) {
        readout.textContent = 'Patrol diverted — ' + ZONE_LABEL[zone];
        readout.dataset.state = 'covered';
      },
      onReject() {
        readout.textContent = 'Refused — outside the consent boundary';
        readout.dataset.state = 'outside';
      },
      onZoneChange(zone) {
        if (zone === -1 || zone === undefined) {
          readout.textContent = 'Move across the plan to inspect coverage · click to direct the patrol';
          readout.dataset.state = 'idle';
          return;
        }
        readout.textContent = ZONE_LABEL[zone];
        readout.dataset.state = zone === ZONE.OUTSIDE ? 'outside' : 'covered';
      },
    });
  } catch (err) {
    document.documentElement.dataset.forgeFallback = 'true';
    hud.textContent = 'WebGL unavailable — fallback state';
    throw err;
  }

  // Prototype-only debug handle: lets a headless verifier force progress and
  // read pixels back. Must NOT survive into the production module.
  window.__perimeter = engine;

  const track = document.getElementById('track');
  function onScroll() {
    const h = track.offsetHeight - window.innerHeight;
    engine.setProgress(h > 0 ? window.scrollY / h : 0);
  }
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();

  // live budget readout — the numbers a review actually needs
  setInterval(() => {
    const root = document.documentElement;
    hud.innerHTML =
      `points <b>${engine.count.toLocaleString()}</b> · budget ${pointBudget().toLocaleString()}` +
      ` · draw calls <b>${engine.calls}</b> · dpr ${Math.min(devicePixelRatio, innerWidth < 700 ? 1 : 2)}` +
      `<br>--perimeter <b>${root.style.getPropertyValue('--perimeter') || '0'}</b>` +
      ` · settled <b>${root.style.getPropertyValue('--perimeter-settled') || '0'}</b>`;
  }, 250);
