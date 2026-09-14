// ==============================================================================
// Fused Protective Services — browser error sink (/api/client-error)
//
// js/modules/error-report.mjs posts here when a script on the marketing site
// throws or a promise rejects unhandled. The point is to find out that the
// intake form broke in somebody's browser without waiting for them to phone in.
//
// PRIVACY IS THE DESIGN, NOT A FILTER.
// This endpoint builds its output from an allow-list of five fields. Nothing
// else in the body is read, so nothing else can be logged or forwarded — a
// `formEmail` that arrives here is not scrubbed, it is never looked at. Belt
// and braces on top of that: every string that does survive has its query
// strings and fragments cut out, because a stack frame carries the page URL
// and the page URL is exactly where a query string lives.
//
// Nothing is persisted. A report becomes one structured log line at `warn`,
// which is below the alerting threshold, so a browser error storm cannot
// become an email storm whatever the dedupe window is doing.
//
// Failures here are quiet by design. An endpoint that answers an error report
// with an error has taught the page to report its own reporting.
// ==============================================================================

import { cors, parseBody, allowedOrigins } from './_lib/http.mjs';
import { report } from './_lib/report.mjs';

export const LIMITS = {
    message: 500,
    stack: 4000,
    path: 200,
    kind: 40,
    /* A page throwing inside a rAF loop can post thousands of times a second.
       The browser module caps itself per page load; this is the server's own
       cap on one request, past which the body is not even parsed. */
    body: 16 * 1024
};

/* A URL, or something shaped enough like one to be worth cutting: an absolute
   URL, or a root-relative path. Stops at whitespace and at the quotes and
   brackets that wrap a frame, so `(https://host/p?q=x:12:5)` matches the URL
   and not the closing paren. */
const URLISH = /(?:[a-z][a-z0-9+.-]*:\/\/|\/)[^\s'"<>()[\]]*/gi;

/** Removes the query string and fragment from every URL inside a string. */
export const stripQuery = (value) =>
    String(value ?? '').replace(URLISH, (match) => {
        const cut = match.search(/[?#]/);
        return cut === -1 ? match : `${match.slice(0, cut)}?<redacted>`;
    });

/* The path is taken apart rather than trimmed: only `pathname` survives, so
   there is no expression to get subtly wrong and nothing left to leak. */
export function safePath(value) {
    /* Only a string is a path. Anything else stringifies to something that is
       not one — `[object Object]` becomes a plausible-looking `/[object%20Object]`
       — and a made-up path in the log is worse than no path at all. */
    if (typeof value !== 'string') return '/';
    const raw = value.trim().slice(0, LIMITS.path * 4);
    if (!raw) return '/';
    try {
        return new URL(raw, 'https://x.invalid').pathname.slice(0, LIMITS.path);
    } catch {
        return '/';
    }
}

const dimension = (value) => {
    const n = Math.trunc(Number(value));
    return Number.isFinite(n) && n > 0 ? Math.min(n, 20000) : null;
};

/**
 * The allow-list. Five fields in, five fields out; every other key in the body
 * is invisible to everything downstream.
 * @returns {{ kind: string, message: string, stack: string|null, path: string,
 *             viewport: string|null } | null} null when there is nothing to report.
 */
export function sanitise(body) {
    const message = stripQuery(body?.message).trim().slice(0, LIMITS.message);
    if (!message) return null;
    const stack = stripQuery(body?.stack).trim().slice(0, LIMITS.stack);
    const w = dimension(body?.viewportWidth);
    const h = dimension(body?.viewportHeight);
    return {
        kind: String(body?.kind ?? 'error').replace(/[^a-z0-9_-]/gi, '').slice(0, LIMITS.kind) || 'error',
        message,
        stack: stack || null,
        path: safePath(body?.path),
        viewport: w && h ? `${w}x${h}` : null
    };
}

/* `info` is the forge fallback (SPEC-003 design 3a): a fact about the world,
   not a fault, and explicitly not alertable. Everything else is a real script
   failure and lands at `warn` — worth a log line, never worth an email. */
const severityFor = (kind) => (kind === 'forge_fallback' ? 'info' : 'warn');

export default async function handler(req, res) {
    if (!cors(req, res)) return;
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method_not_allowed' });

    /* Same-origin only. cors() reflects the header for origins we trust but
       still lets the request proceed, because plenty of legitimate requests
       carry no Origin. This endpoint is stricter: it is only ever called by
       our own fetch and sendBeacon, both of which send Origin on a POST, so an
       absent or foreign Origin is not our page and is not answered. */
    const origin = req.headers.origin;
    if (!origin || !allowedOrigins().has(origin)) {
        return res.status(403).json({ ok: false, error: 'forbidden_origin' });
    }

    /* Oversized bodies are refused rather than truncated: half a JSON document
       is a worse thing to reason about than a rejected one, and the browser
       module keeps itself an order of magnitude under this. */
    if (Number(req.headers['content-length'] || 0) > LIMITS.body) {
        return res.status(413).json({ ok: false, error: 'payload_too_large' });
    }

    let body;
    try {
        body = parseBody(req);
    } catch {
        return res.status(400).json({ ok: false, error: 'malformed_json' });
    }
    if (JSON.stringify(body ?? null).length > LIMITS.body) {
        return res.status(413).json({ ok: false, error: 'payload_too_large' });
    }

    const clean = sanitise(body);
    if (!clean) return res.status(400).json({ ok: false, error: 'empty_report' });

    /* Reported as a plain object rather than an Error: the interesting stack
       is the browser's, and it travels in the context. Manufacturing an Error
       here would attach this file's stack, which tells nobody anything.

       The user agent comes off the request and never out of the body. The
       request already carries it, and a body field would be one more place a
       caller could put an address. */
    await report({ message: clean.message }, {
        severity: severityFor(clean.kind),
        source: `browser/${clean.kind}`,
        context: {
            path: clean.path,
            viewport: clean.viewport,
            userAgent: String(req.headers['user-agent'] ?? '').slice(0, 300) || null,
            stack: clean.stack
        }
    });

    /* 202: received, nothing to say about it. The page ignores this. */
    return res.status(202).json({ ok: true });
}
