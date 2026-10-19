import { initialState, rotate, clampProgress, exitInspection, sensorTarget, needsFrame } from './state.mjs';
const root = document.documentElement, track = document.getElementById('aerial-track');
const status = document.getElementById('aerial-status'), retry = document.querySelector('[data-action="retry"]');
const motion = matchMedia('(prefers-reduced-motion: reduce)'), fine = matchMedia('(pointer: fine)');
const verify = new URLSearchParams(location.search).get('verify') === '1';
const state = initialState(motion.matches), parallax = { x: 0, y: 0 };
let engine, frame = 0, generation = 0, time = 0, previous = 0, sensorAmount = 0, drag = null;
const qa = { ready: false, setProgress(u) { state.progress = clampProgress(u); sensorAmount = sensorTarget(state.progress, state.sensor); syncControls(); draw(true); }, setSensor(value) { state.sensor = Boolean(value); sensorAmount = Number(state.sensor); syncControls(); draw(true); }, render: () => draw(true), stats: () => engine?.stats() ?? { modelLoaded: false, calls: 0, triangles: 0 }, context: null };
if (verify) window.__aerial = qa;
// Input draws are synchronous. RAF exists only for autonomous hover/scan or a
// pending view transition; visibility, failure and teardown cancel it entirely.
function draw(snap = false, delta = 1 / 60) { engine?.render(state, motion.matches, time, sensorAmount, parallax, snap, delta); schedule(); }
function schedule() {
    if (frame || !qa.ready || document.hidden) return;
    if (!needsFrame(state, motion.matches, sensorAmount) && !engine?.isSettling()) { previous = 0; return; }
    if (!previous) previous = performance.now();
    frame = requestAnimationFrame(tick);
}
function syncControls() {
    for (const action of ['sensor', 'pause', 'inspect']) document.querySelector(`[data-action="${action}"]`).setAttribute('aria-pressed', String(action === 'sensor' ? sensorTarget(state.progress, state.sensor) > .5 : state[action === 'pause' ? 'paused' : action]));
    document.querySelector('[data-action="pause"]').textContent = state.paused ? 'Resume' : 'Pause';
    document.querySelector('[data-action="sensor"]').textContent = 'Sensor view';
    document.getElementById('aerial-inspect').hidden = !state.inspect;
    root.dataset.inspecting = String(state.inspect);
}
function fail(message, fallback = false) {
    cancelAnimationFrame(frame); frame = 0; previous = 0; qa.ready = false; root.dataset.aerialState = fallback ? 'fallback' : 'error';
    status.textContent = message; retry.hidden = false; state.inspect = false; syncControls();
    document.querySelectorAll('.aerial-toolbar button').forEach(button => { button.disabled = true; });
}
function tick(now) {
    frame = 0;
    const delta = Math.max((now - previous) / 1000 || 0, 0); previous = now;
    if (!state.paused && !motion.matches) time += Math.min(delta, .05);
    const target = sensorTarget(state.progress, state.sensor);
    sensorAmount += (target - sensorAmount) * (1 - Math.exp(-delta * 8));
    if (Math.abs(target - sensorAmount) < .001) sensorAmount = target;
    draw(false, delta);
}
function scroll() {
    const runway = track.offsetHeight - innerHeight;
    state.progress = clampProgress(runway > 0 ? (scrollY - track.offsetTop) / runway : 0); syncControls(); if (motion.matches) sensorAmount = sensorTarget(state.progress, state.sensor); draw();
}
async function start() {
    const run = ++generation; cancelAnimationFrame(frame); frame = 0; previous = 0; engine?.dispose(); engine = null; qa.ready = false; qa.context = null;
    root.dataset.aerialState = 'loading'; retry.hidden = true; status.textContent = 'Loading aircraft…';
    // A fresh canvas makes Retry effective even after an unrecoverable lost context.
    const old = document.getElementById('aerial-canvas'), canvas = old.cloneNode(false); old.replaceWith(canvas);
    canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); if (run === generation) fail('Graphics context lost. Static preview shown. Retry to restart.'); });
    try {
        const { createScene } = await import('./scene.mjs');
        if (run !== generation) return;
        try { engine = createScene(canvas, verify); } catch (error) { fail('WebGL could not start. Static preview shown. You can still explore and inquire.', true); return; }
        qa.context = engine.context;
        await engine.load(event => { if (run === generation) status.textContent = event.lengthComputable && event.total > 0 ? `Loading aircraft ${Math.round(event.loaded / event.total * 100)}%` : 'Loading aircraft…'; });
        if (run !== generation || engine.context.isContextLost()) return;
        root.dataset.aerialState = 'ready'; qa.ready = true; status.textContent = 'Illustrative visualization · Fictional property';
        document.querySelectorAll('.aerial-toolbar button').forEach(button => { button.disabled = false; });
        syncControls(); scroll();
    } catch (error) {
        if (run === generation) fail('Scene asset could not load. Static preview shown. Retry to request the assets again.');
    }
}
function turn(x, y) { if (!state.inspect) return; Object.assign(state, rotate(state, x, y)); draw(); }
document.querySelector('.aerial-controls').addEventListener('click', event => {
    const button = event.target.closest('button[data-action]'); if (!button || button.disabled) return;
    switch (button.dataset.action) {
        case 'retry': start(); return;
        case 'sensor': state.sensor = sensorTarget(state.progress, state.sensor) < .5; if (motion.matches) sensorAmount = sensorTarget(state.progress, state.sensor); break;
        case 'pause': state.paused = !state.paused; break;
        case 'inspect': if (state.inspect) { Object.assign(state, exitInspection(state)); drag = null; parallax.x = parallax.y = 0; } else { state.inspect = true; parallax.x = parallax.y = 0; } break;
        case 'reset': state.yaw = state.pitch = 0; break;
        case 'rotate-left': turn(-.08, 0); break;
        case 'rotate-right': turn(.08, 0); break;
        case 'rotate-up': turn(0, -.06); break;
        case 'rotate-down': turn(0, .06); break;
    }
    syncControls(); draw();
});
document.addEventListener('keydown', event => {
    if (!state.inspect) return;
    if (event.key === 'Escape') { Object.assign(state, exitInspection(state)); drag = null; parallax.x = parallax.y = 0; if (motion.matches) sensorAmount = sensorTarget(state.progress, state.sensor); syncControls(); draw(true); document.querySelector('[data-action="inspect"]').focus(); return; }
    if (!event.target.closest('.aerial-controls, .aerial-stage') || event.target.closest('input, textarea, select, [contenteditable], [role="slider"], [role="textbox"]')) return;
    const directions = { ArrowLeft: [-.08, 0], ArrowRight: [.08, 0], ArrowUp: [0, -.06], ArrowDown: [0, .06] };
    if (directions[event.key]) { event.preventDefault(); turn(...directions[event.key]); }
    if (event.key.toLowerCase() === 'r') { state.yaw = state.pitch = 0; draw(); }
});
const stage = document.querySelector('.aerial-stage');
stage.addEventListener('pointerdown', event => { if (state.inspect) { drag = { x: event.clientX, y: event.clientY }; stage.setPointerCapture(event.pointerId); } });
stage.addEventListener('pointermove', event => {
    if (!drag || !state.inspect) return;
    turn((event.clientX - drag.x) * -.003, (event.clientY - drag.y) * -.003); drag = { x: event.clientX, y: event.clientY };
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) stage.addEventListener(type, () => { drag = null; });
window.addEventListener('pointermove', event => {
    if (!fine.matches || motion.matches || state.inspect || state.paused) return;
    parallax.x = event.clientX / innerWidth - .5; parallax.y = event.clientY / innerHeight - .5; draw();
});
window.addEventListener('scroll', scroll, { passive: true });
window.addEventListener('resize', () => { engine?.resize(); scroll(); });
motion.addEventListener('change', () => { state.paused = motion.matches; parallax.x = parallax.y = 0; if (motion.matches) sensorAmount = sensorTarget(state.progress, state.sensor); syncControls(); draw(); });
document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(frame); frame = 0; previous = 0;
    if (!document.hidden && qa.ready) draw();
});
window.addEventListener('pagehide', () => { generation++; cancelAnimationFrame(frame); frame = 0; previous = 0; engine?.dispose(); });
window.addEventListener('pageshow', event => { if (event.persisted) start(); });
syncControls(); start();
