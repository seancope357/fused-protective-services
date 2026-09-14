/* ==========================================================================
   SPEC-006 — the marketing site's Content-Security-Policy.

   The policy is generated, because part of it is derived from src/: script-src
   carries a sha256 for every inline <script> block, and those blocks are
   serialized straight out of src/data. A stale hash does not break loudly —
   the page keeps rendering, because the blocks it covers are inert JSON, and
   only the policy quietly stops describing the document. These tests are what
   notices.

   They also guard the two halves of the self-hosting that made the policy
   possible in the first place: a vendored three.js and ten woff2 files that
   nothing regenerates and that no other test would miss.

   No network, no clock, no environment — everything here is a readFileSync
   away, in keeping with the rest of tests/.
   ========================================================================== */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

const GENERATED_PAGES = ['index.html', 'careers.html', 'invoice.html', 'privacy.html', 'terms.html', 'sms-consent.html'];

/** The header set vercel.json applies to every path, as a plain object. */
function productionHeaders() {
    const config = JSON.parse(read('vercel.json'));
    const rule = config.headers.find((h) => h.source === '/(.*)');
    assert.ok(rule, "vercel.json must carry a '/(.*)' rule — the policy is meant to cover every page");
    return Object.fromEntries(rule.headers.map(({ key, value }) => [key, value]));
}

/** The CSP parsed into directive -> [values]. */
function policy() {
    const csp = productionHeaders()['Content-Security-Policy'];
    assert.ok(csp, 'vercel.json sends no Content-Security-Policy');
    return Object.fromEntries(
        csp.split(';').map((part) => {
            const [name, ...values] = part.trim().split(/\s+/);
            return [name, values];
        })
    );
}

/** Every inline <script> body in a page — i.e. the ones a hash must cover.
    Matches build.mjs's own extraction; if the two ever disagree, the
    "every block is covered" test below is what says so. */
function inlineScripts(html) {
    const found = [];
    for (const [, attrs, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
        if (!/\ssrc\s*=/.test(attrs)) found.push(body);
    }
    return found;
}

const hashOf = (text) => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;

/* ── the directive set ───────────────────────────────────────────────────── */

test('the policy is exactly the directive set SPEC-006 specifies', () => {
    const p = policy();

    assert.deepEqual(p['default-src'], ["'self'"]);
    assert.deepEqual(p['style-src'], ["'self'"]);
    assert.deepEqual(p['img-src'], ["'self'", 'data:']);
    assert.deepEqual(p['font-src'], ["'self'"]);
    assert.deepEqual(p['connect-src'], ["'self'"]);
    assert.deepEqual(p['form-action'], ["'self'"]);
    assert.deepEqual(p['frame-ancestors'], ["'none'"]);
    assert.deepEqual(p['base-uri'], ["'none'"]);
    assert.deepEqual(p['object-src'], ["'none'"]);
    assert.deepEqual(p['upgrade-insecure-requests'], []);

    /* script-src is 'self' plus hashes and nothing else. No host, no scheme,
       no keyword — the whole point of vendoring three.js was that this line
       needs no exception. */
    const script = p['script-src'];
    assert.equal(script[0], "'self'");
    for (const value of script.slice(1)) {
        assert.match(value, /^'sha256-[A-Za-z0-9+/]+={0,2}'$/, `script-src carries ${value}, which is not a sha256 hash`);
    }

    /* Nothing was added or dropped while nobody was looking. */
    assert.deepEqual(Object.keys(p).sort(), [
        'base-uri', 'connect-src', 'default-src', 'font-src', 'form-action',
        'frame-ancestors', 'img-src', 'object-src', 'script-src', 'style-src',
        'upgrade-insecure-requests'
    ]);
});

test("the policy contains no unsafe-* escape hatch", () => {
    const csp = productionHeaders()['Content-Security-Policy'];
    for (const token of ["'unsafe-inline'", "'unsafe-eval'", "'unsafe-hashes'", "'strict-dynamic'", '*']) {
        assert.ok(!csp.includes(token), `the policy contains ${token}`);
    }
});

test('HSTS and X-Frame-Options agree with the policy', () => {
    const headers = productionHeaders();

    assert.equal(headers['Strict-Transport-Security'], 'max-age=63072000; includeSubDomains; preload');
    /* SAMEORIGIN beside frame-ancestors 'none' is a contradiction: one says
       nobody may frame this, the other says we may. DENY is the agreeing
       answer, and it is the one older browsers that ignore frame-ancestors
       will act on. */
    assert.equal(headers['X-Frame-Options'], 'DENY');
    assert.equal(headers['X-Content-Type-Options'], 'nosniff');
    assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
    assert.equal(headers['Permissions-Policy'], 'geolocation=(), microphone=(), camera=()');
});

/* ── the hashes actually cover the markup ────────────────────────────────── */

test('every inline <script> in every generated page has a matching hash', () => {
    const allowed = new Set(policy()['script-src'].slice(1));
    let covered = 0;

    for (const file of GENERATED_PAGES) {
        for (const body of inlineScripts(read(file))) {
            const hash = hashOf(body);
            assert.ok(
                allowed.has(hash),
                `${file} carries an inline <script> whose hash ${hash} is not in script-src. ` +
                'Run `node build.mjs` and commit vercel.json with the markup.'
            );
            covered++;
        }
    }

    /* If this ever reads 0 the assertions above are vacuous — the JSON-LD
       graph and the #fps-config island are not optional parts of the site. */
    assert.ok(covered >= 5, `expected at least 5 inline blocks across the pages, found ${covered}`);
});

test('script-src carries no hash that no page actually uses', () => {
    const used = new Set(GENERATED_PAGES.flatMap((f) => inlineScripts(read(f)).map(hashOf)));
    for (const hash of policy()['script-src'].slice(1)) {
        assert.ok(used.has(hash), `script-src allows ${hash}, which no generated page contains`);
    }
});

/* ── nothing is fetched from a third party ───────────────────────────────── */

test('no generated page or stylesheet fetches from a third-party host', () => {
    /* The portal link (app.fusedprotectiveservices.com) is a navigation, not a
       subresource, and https://schema.org is a JSON-LD @context — a string
       identifier that is never dereferenced. Both are fine. What must not
       survive is anything the browser would actually go and fetch. */
    const banned = /https?:\/\/(cdn\.jsdelivr\.net|unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com)/;

    for (const file of [...GENERATED_PAGES, 'css/site.css', 'css/invoice.css', 'css/noscript.css']) {
        assert.doesNotMatch(read(file), banned, `${file} still names a third-party host`);
    }
});

test('no source file points the browser at a CDN either', () => {
    /* js/vendor/ is excluded on purpose: the vendored file's header records
       the exact URL it was downloaded from, which is the provenance SPEC-006
       asks for and the opposite of a live dependency. assets/fonts/SOURCES.txt
       is excluded for the same reason. */
    const banned = /https?:\/\/(cdn\.jsdelivr\.net|unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)/;
    const files = [];
    const walk = (dir, skip = []) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            if (skip.includes(entry.name)) continue;
            const full = join(dir, entry.name);
            if (entry.isDirectory()) walk(full, skip);
            else if (/\.(mjs|js|css)$/.test(entry.name)) files.push(full);
        }
    };
    walk(join(ROOT, 'src'));
    walk(join(ROOT, 'js'), ['vendor']);

    for (const file of files) {
        assert.doesNotMatch(readFileSync(file, 'utf8'), banned, `${file.replace(ROOT + '/', '')} still names a CDN`);
    }
});

test('js/logo-forge.js imports three.js from a same-origin path', () => {
    const forge = read('js/logo-forge.js');
    assert.match(forge, /^import \* as THREE from '\.\/vendor\/three\.module\.js';$/m,
        'logo-forge must import the vendored module');
    assert.ok(!/THREE_SOURCES|loadThree/.test(forge), 'the two-host CDN loader is still present');
});

test('the pages carry no inline style, which is what lets style-src be self', () => {
    for (const file of GENERATED_PAGES) {
        const html = read(file);
        assert.doesNotMatch(html, /<style[\s>]/, `${file} contains an inline <style>; style-src 'self' would block it`);
        assert.doesNotMatch(html, /\sstyle="/, `${file} contains a style="" attribute; style-src 'self' would block it`);
    }
});

/* ── the vendored assets are the ones we think they are ──────────────────── */

const THREE_MARKER = '/* ── upstream bytes begin ─────────────────────────────────────────────── */\n';
const THREE_SHA256 = '76dea8151bc9352aef3528b4262e249b2604f62543828328db978d060d61a495';

test('js/vendor/three.module.js is three r160, unmodified, with its licence', () => {
    const file = read('js/vendor/three.module.js');

    const at = file.indexOf(THREE_MARKER);
    assert.ok(at > 0, 'the vendored file has lost its provenance header');

    const header = file.slice(0, at);
    assert.match(header, /three@0\.160\.0/, 'the header must record the exact version');
    assert.match(header, /https:\/\/cdn\.jsdelivr\.net\/npm\/three@0\.160\.0\/build\/three\.module\.js/,
        'the header must record the URL it came from');

    const upstream = file.slice(at + THREE_MARKER.length);
    assert.equal(
        createHash('sha256').update(upstream, 'utf8').digest('hex'),
        THREE_SHA256,
        'js/vendor/three.module.js no longer matches the upstream bytes it claims to be. ' +
        'Either it was edited — vendored code is not ours to patch — or it was replaced ' +
        'without updating the sha256 in its header and in this test.'
    );

    /* MIT requires the permission notice to travel with the copy; the SPDX
       line alone is not that notice. */
    assert.match(upstream, /SPDX-License-Identifier: MIT/, 'the upstream licence header is gone');
    assert.match(read('js/vendor/three.LICENSE'), /Permission is hereby granted, free of charge/);
});

test('every woff2 in assets/fonts matches the sha256 recorded in SOURCES.txt', () => {
    const manifest = read('assets/fonts/SOURCES.txt');

    const entries = [...manifest.matchAll(
        /^([a-z0-9-]+\.woff2)\n(?:.*\n)*?\s+bytes\s+(\d+)\n\s+sha256\s+([0-9a-f]{64})\n\s+source\s+(\S+)/gm
    )].map(([, name, bytes, sha, source]) => ({ name, bytes: Number(bytes), sha, source }));

    assert.equal(entries.length, 10, `SOURCES.txt should document 10 files, parsed ${entries.length}`);

    for (const { name, bytes, sha, source } of entries) {
        const buf = readFileSync(join(ROOT, 'assets', 'fonts', name));
        assert.equal(buf.length, bytes, `assets/fonts/${name} is ${buf.length} bytes, SOURCES.txt says ${bytes}`);
        assert.equal(createHash('sha256').update(buf).digest('hex'), sha,
            `assets/fonts/${name} does not match its recorded sha256`);
        assert.equal(buf.toString('ascii', 0, 4), 'wOF2', `assets/fonts/${name} is not a woff2`);
        assert.match(source, /^https:\/\/fonts\.gstatic\.com\//, `${name} has no upstream URL recorded`);
    }

    /* Nothing undocumented crept into the directory. */
    const onDisk = readdirSync(join(ROOT, 'assets', 'fonts')).filter((f) => f.endsWith('.woff2')).sort();
    assert.deepEqual(onDisk, entries.map((e) => e.name).sort());
});

test('every self-hosted family ships its licence', () => {
    for (const licence of ['cinzel-OFL.txt', 'outfit-OFL.txt', 'jetbrains-mono-OFL.txt']) {
        const text = read(join('assets', 'fonts', licence));
        assert.match(text, /SIL Open Font License, Version 1\.1/, `${licence} is not an OFL 1.1 text`);
        assert.match(text, /PERMISSION & CONDITIONS/, `${licence} looks truncated`);
    }
});

test('the stylesheet declares every font file that is committed, and no other', () => {
    const css = read('css/site.css');
    const declared = new Set();
    for (const [, name] of css.matchAll(/url\(\.\.\/assets\/fonts\/([A-Za-z0-9._-]+\.woff2)\)/g)) declared.add(name);

    const onDisk = new Set(readdirSync(join(ROOT, 'assets', 'fonts')).filter((f) => f.endsWith('.woff2')));
    assert.deepEqual([...declared].sort(), [...onDisk].sort(),
        'a committed font nothing declares is dead weight; a declared font nothing committed is a 404');

    /* font-display: swap on every face — text in a fallback beats no text on
       a page whose job is to put a dispatch number in front of someone. */
    const faces = css.match(/@font-face\s*\{[^}]*\}/g) || [];
    assert.equal(faces.length, onDisk.size);
    for (const face of faces) assert.match(face, /font-display:\s*swap/);
});

/* ── generated, and checked like everything else that is generated ───────── */

const run = (dir, ...args) => {
    const r = spawnSync(process.execPath, ['build.mjs', ...args], { cwd: dir, encoding: 'utf8' });
    return { code: r.status, out: `${r.stdout}${r.stderr}` };
};

/** A throwaway checkout: src/, build.mjs, the committed output, and empty
    stand-ins for every binary asset (existence is all the build asserts, and
    this keeps ~3 MB of images and fonts out of each temp directory). */
function checkout() {
    const dir = mkdtempSync(join(tmpdir(), 'fps-csp-'));
    cpSync(join(ROOT, 'src'), join(dir, 'src'), { recursive: true });
    cpSync(join(ROOT, 'build.mjs'), join(dir, 'build.mjs'));
    mkdirSync(join(dir, 'css'), { recursive: true });

    const stub = (from, to) => {
        mkdirSync(to, { recursive: true });
        for (const entry of readdirSync(from, { withFileTypes: true })) {
            if (entry.isDirectory()) stub(join(from, entry.name), join(to, entry.name));
            else writeFileSync(join(to, entry.name), '');
        }
    };
    stub(join(ROOT, 'assets'), join(dir, 'assets'));

    run(dir);   // write the output this checkout's src/ produces
    return dir;
}

function withCheckout(fn) {
    const dir = checkout();
    try { fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('vercel.json is generated output — --check catches a hand edit', () => {
    withCheckout((dir) => {
        assert.equal(run(dir, '--check').code, 0, 'the fixture must be clean before it is dirtied');

        const path = join(dir, 'vercel.json');
        const config = JSON.parse(readFileSync(path, 'utf8'));
        /* The kind of edit someone would plausibly make by hand: loosening one
           directive because something looked broken. */
        const headers = config.headers[0].headers;
        const csp = headers.find((h) => h.key === 'Content-Security-Policy');
        csp.value = csp.value.replace("style-src 'self'", "style-src 'self' 'unsafe-inline'");
        writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);

        const { code, out } = run(dir, '--check');
        assert.equal(code, 1, 'a hand-edited vercel.json must fail --check');
        assert.match(out, /DRIFTED\s+vercel\.json/);
    });
});

test('vercel.json is missing-file-safe too: delete it and --check fails', () => {
    withCheckout((dir) => {
        rmSync(join(dir, 'vercel.json'));
        const { code, out } = run(dir, '--check');
        assert.equal(code, 1);
        assert.match(out, /MISSING\s+vercel\.json/);
    });
});

test('editing src/data changes a hash, and the policy follows automatically', () => {
    withCheckout((dir) => {
        const before = JSON.parse(readFileSync(join(dir, 'vercel.json'), 'utf8'))
            .headers[0].headers.find((h) => h.key === 'Content-Security-Policy').value;

        /* A tier rate is serialized into the #fps-config island, so touching
           one must move a hash. This is the failure the generation exists to
           prevent: a hand-maintained header would still say the old hash and
           nothing would complain. */
        const estimator = join(dir, 'src', 'data', 'estimator.mjs');
        const text = readFileSync(estimator, 'utf8');
        const patched = text.replace(/rate:\s*(\d+)/, (m, n) => `rate: ${Number(n) + 7}`);
        assert.notEqual(patched, text, 'expected a numeric rate in src/data/estimator.mjs');
        writeFileSync(estimator, patched);

        assert.equal(run(dir, '--check').code, 1, 'the stale output must be reported as drifted');

        run(dir);
        const after = JSON.parse(readFileSync(join(dir, 'vercel.json'), 'utf8'))
            .headers[0].headers.find((h) => h.key === 'Content-Security-Policy').value;

        assert.notEqual(after, before, 'the data island changed but no script-src hash moved');
        assert.equal(run(dir, '--check').code, 0, 'a rebuild must settle the drift');
    });
});

test('the build refuses to ship when a self-hosted font is missing', () => {
    withCheckout((dir) => {
        rmSync(join(dir, 'assets', 'fonts', 'outfit-latin.woff2'));
        const { code, out } = run(dir, '--check');
        assert.equal(code, 1, 'a missing font must fail the build');
        assert.match(out, /MISSING\s+assets\/fonts\/outfit-latin\.woff2/);
        assert.match(out, /SOURCES\.txt/, 'the failure must say where the file came from');
    });
});

/* ── preview parity ──────────────────────────────────────────────────────── */

test('serve.py sends the production headers rather than restating them', () => {
    const serve = read('serve.py');

    assert.match(serve, /vercel\.json/, 'serve.py must read the generated policy, not carry its own copy');
    assert.match(serve, /'\/\(\.\*\)'/, "serve.py must look for the catch-all rule");
    assert.match(serve, /for key, value in HEADERS:/, 'serve.py must send every header it read');

    /* A second hand-written copy of the policy in Python would be wrong the
       first time a hash moved, and would make a local sweep report a policy
       production does not have. */
    assert.ok(!serve.includes("default-src 'self'"), 'serve.py has its own copy of the CSP');

    /* Missing or malformed config must stop the server, not quietly serve the
       site unprotected — a clean local sweep would then mean nothing. */
    assert.match(serve, /raise SystemExit/, 'serve.py must refuse to start without a policy to mirror');
});

test('every generated artefact the build writes is committed', () => {
    for (const file of [...GENERATED_PAGES, 'css/site.css', 'css/invoice.css', 'css/noscript.css', 'vercel.json']) {
        assert.ok(existsSync(join(ROOT, file)), `${file} is generated but not committed`);
    }
});
