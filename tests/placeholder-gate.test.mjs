/* ==========================================================================
   SPEC-001 — the placeholder guardrail is fail-closed.

   Two things are proven here, and they are different things:

     1. The release gate refuses to pass while a business fact is still a
        placeholder — `node build.mjs --verify-release` exits 1 and names it.
     2. The flag that says so reaches the page with no JavaScript and no
        host check, so it is visible on production too.

   Both run against a throwaway checkout in a temp directory: build.mjs only
   needs src/, and writes its output beside itself. Nothing here touches the
   real working tree, reads the clock, or opens a socket.
   ========================================================================== */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** A minimal checkout: the generator and its inputs.
 *
 *  assets/ is here because build.mjs asserts that every icon and card src/
 *  points at is really on disk (SPEC-007) and refuses to build when one is
 *  not. That assertion is the point, so the fixture supplies the files rather
 *  than the build being taught to tolerate their absence. Empty stand-ins: the
 *  build only asks whether they exist, and copying the real ones would put
 *  ~3 MB through the filesystem on every one of these checkouts. */
function checkout() {
    const dir = mkdtempSync(join(tmpdir(), 'fps-placeholder-'));
    mkdirSync(join(dir, 'src'), { recursive: true });
    cpSync(join(ROOT, 'src'), join(dir, 'src'), { recursive: true });
    cpSync(join(ROOT, 'build.mjs'), join(dir, 'build.mjs'));

    mkdirSync(join(dir, 'assets'), { recursive: true });
    for (const name of readdirSync(join(ROOT, 'assets'))) {
        writeFileSync(join(dir, 'assets', name), '');
    }
    return dir;
}

const run = (dir, ...args) => {
    const r = spawnSync(process.execPath, ['build.mjs', ...args], {
        cwd: dir,
        encoding: 'utf8'
    });
    return { code: r.status, out: `${r.stdout}${r.stderr}` };
};

/* Flips ONLY the licenceNumber block. The assertion matters: if site.mjs is
   restructured so this no longer matches, the test must fail loudly rather
   than quietly prove nothing. */
function supplyLicence(dir) {
    const path = join(dir, 'src', 'data', 'site.mjs');
    const before = readFileSync(path, 'utf8');
    const after = before.replace(
        /(const licenseNumber = \{[\s\S]*?placeholder: )true/,
        '$1false'
    );
    assert.notEqual(after, before, 'fixture edit did not apply — has site.mjs been restructured?');
    writeFileSync(path, after);
}

function withCheckout(fn) {
    const dir = checkout();
    try {
        fn(dir);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

test('placeholder pending → --verify-release exits 1 and names the field', () => {
    withCheckout((dir) => {
        assert.equal(run(dir).code, 0, 'the plain build must succeed');

        const { code, out } = run(dir, '--verify-release');
        assert.equal(code, 1, '--verify-release must exit 1 while a placeholder remains');
        assert.match(out, /DPS licence number/, 'the pending field must be named');
        assert.match(out, /src\/data\/site\.mjs/, 'the message must say where to fix it');
    });
});

test('every placeholder supplied → --verify-release exits 0', () => {
    withCheckout((dir) => {
        supplyLicence(dir);
        assert.equal(run(dir).code, 0);

        const { code, out } = run(dir, '--verify-release');
        assert.equal(code, 0, '--verify-release must pass once no placeholder remains');
        assert.match(out, /Release gate passed/);
    });
});

test('--check keeps its behaviour and exit code either way', () => {
    withCheckout((dir) => {
        run(dir);
        assert.equal(run(dir, '--check').code, 0, '--check must pass on freshly built output');
        assert.match(run(dir, '--check').out, /placeholder still in place/, '--check still warns');
    });

    withCheckout((dir) => {
        supplyLicence(dir);
        run(dir);
        assert.equal(run(dir, '--check').code, 0);
    });
});

test('--check still exits 1 when the generated output drifted', () => {
    withCheckout((dir) => {
        run(dir);
        writeFileSync(join(dir, 'index.html'), '<!-- hand-edited -->');
        assert.equal(run(dir, '--check').code, 1, 'a hand-edit must not survive --check');
    });
});

test('the flag is in the markup and is not gated on a host or on JavaScript', () => {
    withCheckout((dir) => {
        run(dir);
        const html = readFileSync(join(dir, 'index.html'), 'utf8');
        const css = readFileSync(join(dir, 'css', 'site.css'), 'utf8');

        assert.match(html, /class="placeholder-flag"/, 'the flag must be in the generated markup');
        assert.match(html, /Placeholder licence number/);

        /* Fail-closed: shown by default, with nothing that could hide it.
           Comments are stripped first so the note explaining why the old host
           gate was removed does not read as the gate itself. */
        const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');
        assert.match(rules, /\.placeholder-flag \{[^}]*display: inline-block/);
        assert.doesNotMatch(rules, /data-env/, 'no host gate may remain in the stylesheet');
        assert.doesNotMatch(html, /data-env/, 'no host gate may remain in the markup');

        /* No rule anywhere in the bundle may hide the flag. */
        const placeholderRules = rules.match(/[^{}]*placeholder[^{}]*\{[^}]*\}/g) ?? [];
        assert.ok(placeholderRules.length > 0, 'expected placeholder rules in the bundle');
        for (const rule of placeholderRules) {
            assert.doesNotMatch(rule, /display:\s*none/, `this rule hides the flag: ${rule}`);
        }
    });
});

test('supplying the fact removes the flag markup entirely — no reserved space', () => {
    withCheckout((dir) => {
        supplyLicence(dir);
        run(dir);
        const html = readFileSync(join(dir, 'index.html'), 'utf8');

        assert.doesNotMatch(html, /placeholder-flag/, 'no flag element may be generated');
        assert.doesNotMatch(html, /Placeholder licence number/);
        assert.doesNotMatch(html, /data-placeholder/, 'no outlined element may remain');
    });
});

test('productionHosts carries no deploy alias', async () => {
    const { site } = await import('../src/data/site.mjs');
    assert.ok(site.productionHosts.length > 0);
    for (const host of site.productionHosts) {
        assert.doesNotMatch(host, /\.vercel\.app$/, `${host} is a deploy alias, not the production site`);
    }
});

test('the deleted env module has no importer left', () => {
    const app = readFileSync(join(ROOT, 'js', 'app.mjs'), 'utf8');
    assert.doesNotMatch(app, /env\.mjs/);
    assert.doesNotMatch(app, /initEnvFlag/);
});
