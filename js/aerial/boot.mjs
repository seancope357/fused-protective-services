import { initialState, clampProgress, timeOfDay, needsFrame } from './state.mjs';
const root = document.documentElement, track = document.getElementById('aerial-track');
const status = document.getElementById('aerial-status'), retry = document.querySelector('[data-action="retry"]');
const motion = matchMedia('(prefers-reduced-motion: reduce)'), fine = matchMedia('(pointer: fine)');
const verify = new URLSearchParams(location.search).get('verify') === '1';
const state = initialState(motion.matches), parallax = { x: 0, y: 0 };
let engine, frame = 0, generation = 0, time = 0, previous = 0;
const qa = {
    ready: false,
    setProgress(u) { state.progress = clampProgress(u); draw(true); },
    setTimeOfDay(value) { state.timeOfDay = timeOfDay(value); syncControls(); draw(true); },
    render: () => draw(true),
    stats: () => engine?.stats() ?? { modelLoaded: false, calls: 0, triangles: 0 },
    context: null,
};
if (verify) window.__aerial = qa;
function draw(snap = false, delta = 1 / 60) {
    // Loading/error states use the static poster. Retain a lighting choice for
    // Retry without compiling or rendering an incomplete/failed scene.
    if (!qa.ready) return;
    engine?.render(state, motion.matches, time, parallax, snap, delta); schedule();
}
function schedule() {
    if (frame || !qa.ready || document.hidden) return;
    if (!needsFrame(state, motion.matches) && !engine?.isSettling()) { previous = 0; return; }
    if (!previous) previous = performance.now();
    frame = requestAnimationFrame(tick);
}
function syncControls() {
    root.dataset.timeOfDay = state.timeOfDay;
    for (const button of document.querySelectorAll('button[data-time-of-day]')) {
        button.setAttribute('aria-pressed', String(button.dataset.timeOfDay === state.timeOfDay));
    }
}
function fail(message, fallback = false) {
    cancelAnimationFrame(frame); frame = 0; previous = 0; qa.ready = false;
    root.dataset.aerialState = fallback ? 'fallback' : 'error';
    status.textContent = message; retry.hidden = false;
}
function tick(now) {
    frame = 0;
    const delta = Math.max((now - previous) / 1000 || 0, 0); previous = now;
    if (!state.paused && !motion.matches) time += Math.min(delta, .05);
    draw(false, delta);
}
function scroll() {
    const runway = track.offsetHeight - innerHeight;
    state.progress = clampProgress(runway > 0 ? (scrollY - track.offsetTop) / runway : 0); draw();
}
async function start() {
    const run = ++generation; cancelAnimationFrame(frame); frame = 0; previous = 0;
    engine?.dispose(); engine = null; qa.ready = false; qa.context = null;
    root.dataset.aerialState = 'loading'; retry.hidden = true; status.textContent = 'Loading scene…';
    const old = document.getElementById('aerial-canvas'), canvas = old.cloneNode(false); old.replaceWith(canvas);
    canvas.addEventListener('webglcontextlost', event => {
        event.preventDefault(); if (run === generation) fail('Graphics context lost. Static preview shown. Retry to restart.');
    });
    try {
        const { createScene } = await import('./scene.mjs');
        if (run !== generation) return;
        try { engine = createScene(canvas, verify); }
        catch { fail('WebGL could not start. Static preview shown. You can still explore and inquire.', true); return; }
        qa.context = engine.context;
        await engine.load(event => {
            if (run === generation) status.textContent = event.lengthComputable && event.total > 0
                ? `Loading scene ${Math.round(event.loaded / event.total * 100)}%` : 'Loading scene…';
        });
        if (run !== generation || engine.context.isContextLost()) return;
        root.dataset.aerialState = 'ready'; qa.ready = true;
        status.textContent = 'Illustrative visualization · Fictional property';
        syncControls(); scroll();
    } catch {
        if (run === generation) fail('Scene asset could not load. Static preview shown. Retry to request the assets again.');
    }
}
document.querySelector('.aerial-controls').addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.dataset.action === 'retry') { start(); return; }
    if (!button.dataset.timeOfDay) return;
    state.timeOfDay = timeOfDay(button.dataset.timeOfDay); syncControls(); draw();
});
window.addEventListener('pointermove', event => {
    if (!fine.matches || motion.matches || state.paused) return;
    parallax.x = event.clientX / innerWidth - .5; parallax.y = event.clientY / innerHeight - .5; draw();
});
window.addEventListener('scroll', scroll, { passive: true });
window.addEventListener('resize', () => { engine?.resize(); scroll(); });
motion.addEventListener('change', () => { state.paused = motion.matches; parallax.x = parallax.y = 0; draw(true); });
document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(frame); frame = 0; previous = 0;
    if (!document.hidden && qa.ready) draw();
});
window.addEventListener('pagehide', () => { generation++; cancelAnimationFrame(frame); frame = 0; previous = 0; engine?.dispose(); });
window.addEventListener('pageshow', event => { if (event.persisted) start(); });
syncControls(); start();
