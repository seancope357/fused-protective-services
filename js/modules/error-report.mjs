/* ==========================================================================
   BROWSER ERROR CAPTURE (SPEC-003)
   ==========================================================================
   Binds `error` and `unhandledrejection` and posts a minimal report to
   /api/client-error, so a script that breaks the intake form in one visitor's
   browser is something we find out about rather than something they phone in
   about.

   WHAT IS SENT, EXHAUSTIVELY: the message, the stack, the page pathname, the
   viewport size and a kind. That is the whole list.

   WHAT IS NEVER SENT: a form field value, the query string, a fragment,
   localStorage, sessionStorage, a cookie, an element's text. There is no code
   here that reads any of them — `location.pathname` is used rather than
   `location.href` precisely so `?formEmail=...` cannot ride along, and both
   the message and the stack are passed through `stripQuery()` because a stack
   frame carries the full page URL. The endpoint then rebuilds the report from
   its own allow-list, so this module being wrong could not leak a field
   either. Two independent reasons a form value cannot arrive is the point.

   The reporter must never become the fault. Everything below is wrapped, the
   response is ignored, and the whole thing is capped per page load so a
   throwing animation frame cannot turn into a network flood.

   Seam for the rest of the page: dispatch `fps:report` on `window` with a
   `detail` of { kind, message, level }. That is how js/logo-forge.js signals a
   WebGL fallback at `info` without importing anything or knowing this exists.
   ========================================================================== */

const ENDPOINT = '/api/client-error';

export const CAPTURE = {
    /* Start at 100%. Premature sampling hides exactly the long tail this is
       for; revisit once there is a week of real volume. */
    sampleRate: 1,
    /* One broken widget is one bug, not forty. Past this a page load goes
       quiet — the first few reports say everything the fortieth would. */
    maxPerPageLoad: 5,
    maxMessage: 500,
    maxStack: 4000
};

/* Matches api/client-error.mjs. Duplicated rather than shared: this runs in a
   browser and that runs in a Vercel function, and the endpoint must not trust
   this copy anyway. Two independent implementations is the safety, not the
   cost. */
const URLISH = /(?:[a-z][a-z0-9+.-]*:\/\/|\/)[^\s'"<>()[\]]*/gi;

/** Removes the query string and fragment from every URL inside a string. */
export const stripQuery = (value) =>
    String(value ?? '').replace(URLISH, (match) => {
        const cut = match.search(/[?#]/);
        return cut === -1 ? match : `${match.slice(0, cut)}?<redacted>`;
    });

/**
 * Builds the payload. Pure, and exported so a test can assert on what would be
 * sent without a network or a DOM.
 * @param {{ kind?: string, message?: unknown, stack?: unknown,
 *           path?: string, width?: number, height?: number }} input
 */
export function buildReport({ kind = 'error', message, stack, path = '/', width, height }) {
    return {
        kind,
        message: stripQuery(message).slice(0, CAPTURE.maxMessage),
        stack: stack ? stripQuery(stack).slice(0, CAPTURE.maxStack) : null,
        /* pathname only. Never href, never search, never hash. */
        path: String(path).split(/[?#]/)[0].slice(0, 200),
        viewportWidth: Number.isFinite(width) ? Math.trunc(width) : null,
        viewportHeight: Number.isFinite(height) ? Math.trunc(height) : null
    };
}

/** Message and stack out of whatever an error event actually carried. */
function describe(value) {
    if (value instanceof Error) return { message: `${value.name}: ${value.message}`, stack: value.stack };
    if (value && typeof value === 'object' && typeof value.message === 'string') {
        return { message: value.message, stack: typeof value.stack === 'string' ? value.stack : null };
    }
    return { message: String(value), stack: null };
}

export function initErrorReport(win = typeof window === 'undefined' ? null : window) {
    if (!win || typeof win.addEventListener !== 'function') return;

    let sent = 0;
    const seen = new Set();

    const post = (payload) => {
        try {
            const body = JSON.stringify(payload);
            /* sendBeacon survives the page being closed, which is when the
               interesting errors happen. keepalive fetch is the fallback; both
               are fire-and-forget and neither response is ever read. */
            if (typeof win.navigator?.sendBeacon === 'function') {
                win.navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
                return;
            }
            win.fetch?.(ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
                keepalive: true
            }).catch(() => { /* reporting a failed report helps nobody */ });
        } catch { /* as above */ }
    };

    const capture = (kind, value) => {
        try {
            if (sent >= CAPTURE.maxPerPageLoad) return;
            if (CAPTURE.sampleRate < 1 && Math.random() >= CAPTURE.sampleRate) return;

            const { message, stack } = describe(value);
            if (!message) return;
            /* The same line throwing on every frame is one report. */
            const fingerprint = `${kind}|${message}`;
            if (seen.has(fingerprint)) return;
            seen.add(fingerprint);
            sent += 1;

            post(buildReport({
                kind,
                message,
                stack,
                path: win.location?.pathname ?? '/',
                width: win.innerWidth,
                height: win.innerHeight
            }));
        } catch { /* the reporter must never become the fault */ }
    };

    win.addEventListener('error', (event) => {
        capture('error', event?.error ?? event?.message ?? 'unknown script error');
    });
    win.addEventListener('unhandledrejection', (event) => {
        capture('unhandledrejection', event?.reason ?? 'unhandled rejection');
    });

    /* The seam. One line anywhere on the page, no import, no load-order
       coupling: window.dispatchEvent(new CustomEvent('fps:report', { detail: {...} })). */
    win.addEventListener('fps:report', (event) => {
        const detail = event?.detail ?? {};
        capture(String(detail.kind || 'signal').replace(/[^a-z0-9_-]/gi, '') || 'signal', detail.message ?? detail);
    });

    /* Safety net for the forge fallback specifically. js/logo-forge.js sets
       data-forge-fallback on <html> when WebGL or three.js is unavailable; if
       the explicit `fps:report` line above is ever missing from that file we
       still learn the rate, just without the reason. The kind is the same, so
       capture()'s own deduplication makes the pair idempotent — whichever
       arrives first is the one that is reported. */
    try {
        const root = win.document?.documentElement;
        if (!root) return;
        const signalFallback = () => capture('forge_fallback', 'the forge fell back to the still emblem');
        if (root.hasAttribute('data-forge-fallback')) {
            signalFallback();
            return;
        }
        if (typeof win.MutationObserver !== 'function') return;
        const observer = new win.MutationObserver(() => {
            if (!root.hasAttribute('data-forge-fallback')) return;
            observer.disconnect();
            signalFallback();
        });
        observer.observe(root, { attributes: true, attributeFilter: ['data-forge-fallback'] });
    } catch { /* an unobservable document is not a reason to break the page */ }
}
