// ==============================================================================
// HTTP helpers shared by the Vercel functions in api/. Files under api/_lib are
// not deployed as functions (the underscore prefix excludes them); they are
// bundled into whichever function imports them.
// ==============================================================================

import { site } from '../../src/data/site.mjs';

/* Origins allowed to call the API from a browser. The forms post same-origin,
   so in practice this only matters for a preview deployment calling itself:
   Vercel exposes its own hostnames, and those are allowed alongside the site. */
export function allowedOrigins() {
    const origins = new Set([site.url]);
    for (const host of site.productionHosts) origins.add(`https://${host}`);
    for (const key of ['VERCEL_URL', 'VERCEL_BRANCH_URL', 'VERCEL_PROJECT_PRODUCTION_URL']) {
        if (process.env[key]) origins.add(`https://${process.env[key]}`);
    }
    if (process.env.NODE_ENV !== 'production') {
        origins.add('http://localhost:5050');
        origins.add('http://127.0.0.1:5050');
    }
    return origins;
}

/** Sets CORS headers for the site's own origins only. Returns true when the
    request should proceed, false when it was a preflight already answered. */
export function cors(req, res, { methods = 'POST, OPTIONS' } = {}) {
    const origin = req.headers.origin;
    if (origin && allowedOrigins().has(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', methods);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return false;
    }
    return true;
}

/** Parses a JSON body regardless of whether Vercel pre-parsed it. Throws on
    malformed JSON so the caller can answer 400. */
export function parseBody(req) {
    if (typeof req.body === 'string') return JSON.parse(req.body || '{}');
    return req.body || {};
}

/** Best-effort client address. Vercel sets x-forwarded-for; the first entry
    is the caller. Falls back to the socket when running under serve.py. */
export function clientIp(req) {
    const header = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '';
    const first = String(header).split(',')[0].trim();
    return first || req.socket?.remoteAddress || 'unknown';
}

export const text = (value, max = 500) =>
    (value == null ? '' : String(value)).trim().slice(0, max);

export const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[ch]);
