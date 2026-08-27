/* ==========================================================================
   AMBIENT LAYERS — PARTICLE MESH, EMBLEM TILT, CURSOR SPOTLIGHT
   Decorative only. Each one checks prefers-reduced-motion, and the mesh
   stops drawing entirely once it scrolls out of view rather than running a
   full-frame O(n²) pass behind whatever the visitor is actually reading.
   ========================================================================== */

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/* ── particle mesh ─────────────────────────────────────────────── */

const PARTICLE_COUNT = 45;
const LINK_DISTANCE = 130;

export function initParticles() {
    const canvas = document.getElementById('tactical-bg-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let running = true;
    let frame = null;

    const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
        x: Math.random(),
        y: Math.random(),
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.5 + 0.5
    }));

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /* Positions are stored as fractions so a resize repositions rather than
       stranding particles outside the new viewport. */
    function place() {
        return particles.map((p) => ({ ...p, px: p.x * width, py: p.y * height }));
    }

    let live = [];

    function step(advance) {
        ctx.clearRect(0, 0, width, height);

        for (let i = 0; i < live.length; i++) {
            const p = live[i];
            if (advance) {
                p.px += p.vx;
                p.py += p.vy;
                if (p.px < 0) p.px = width;
                if (p.px > width) p.px = 0;
                if (p.py < 0) p.py = height;
                if (p.py > height) p.py = 0;
            }

            ctx.beginPath();
            ctx.arc(p.px, p.py, p.r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(186, 152, 87, 0.28)';
            ctx.fill();

            for (let j = i + 1; j < live.length; j++) {
                const q = live[j];
                const dx = p.px - q.px;
                const dy = p.py - q.py;
                const dist = Math.hypot(dx, dy);
                if (dist < LINK_DISTANCE) {
                    ctx.beginPath();
                    ctx.moveTo(p.px, p.py);
                    ctx.lineTo(q.px, q.py);
                    ctx.strokeStyle = `rgba(186, 152, 87, ${0.14 * (1 - dist / LINK_DISTANCE)})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }
    }

    function loop() {
        step(true);
        frame = requestAnimationFrame(loop);
    }

    function start() {
        if (frame !== null || reduced.matches) return;
        frame = requestAnimationFrame(loop);
    }

    function stop() {
        if (frame !== null) cancelAnimationFrame(frame);
        frame = null;
    }

    function reset() {
        resize();
        live = place();
        if (reduced.matches) {
            stop();
            step(false);   // a single still frame, so the layer is not simply absent
        } else if (running) {
            start();
        }
    }

    window.addEventListener('resize', reset);
    reduced.addEventListener('change', reset);

    /* The canvas is fixed to the viewport, so "off screen" means the tab is
       hidden — rAF already throttles there, but stopping outright is free. */
    document.addEventListener('visibilitychange', () => {
        running = !document.hidden;
        running ? start() : stop();
    });

    reset();
}

/* ── hero emblem tilt ──────────────────────────────────────────── */

export function initTilt() {
    const wrapper = document.getElementById('emblemWrapper');
    const card = document.getElementById('emblemCard');
    if (!wrapper || !card || !finePointer() || reduced.matches) return;

    wrapper.addEventListener('mousemove', (event) => {
        const rect = wrapper.getBoundingClientRect();
        const x = event.clientX - rect.left - rect.width / 2;
        const y = event.clientY - rect.top - rect.height / 2;
        const rotX = -(y / (rect.height / 2)) * 18;
        const rotY = (x / (rect.width / 2)) * 18;
        card.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.05)`;
    });

    wrapper.addEventListener('mouseleave', () => {
        card.style.transform = '';
    });
}

/* ── cursor spotlight ──────────────────────────────────────────── */

export function initSpotlight() {
    const spotlight = document.getElementById('cursorSpotlight');
    if (!spotlight || !finePointer()) return;

    let pending = false;
    let x = 0;
    let y = 0;

    document.addEventListener('pointermove', (event) => {
        x = event.clientX;
        y = event.clientY;
        if (pending) return;
        pending = true;
        /* One write per frame instead of one per pointer event, which on a
           high-rate mouse is several layout-affecting writes per frame. */
        requestAnimationFrame(() => {
            spotlight.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
            pending = false;
        });
    });
}
