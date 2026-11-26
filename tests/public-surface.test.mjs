/* ==========================================================================
   SPEC-017: the marketing site serves only public files.

   The static project (Root Directory = repository root) uploads every file
   that `.vercelignore` does not exclude, and Vercel serves every uploaded file.
   The tests below evaluate the committed `.vercelignore` against the files git
   tracks, and assert three things:
     1. nothing internal (docs, context, specs, the build, the portal…) uploads;
     2. every page, asset and function the site needs does upload, including
        every module the api/ functions import at runtime;
     3. the portal project has its own .vercelignore, so Vercel never falls back
        to the root allowlist for it (which would strip app/ out of its build).

   The matcher implements the gitignore subset `.vercelignore` uses here:
   ordered rules, `!` negation, anchored (`/x`, `a/b`) vs basename patterns,
   `*` and `**`, and "a file inside an excluded directory stays excluded".
   ========================================================================== */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function parseRules(text) {
    return text.split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => {
            const negate = line.startsWith('!');
            let pattern = negate ? line.slice(1) : line;
            const dirOnly = pattern.endsWith('/');
            if (dirOnly) pattern = pattern.slice(0, -1);
            const anchored = pattern.includes('/');
            if (pattern.startsWith('/')) pattern = pattern.slice(1);
            const body = pattern
                .split('**').map((part) => part
                    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
                    .replace(/\*/g, '[^/]*')
                    .replace(/\?/g, '[^/]'))
                .join('.*');
            const regex = new RegExp(anchored ? `^${body}$` : `(^|/)${body}$`);
            return { negate, dirOnly, regex };
        });
}

function ignoredBy(rules, path, isDir) {
    let ignored = false;
    for (const rule of rules) {
        if (rule.dirOnly && !isDir) continue;
        if (rule.regex.test(path)) ignored = !rule.negate;
    }
    return ignored;
}

/** True when `file` would be uploaded under `rules`. */
function uploads(rules, file) {
    const parts = file.split('/');
    for (let i = 1; i < parts.length; i += 1) {
        if (ignoredBy(rules, parts.slice(0, i).join('/'), true)) return false;
    }
    return !ignoredBy(rules, file, false);
}

const rules = parseRules(readFileSync(join(ROOT, '.vercelignore'), 'utf8'));
const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter(Boolean);
const uploaded = tracked.filter((file) => uploads(rules, file));

/* Internal paths that must never be served. Prefixes end in '/'. */
const PRIVATE = [
    'PROGRESS.md', 'README.md', 'PROJECT_CONTEXT.md', 'build.mjs', 'serve.py',
    'skills-lock.json', '.gitignore', '.vercelignore',
    'docs/', 'context/', 'specs/', 'supabase/', 'app/', 'tests/', 'scripts/',
    'prototypes/', 'output/', 'advisory-board/', '.github/', '.agents/', '.claude/',
    'src/templates/', 'src/styles/'
];

test('the matcher follows gitignore semantics for the rules it supports', () => {
    const r = parseRules('/*\n!keep\n/keep/*\n!keep/sub\n*.secret\n');
    assert.equal(uploads(r, 'top.md'), false);
    assert.equal(uploads(r, 'keep/file.txt'), false);
    assert.equal(uploads(r, 'keep/sub/file.txt'), true);
    assert.equal(uploads(r, 'keep/sub/x.secret'), false);
    assert.equal(uploads(r, 'other/sub/file.txt'), false);
});

test('no internal file is uploaded to the marketing site', () => {
    const leaks = uploaded.filter((file) =>
        PRIVATE.some((p) => (p.endsWith('/') ? file.startsWith(p) : file === p)));
    assert.deepEqual(leaks, [], `would be served publicly:\n${leaks.join('\n')}`);
});

test('every page, stylesheet, script, asset and config the site needs is uploaded', () => {
    const pages = tracked.filter((f) => /^[^/]+\.html$/.test(f));
    assert.ok(pages.length >= 7, 'expected the generated pages at the root');
    const required = [
        ...pages, 'vercel.json', 'robots.txt', 'sitemap.xml', 'llms.txt',
        ...tracked.filter((f) => /^(css|js|assets|api)\//.test(f))
    ];
    const missing = required.filter((f) => !uploads(rules, f));
    assert.deepEqual(missing, [], `needed by the site but not uploaded:\n${missing.join('\n')}`);
});

test('every module the api/ functions import at runtime is uploaded', () => {
    const seen = new Set();
    const queue = tracked.filter((f) => /^api\/.*\.mjs$/.test(f));
    while (queue.length) {
        const file = queue.pop();
        if (seen.has(file)) continue;
        seen.add(file);
        const source = readFileSync(join(ROOT, file), 'utf8');
        for (const [, spec] of source.matchAll(/(?:from|import\()\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
            queue.push(normalize(join(dirname(file), spec)).split('\\').join('/'));
        }
    }
    const missing = [...seen].filter((f) => !uploads(rules, f));
    assert.deepEqual(missing, [], `imported by api/ but not uploaded:\n${missing.join('\n')}`);
    assert.ok(seen.has('src/data/site.mjs'), 'the trace should reach src/data/site.mjs');
});

test('the portal has its own .vercelignore and it does not exclude its shared sources', () => {
    const file = join(ROOT, 'app', '.vercelignore');
    assert.ok(existsSync(file), 'app/.vercelignore is missing, so Vercel would apply the root allowlist to the portal');
    const portal = parseRules(readFileSync(file, 'utf8'));
    for (const f of ['package.json', 'next.config.ts', 'scripts/sync-shared.mjs', 'src/app/layout.tsx']) {
        assert.equal(uploads(portal, f), true, `portal would not upload app/${f}`);
    }
});
