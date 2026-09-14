/* ==========================================================================
   /api/client-error and js/modules/error-report.mjs under node --test.

   The adversarial half of this file is deliberate. "No PII" is easy to assert
   for a payload nobody tried to poison, so the payloads below try: a form
   field posted as a sibling key, an email address hidden in the query string
   of a URL inside a stack frame, a fragment, a full href where a path was
   expected. Each one has to come out the other side with the address gone.
   ========================================================================== */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import handler, { sanitise, stripQuery, safePath, LIMITS } from '../api/client-error.mjs';
import { buildReport, initErrorReport, CAPTURE } from '../js/modules/error-report.mjs';
import { resetAlertGate } from '../api/_lib/report.mjs';
import { makeReq, makeRes, stubFetch, withEnv } from './helpers/http.mjs';

const CLEAR = {
    SUPABASE_URL: undefined,
    SUPABASE_SERVICE_ROLE_KEY: undefined,
    RESEND_API_KEY: undefined,
    DISPATCH_ALERT_TO: undefined,
    DISPATCH_ALERT_FROM: undefined,
    OPS_ALERT_TO: undefined,
    INTAKE_HASH_SALT: 'test-salt',
    VERCEL_ENV: 'production',
    VERCEL_URL: undefined,
    VERCEL_BRANCH_URL: undefined,
    VERCEL_PROJECT_PRODUCTION_URL: undefined,
    NODE_ENV: 'test'
};

let env;
before(() => { env = withEnv(CLEAR); });
after(() => env.restore());

/* The address that must never survive, in every shape an attacker or an
   accident could get it here. */
const VICTIM = 'victim@example.com';

/** Runs the handler with console.error captured; returns the structured lines. */
async function post(body, { headers = {}, method = 'POST' } = {}) {
    resetAlertGate();
    const lines = [];
    const originalError = console.error;
    console.error = (...args) => lines.push(args.map(String).join(' '));
    const f = stubFetch(() => null);
    const res = makeRes();
    try {
        await handler(makeReq({ method, body, headers }), res);
    } finally {
        console.error = originalError;
        f.restore();
    }
    const records = lines.flatMap((line) => {
        try { return [JSON.parse(line)]; } catch { return []; }
    });
    return { res, lines, records, calls: f.calls };
}

/* ---------- Acceptance 6: same-origin only ---------- */

test('a same-origin well-formed report is accepted and becomes one structured line', async () => {
    const { res, records } = await post({
        kind: 'error',
        message: 'TypeError: cannot read properties of null',
        stack: 'at initQuoteForm (https://fusedprotectiveservices.com/js/app.mjs:12:5)',
        path: '/',
        viewportWidth: 1440,
        viewportHeight: 900
    }, { headers: { 'user-agent': 'Mozilla/5.0 (Test)' } });

    assert.equal(res.statusCode, 202);
    assert.deepEqual(res.body, { ok: true });
    assert.equal(records.length, 1);
    assert.equal(records[0].severity, 'warn', 'a browser error is never an alert');
    assert.equal(records[0].source, 'browser/error');
    assert.equal(records[0].message, 'TypeError: cannot read properties of null');
    assert.deepEqual(records[0].context, {
        path: '/',
        viewport: '1440x900',
        userAgent: 'Mozilla/5.0 (Test)',
        stack: 'at initQuoteForm (https://fusedprotectiveservices.com/js/app.mjs:12:5)'
    });
});

test('a cross-origin report is rejected outright', async () => {
    for (const origin of ['https://evil.example', 'https://fusedprotectiveservices.com.evil.example', 'null']) {
        const { res, records } = await post({ message: 'boom' }, { headers: { origin } });
        assert.equal(res.statusCode, 403, origin);
        assert.equal(res.body.error, 'forbidden_origin', origin);
        assert.equal(records.length, 0, `${origin} produced no record at all`);
    }
});

test('a report with no Origin at all is rejected: our own page always sends one', async () => {
    const res = makeRes();
    const f = stubFetch(() => null);
    const req = makeReq({ body: { message: 'boom' } });
    delete req.headers.origin;
    await handler(req, res);
    f.restore();
    assert.equal(res.statusCode, 403);
});

test('a preflight is answered without reflecting a foreign origin', async () => {
    const f = stubFetch(() => null);
    const res = makeRes();
    await handler(makeReq({ method: 'OPTIONS', headers: { origin: 'https://evil.example' } }), res);
    const ours = makeRes();
    await handler(makeReq({ method: 'OPTIONS' }), ours);
    f.restore();
    assert.equal(res.statusCode, 204);
    assert.equal(res.headers['access-control-allow-origin'], undefined);
    assert.equal(ours.headers['access-control-allow-origin'], 'https://fusedprotectiveservices.com');
});

test('anything but POST is refused', async () => {
    const { res } = await post({ message: 'x' }, { method: 'GET' });
    assert.equal(res.statusCode, 405);
});

/* ---------- Acceptance 6: never a form value, never a query string ---------- */

test('a formEmail-shaped field posted alongside the report is never read', async () => {
    const { res, records, lines } = await post({
        message: 'Submission failed',
        stack: 'at submit (https://fusedprotectiveservices.com/js/modules/quote-form.mjs:31:9)',
        path: '/',
        /* Everything a well-meaning or malicious caller might attach. */
        formEmail: VICTIM,
        formPhone: '+15125550100',
        formName: 'A Real Person',
        appEmail: VICTIM,
        email: VICTIM,
        localStorage: { 'fps-invoice-draft': VICTIM },
        cookie: 'session=abc',
        href: `https://fusedprotectiveservices.com/?formEmail=${encodeURIComponent(VICTIM)}`,
        search: `?formEmail=${VICTIM}`
    });

    assert.equal(res.statusCode, 202);
    assert.equal(records.length, 1);

    /* The strongest form of the assertion: the address appears nowhere in
       anything this request produced, in any encoding. */
    const everything = lines.join('\n');
    assert.doesNotMatch(everything, /victim/i);
    assert.doesNotMatch(everything, /5125550100/);
    assert.doesNotMatch(everything, /A Real Person/);
    assert.doesNotMatch(everything, /session=abc/);

    /* And the record carries only the five allowed fields. */
    assert.deepEqual(Object.keys(records[0].context).sort(), ['path', 'stack', 'userAgent', 'viewport']);
});

test('an address hidden in the query string of a stack frame does not survive', async () => {
    const { records, lines } = await post({
        message: `Failed to fetch https://fusedprotectiveservices.com/api/intake?formEmail=${VICTIM}`,
        stack: [
            `at submit (https://fusedprotectiveservices.com/?formEmail=${VICTIM}&utm_source=x:31:9)`,
            `at HTMLFormElement.<anonymous> (https://fusedprotectiveservices.com/careers.html#appEmail=${VICTIM}:12:1)`
        ].join('\n'),
        path: `/careers.html?formEmail=${VICTIM}#section`
    });

    assert.doesNotMatch(lines.join('\n'), /victim/i, 'not in the message, not in the stack, not in the path');
    assert.equal(records[0].context.path, '/careers.html', 'the pathname, and nothing else');
    assert.match(records[0].message, /\?<redacted>$/);
    assert.match(records[0].context.stack, /fusedprotectiveservices\.com\/\?<redacted>/);
    assert.doesNotMatch(records[0].context.stack, /utm_source/);
});

test('stripQuery keeps the useful half of a URL and drops the rest', () => {
    assert.equal(stripQuery('at f (https://host/js/app.mjs:1:2)'), 'at f (https://host/js/app.mjs:1:2)');
    assert.equal(stripQuery('https://host/p?a=1'), 'https://host/p?<redacted>');
    assert.equal(stripQuery('https://host/p#frag'), 'https://host/p?<redacted>');
    assert.equal(stripQuery('/quote?formEmail=a@b.c'), '/quote?<redacted>');
    /* Prose is not a URL, and a question mark in a sentence is not a query. */
    assert.equal(stripQuery('why did this fail?'), 'why did this fail?');
    assert.equal(stripQuery(null), '');
});

test('safePath reduces anything at all to a pathname', () => {
    assert.equal(safePath('/careers.html?x=1#y'), '/careers.html');
    assert.equal(safePath('https://evil.example/steal?q=1'), '/steal');
    assert.equal(safePath(''), '/');
    assert.equal(safePath(undefined), '/');
    assert.equal(safePath({}), '/');
});

/* ---------- Acceptance 6: truncation ---------- */

test('an oversized payload is refused rather than half-parsed', async () => {
    const huge = 'x'.repeat(LIMITS.body + 1);
    const byHeader = await post({ message: 'a' }, { headers: { 'content-length': String(LIMITS.body + 1) } });
    assert.equal(byHeader.res.statusCode, 413);

    const byBody = await post({ message: 'a', stack: huge });
    assert.equal(byBody.res.statusCode, 413);
    assert.equal(byBody.records.length, 0);
});

test('an over-long message and stack inside the cap are truncated, not rejected', async () => {
    const { res, records } = await post({
        message: 'm'.repeat(LIMITS.message + 400),
        stack: 's'.repeat(LIMITS.stack + 2000),
        path: `/${'p'.repeat(LIMITS.path + 200)}`
    });
    assert.equal(res.statusCode, 202);
    assert.equal(records[0].message.length, LIMITS.message);
    assert.equal(records[0].context.stack.length, LIMITS.stack);
    assert.equal(records[0].context.path.length, LIMITS.path);
});

test('a report with nothing in it is refused rather than logged as an empty error', async () => {
    for (const body of [{}, { message: '   ' }, { message: null }, { kind: 'error' }]) {
        const { res, records } = await post(body);
        assert.equal(res.statusCode, 400, JSON.stringify(body));
        assert.equal(res.body.error, 'empty_report');
        assert.equal(records.length, 0);
    }
});

test('malformed JSON is a 400, not a crash', async () => {
    const f = stubFetch(() => null);
    const res = makeRes();
    await handler(makeReq({ body: '{ not json' }), res);
    f.restore();
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.error, 'malformed_json');
});

test('a hostile kind cannot become a log-injection or a path', () => {
    assert.equal(sanitise({ message: 'x', kind: '../../etc/passwd' }).kind, 'etcpasswd');
    assert.equal(sanitise({ message: 'x', kind: '' }).kind, 'error');
    assert.equal(sanitise({ message: 'x', kind: '\n"severity":"fatal"' }).kind, 'severityfatal');
});

test('a nonsense viewport is dropped rather than reported as a size', () => {
    assert.equal(sanitise({ message: 'x', viewportWidth: -5, viewportHeight: 900 }).viewport, null);
    assert.equal(sanitise({ message: 'x', viewportWidth: 'wide', viewportHeight: 900 }).viewport, null);
    assert.equal(sanitise({ message: 'x', viewportWidth: 1e9, viewportHeight: 1e9 }).viewport, '20000x20000');
});

/* ---------- Design 3a: the forge fallback is information, not a fault ---------- */

test('a forge fallback is reported at info and never alerts', async () => {
    const { res, records } = await post({ kind: 'forge_fallback', message: 'three.js did not load', path: '/' });
    assert.equal(res.statusCode, 202);
    assert.equal(records[0].severity, 'info');
    assert.equal(records[0].source, 'browser/forge_fallback');
});

test('even a fatal-looking browser report cannot email: the endpoint chooses the severity', async () => {
    const e = withEnv({
        RESEND_API_KEY: 'k',
        DISPATCH_ALERT_FROM: 'Fused Dispatch <dispatch@fusedprotectiveservices.com>',
        OPS_ALERT_TO: 'ops@example.com'
    });
    const { res, calls } = await post({ message: 'boom', severity: 'fatal', kind: 'error' });
    e.restore();
    assert.equal(res.statusCode, 202);
    assert.equal(calls.filter((c) => c.url === 'https://api.resend.com/emails').length, 0);
});

/* ---------- The browser half ---------- */

test('buildReport sends the five allowed fields and nothing else', () => {
    const payload = buildReport({
        kind: 'error',
        message: 'TypeError: x',
        stack: `at f (https://host/p?formEmail=${VICTIM}:1:2)`,
        path: `/quote?formEmail=${VICTIM}#top`,
        width: 390.7,
        height: 844
    });
    assert.deepEqual(Object.keys(payload).sort(),
        ['kind', 'message', 'path', 'stack', 'viewportHeight', 'viewportWidth']);
    assert.equal(payload.path, '/quote', 'pathname only, before it ever leaves the browser');
    assert.doesNotMatch(JSON.stringify(payload), /victim/i);
    assert.equal(payload.viewportWidth, 390);
});

/* A DOM small enough to be obviously right, and real enough to prove the
   module binds what it says it binds and stops when it says it stops. */
function fakeWindow() {
    const listeners = new Map();
    const attributes = new Set();
    const beacons = [];
    return {
        beacons,
        listeners,
        attributes,
        innerWidth: 1280,
        innerHeight: 720,
        location: { pathname: '/', href: 'https://fusedprotectiveservices.com/?formEmail=leak@example.com' },
        navigator: {
            sendBeacon: (url, blob) => { beacons.push({ url, blob }); return true; }
        },
        document: {
            documentElement: {
                hasAttribute: (name) => attributes.has(name),
                setAttribute: (name) => attributes.add(name)
            }
        },
        MutationObserver: class { observe() {} disconnect() {} },
        addEventListener(type, fn) { listeners.set(type, fn); },
        emit(type, event) { listeners.get(type)?.(event); }
    };
}

test('the browser module binds error and unhandledrejection and posts a beacon', async () => {
    const win = fakeWindow();
    initErrorReport(win);
    assert.deepEqual([...win.listeners.keys()].sort(), ['error', 'fps:report', 'unhandledrejection']);

    win.emit('error', { error: new TypeError('widget exploded') });
    win.emit('unhandledrejection', { reason: new Error('a promise nobody caught') });
    assert.equal(win.beacons.length, 2);
    assert.equal(win.beacons[0].url, '/api/client-error');

    const payload = JSON.parse(await win.beacons[0].blob.text());
    assert.equal(payload.kind, 'error');
    assert.equal(payload.message, 'TypeError: widget exploded');
    assert.equal(payload.path, '/', 'the pathname, never location.href');
    assert.doesNotMatch(JSON.stringify(payload), /leak@example\.com/);
});

test('the same error on every frame is one report, and a page load is capped', async () => {
    const win = fakeWindow();
    initErrorReport(win);
    for (let i = 0; i < 500; i++) win.emit('error', { error: new Error('rAF loop') });
    assert.equal(win.beacons.length, 1, 'repeated identical errors are one report');

    for (let i = 0; i < 500; i++) win.emit('error', { error: new Error(`distinct ${i}`) });
    assert.equal(win.beacons.length, CAPTURE.maxPerPageLoad, 'and a page load stops at the cap');
});

test('the fps:report seam carries a signal without an import or a load order', async () => {
    const win = fakeWindow();
    initErrorReport(win);
    win.emit('fps:report', { detail: { kind: 'forge_fallback', message: 'three.js did not load from any known host' } });
    assert.equal(win.beacons.length, 1);
    const payload = JSON.parse(await win.beacons[0].blob.text());
    assert.equal(payload.kind, 'forge_fallback');
    assert.match(payload.message, /three\.js did not load/);
});

test('a forge fallback already on the page at startup is still reported', async () => {
    const win = fakeWindow();
    win.attributes.add('data-forge-fallback');
    initErrorReport(win);
    assert.equal(win.beacons.length, 1);
    assert.equal(JSON.parse(await win.beacons[0].blob.text()).kind, 'forge_fallback');
});

test('a broken transport inside the browser module never reaches the page', () => {
    const win = fakeWindow();
    win.navigator.sendBeacon = () => { throw new Error('beacon exploded'); };
    win.fetch = () => { throw new Error('fetch exploded'); };
    initErrorReport(win);
    assert.doesNotThrow(() => win.emit('error', { error: new Error('the original bug') }));
});

test('initErrorReport does nothing at all without a window', () => {
    assert.doesNotThrow(() => initErrorReport(null));
    assert.doesNotThrow(() => initErrorReport({}));
});
