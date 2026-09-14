/* ==========================================================================
   SPEC-007 — the brand assets exist, are the right shape, and stay small.

   The derivatives in assets/ are generated once by scripts/build-assets.sh and
   committed; nothing in the build regenerates them. That is the whole reason
   this file exists. A renamed file, a bad merge, or a deploy that drops one is
   otherwise a broken image on a live page that no command anywhere reports —
   so the build asserts they are present and these tests assert the build does.

   No image library: PNG puts width and height in the IHDR chunk as two
   big-endian uint32s at byte offsets 16 and 20, which is a readFileSync away.
   WebP puts them in the VP8 bitstream header. Nothing here reads the clock,
   the environment or a socket.
   ========================================================================== */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { site } from '../src/data/site.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const bytes = (rel) => statSync(join(ROOT, rel)).size;

/** Width and height straight out of a PNG's IHDR. */
function pngSize(rel) {
    const buf = readFileSync(join(ROOT, rel));
    assert.equal(buf.toString('ascii', 1, 4), 'PNG', `${rel} is not a PNG`);
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

/** Width and height out of a simple lossy WebP (RIFF ... WEBP VP8 ). */
function webpSize(rel) {
    const buf = readFileSync(join(ROOT, rel));
    assert.equal(buf.toString('ascii', 0, 4), 'RIFF', `${rel} is not a RIFF container`);
    assert.equal(buf.toString('ascii', 8, 12), 'WEBP', `${rel} is not a WebP`);
    assert.equal(buf.toString('ascii', 12, 16), 'VP8 ', `${rel} is not a simple lossy WebP`);
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
}

/* ── what the pages actually ask the browser for ─────────────────────────── */

const GENERATED = ['index.html', 'careers.html', 'invoice.html', 'privacy.html', 'terms.html', 'sms-consent.html'];

/** Every assets/… URL in the generated markup, however it got there. */
function referencedInOutput() {
    const found = new Set();
    for (const file of GENERATED) {
        const html = readFileSync(join(ROOT, file), 'utf8');
        for (const [, path] of html.matchAll(/["'(]((?:\.\.\/)?assets\/[A-Za-z0-9._-]+)["')]/g)) {
            found.add(path.replace(/^\.\.\//, ''));
        }
    }
    return [...found].sort();
}

test('every asset the generated pages reference is on disk', () => {
    const referenced = referencedInOutput();
    assert.ok(referenced.length >= 4, `expected the pages to reference several assets, found ${referenced.length}`);

    for (const rel of referenced) {
        assert.ok(existsSync(join(ROOT, rel)), `${rel} is referenced by the generated output but missing from the checkout`);
    }
});

test('every assets/ path named in src/ is on disk', () => {
    const roots = ['src', 'js'];
    const files = [];
    const walk = (dir) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const full = join(dir, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (/\.(mjs|js)$/.test(entry.name)) files.push(full);
        }
    };
    for (const r of roots) walk(join(ROOT, r));

    let checked = 0;
    for (const file of files) {
        for (const [, path] of readFileSync(file, 'utf8').matchAll(/['"`](assets\/[A-Za-z0-9._-]+)['"`]/g)) {
            assert.ok(existsSync(join(ROOT, path)), `${file.replace(ROOT + '/', '')} names ${path}, which is not in the checkout`);
            checked++;
        }
    }
    assert.ok(checked > 0, 'expected at least one assets/ path in src/ or js/');
});

/* ── the build refuses to ship a missing one ─────────────────────────────── */

function checkout() {
    const dir = mkdtempSync(join(tmpdir(), 'fps-assets-'));
    mkdirSync(join(dir, 'src'), { recursive: true });
    cpSync(join(ROOT, 'src'), join(dir, 'src'), { recursive: true });
    cpSync(join(ROOT, 'build.mjs'), join(dir, 'build.mjs'));
    mkdirSync(join(dir, 'assets'), { recursive: true });
    /* Existence is the only thing asserted, so stand-ins are enough and keep
       ~3 MB of image data out of every temp checkout. */
    for (const name of readdirSync(join(ROOT, 'assets'))) writeFileSync(join(dir, 'assets', name), '');
    return dir;
}

const run = (dir, ...args) => {
    const r = spawnSync(process.execPath, ['build.mjs', ...args], { cwd: dir, encoding: 'utf8' });
    return { code: r.status, out: `${r.stdout}${r.stderr}` };
};

function withCheckout(fn) {
    const dir = checkout();
    try { fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}

test('build.mjs exits non-zero and names the file when a referenced asset is missing', () => {
    for (const rel of [site.icons.favicon, site.logo, site.ogCard.path]) {
        withCheckout((dir) => {
            assert.equal(run(dir).code, 0, 'the fixture must build before anything is removed');

            rmSync(join(dir, rel));
            const { code, out } = run(dir);
            assert.equal(code, 1, `removing ${rel} must fail the build`);
            assert.match(out, new RegExp(rel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `the failure must name ${rel}`);
            assert.match(out, /build-assets\.sh/, 'the failure must say how to regenerate');
        });
    }
});

test('the assertion guards --check and --verify-release too, not just a plain build', () => {
    for (const mode of ['--check', '--verify-release']) {
        withCheckout((dir) => {
            run(dir);
            rmSync(join(dir, site.ogCard.path));
            const { code, out } = run(dir, mode);
            assert.equal(code, 1, `${mode} must fail on a missing asset`);
            assert.match(out, /MISSING/);
        });
    }
});

/* ── shape and weight ────────────────────────────────────────────────────── */

test('the social card is a 1200x630 PNG under 300 KB', () => {
    const { width, height } = pngSize(site.ogCard.path);
    assert.equal(width, 1200, 'summary_large_image wants 1200 wide');
    assert.equal(height, 630, 'summary_large_image wants 630 tall');

    /* The declared dimensions are what Twitter and Facebook lay out before the
       image arrives; if they disagree with the file, the card jumps. */
    assert.equal(width, site.ogCard.width, 'og:image:width must match the file');
    assert.equal(height, site.ogCard.height, 'og:image:height must match the file');

    const size = bytes(site.ogCard.path);
    assert.ok(size <= 300 * 1024, `og-card.png is ${size} bytes, over the 300 KB scrapers expect`);
});

test('a favicon request fetches no more than 10 KB', () => {
    const size = bytes(site.icons.favicon);
    assert.ok(size <= 10 * 1024, `${site.icons.favicon} is ${size} bytes; it is fetched on every page load`);

    const { width, height } = pngSize(site.icons.favicon);
    assert.deepEqual({ width, height }, { width: 32, height: 32 });
});

test('the icon set is square and the declared size', () => {
    for (const [rel, expected] of [[site.icons.favicon, 32], [site.icons.appleTouch, 180], [site.icons.large, 512]]) {
        assert.deepEqual(pngSize(rel), { width: expected, height: expected }, `${rel} must be ${expected}x${expected}`);
    }
});

test('the brand plate is full-resolution WebP and the portal fallback is a PNG', () => {
    /* Full resolution on purpose: js/logo-forge.js maps this texture across
       65,536 cubes, and a downscale is visible on the settled emblem. The
       saving came from the encoder, not from throwing pixels away. */
    assert.deepEqual(webpSize(site.logo), { width: 1000, height: 1000 });
    assert.deepEqual(pngSize(site.logoFallback), { width: 512, height: 512 });
});

test('no generated page still fetches the megabyte master', () => {
    for (const file of GENERATED) {
        const html = readFileSync(join(ROOT, file), 'utf8');
        assert.doesNotMatch(html, /assets\/logo\.png/, `${file} still points at the 1 MB brand master`);
    }
});

test('a first view of / stays under 250 KB of images', () => {
    /* index.html paints the plate four times (nav, hero, footer, and the forge
       texture) from one URL, plus the favicon. That is the whole image cost of
       a first view, and it used to be 1,095,464 bytes for the plate alone. */
    const firstView = [site.logo, site.icons.favicon];
    const total = firstView.reduce((sum, rel) => sum + bytes(rel), 0);
    assert.ok(total <= 250 * 1024, `a first view now costs ${total} bytes of images`);
});

/* ── the portal's copy ───────────────────────────────────────────────────── */

test('sync-shared copies a logo that exists, to the path the portal serves', () => {
    const script = readFileSync(join(ROOT, 'app', 'scripts', 'sync-shared.mjs'), 'utf8');
    const match = script.match(/const LOGO = \['([^']+)', '([^']+)'\]/);
    assert.ok(match, 'sync-shared.mjs no longer declares LOGO as a [from, to] pair');

    const [, from, to] = match;
    assert.ok(existsSync(join(ROOT, from)), `sync-shared copies ${from}, which is not in the checkout`);

    /* app/src/lib/shared.ts serves the logo from a fixed /logo.png, so the
       destination name — and therefore the source format — is a contract. */
    assert.equal(to, 'public/logo.png');
    assert.ok(from.endsWith('.png'), `${from} would be served as a PNG at ${to}`);

    const shared = readFileSync(join(ROOT, 'app', 'src', 'lib', 'shared.ts'), 'utf8');
    assert.match(shared, /logoSrc = '\/logo\.png'/, 'the portal no longer serves its logo from /logo.png');
});

/* ── the social tags the validators read ─────────────────────────────────── */

test('the card is declared to both scrapers with width, height and alt', () => {
    for (const file of ['index.html', 'careers.html']) {
        const html = readFileSync(join(ROOT, file), 'utf8');
        const card = `${site.url}/${site.ogCard.path}`;

        assert.match(html, new RegExp(`<meta property="og:image" content="${card}">`), `${file}: og:image must be the card`);
        assert.match(html, /<meta property="og:image:width" content="1200">/, `${file}: og:image:width`);
        assert.match(html, /<meta property="og:image:height" content="630">/, `${file}: og:image:height`);
        assert.match(html, /<meta property="og:image:alt" content="[^"]{40,}">/, `${file}: og:image:alt must be descriptive`);
    }

    const index = readFileSync(join(ROOT, 'index.html'), 'utf8');
    assert.match(index, /<meta name="twitter:card" content="summary_large_image">/);
    assert.match(index, new RegExp(`<meta name="twitter:image" content="${site.url}/${site.ogCard.path}">`));
});

test('the icon links are in every generated page head', () => {
    for (const file of GENERATED) {
        const html = readFileSync(join(ROOT, file), 'utf8');
        assert.match(html, new RegExp(`rel="icon"[^>]*href="${site.icons.favicon}"`), `${file} has no 32px favicon`);
        assert.match(html, new RegExp(`rel="apple-touch-icon"[^>]*href="${site.icons.appleTouch}"`), `${file} has no apple-touch-icon`);
    }
});
