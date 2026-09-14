#!/usr/bin/env node
/* ==========================================================================
   FUSED PROTECTIVE SERVICES — SITE GENERATOR
   ==========================================================================
   Zero dependencies, by design: `node build.mjs` is the whole toolchain.
   There is no package.json, no lockfile, and nothing to install or keep
   current — the site still deploys by dragging the directory at a host.

     node build.mjs           write index.html, careers.html, the legal pages,
                              invoice.html (legacy export), css/*.css and
                              vercel.json (the security headers, whose script
                              hashes are computed from the markup above)
     node build.mjs --check   verify the committed output matches src/,
                              exit 1 if it drifted (for CI or a pre-push hook)
     node build.mjs --verify-release
                              --check, then exit 1 naming every business fact
                              still marked `placeholder: true`. The release
                              gate: run it immediately before a DNS cutover,
                              and in CI on tags and workflow_dispatch only.

   Every artefact is generated AND committed. Committing them keeps the
   drag-and-drop deploy honest; --check is what stops a hand-edit of a
   generated file from silently surviving.
   ========================================================================== */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { page } from './src/templates/page.mjs';
import { invoicePage } from './src/templates/invoice/page.mjs';
import { careersPage } from './src/templates/careers/page.mjs';
import { legalPage } from './src/templates/legal/page.mjs';
import { legalPages } from './src/data/legal.mjs';
import { site } from './src/data/site.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const STYLES = join(ROOT, 'src', 'styles');

/* Explicit rather than a directory read: cascade order is a design decision,
   and alphabetical order is not the one we want. */
const STYLE_ORDER = [
    'tokens.css',
    'base.css',
    'layout.css',
    'components/icons.css',
    'components/buttons.css',
    'components/nav.css',
    'components/drawer.css',
    'components/forge.css',
    'components/hero.css',
    'components/metrics.css',
    'components/bookshelf.css',
    'components/protocol.css',
    'components/assessment.css',
    'components/estimator.css',
    'components/standards.css',
    'components/form.css',
    'components/faq.css',
    'components/careers.css',
    'components/legal.css',
    'components/reveal.css',
    'components/placeholder.css',
    'components/dispatch-bar.css',
    'components/footer.css',
    'utilities.css'
];

/* The invoicing tool gets its own bundle: the marketing page never pays for
   print rules or the white paper palette, and site.css stays byte-identical.
   Shared modules are listed again rather than abstracted — the order is still
   the design decision. Print rules come last so they outrank everything. */
const INVOICE_STYLE_ORDER = [
    'tokens.css',
    'base.css',
    'components/buttons.css',
    'components/form.css',
    'components/legal.css',
    'utilities.css'
];

/* A third bundle, one file long, linked only from inside <noscript> on `/`.
   It exists as a file rather than as an inline <style> because the CSP is
   `style-src 'self'` with no hashes — see src/styles/noscript.css. */
const NOSCRIPT_STYLE_ORDER = ['noscript.css'];

const BANNER = `/* ==========================================================================
   GENERATED FILE — DO NOT EDIT
   Built from src/styles/ by build.mjs. Edit the module, then run:
       node build.mjs
   ========================================================================== */`;

function buildStyles(order) {
    const parts = order.map((name) => {
        const css = readFileSync(join(STYLES, name), 'utf8').trim();
        return `/* ── ${name} ${'─'.repeat(Math.max(0, 58 - name.length))} */\n${css}`;
    });

    /* The layer order is declared once, up front. Every module opts into a
       layer, so a component can never out-specify a utility by accident. */
    return `${BANNER}\n\n@layer tokens, base, layout, components, utilities;\n\n${parts.join('\n\n')}\n`;
}

/* ==========================================================================
   SECURITY HEADERS (SPEC-006)
   ==========================================================================
   vercel.json is generated, for the same reason the HTML is: part of it is
   derived from src/, so a hand-maintained copy rots. Specifically, script-src
   carries a sha256 for every inline <script> block, and those blocks are
   serialized straight out of src/data — the #fps-config island changes the
   moment anyone edits a tier rate or an assessment option, and the JSON-LD
   graph changes the moment anyone edits a division or an FAQ answer.

   A stale hash does not break loudly. The page keeps rendering, because the
   blocks it hashes are inert JSON; the policy simply stops describing the
   document. Deriving it here means `node build.mjs --check` is the thing that
   notices, in CI, before a human has to.

   Determinism (specs/README.md invariant 8): every input is a generated
   string already in memory. No clock, no environment, no network. */

/** The inline <script> blocks of one generated page, exactly as a browser
    reads them — i.e. the text between the tags, untrimmed, because that is
    what the hash is taken over. Blocks with a `src` are external and are
    covered by 'self' instead. */
function inlineScripts(html) {
    const found = [];
    for (const [, attrs, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
        if (/\ssrc\s*=/.test(attrs)) continue;
        found.push(body);
    }
    return found;
}

const sha256Base64 = (text) => createHash('sha256').update(text, 'utf8').digest('base64');

/** One policy for every path, so script-src carries the union of the hashes
    from all six pages.

    Per-page policies would be tighter on paper and worse in practice: with
    `cleanUrls: true` each page answers at two sources (/careers and
    /careers.html), Vercel applies every matching rule, and the resulting
    six-way header table is a thing nobody can read or review. The union costs
    nothing real — every block hashed here is `type="application/json"` or
    `type="application/ld+json"`, which no browser executes. Allowing the
    careers data island to appear inertly on /privacy grants an attacker
    precisely nothing. */
function contentSecurityPolicy(pages) {
    const hashes = [...new Set(pages.flatMap(({ contents }) => inlineScripts(contents)))]
        .map((body) => `'sha256-${sha256Base64(body)}'`)
        .sort();

    const directives = [
        ['default-src', ["'self'"]],
        /* Nothing is loaded from another origin any more: three.js is
           js/vendor/three.module.js and the typefaces are in assets/fonts/.
           That is what lets this be 'self' with no exception. */
        ['script-src', ["'self'", ...hashes]],
        ['style-src', ["'self'"]],
        /* `data:` is carried per SPEC-006 design 2. Nothing in src/ emits a
           data: URI today, so this could be tightened to 'self' alone — see
           the note in the SPEC-006 PR before removing it. */
        ['img-src', ["'self'", 'data:']],
        ['font-src', ["'self'"]],
        /* The quote and application forms POST to our own /api/intake. */
        ['connect-src', ["'self'"]],
        ['form-action', ["'self'"]],
        /* Nothing embeds any of these pages — checked for /invoice in
           particular, which is the one that looks like it might be printed
           from a frame. It is not; it is a JSON export screen. */
        ['frame-ancestors', ["'none'"]],
        ['base-uri', ["'none'"]],
        ['object-src', ["'none'"]],
        ['upgrade-insecure-requests', []]
    ];

    return directives.map(([name, values]) => [name, ...values].join(' ')).join('; ');
}

function vercelConfig(pages) {
    const config = {
        $schema: 'https://openapi.vercel.sh/vercel.json',
        cleanUrls: true,
        trailingSlash: false,
        headers: [
            {
                source: '/(.*)',
                headers: [
                    { key: 'Content-Security-Policy', value: contentSecurityPolicy(pages) },
                    /* Two years, subdomains included, preload-eligible — the
                       same as the portal sends from app/next.config.ts. */
                    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                    /* DENY, not SAMEORIGIN: frame-ancestors 'none' above says
                       nobody may frame these pages, and a header that said
                       "except us" beside it would be a contradiction a reader
                       has to resolve. */
                    { key: 'X-Frame-Options', value: 'DENY' },
                    { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' }
                ]
            }
        ]
    };

    return `${JSON.stringify(config, null, 2)}\n`;
}

const artefacts = () => {
    /* The pages first and on their own: vercel.json hashes their inline
       blocks, so it cannot be built in the same literal that builds them. */
    const pages = [
        { path: join(ROOT, 'index.html'), contents: String(page()) },
        { path: join(ROOT, 'invoice.html'), contents: String(invoicePage()) },
        { path: join(ROOT, 'careers.html'), contents: String(careersPage()) },
        ...legalPages.map((page) => ({ path: join(ROOT, page.file), contents: String(legalPage(page)) }))
    ];

    return [
        ...pages,
        { path: join(ROOT, 'css', 'site.css'), contents: buildStyles(STYLE_ORDER) },
        { path: join(ROOT, 'css', 'invoice.css'), contents: buildStyles(INVOICE_STYLE_ORDER) },
        { path: join(ROOT, 'css', 'noscript.css'), contents: buildStyles(NOSCRIPT_STYLE_ORDER) },
        { path: join(ROOT, 'vercel.json'), contents: vercelConfig(pages) }
    ];
};

/* Every file in assets/ that the generated pages point at. The derivatives are
   made by scripts/build-assets.sh — outside the build, on purpose, because
   build.mjs must never depend on an image library — and committed. That is
   exactly why this list needs checking: nothing regenerates these, so a rename,
   a bad merge or a deploy that drops one is a broken image on a live page and
   nothing anywhere fails first.

   Reading the filesystem stays deterministic: same checkout, same answer, no
   clock, no environment, no network (invariant 8). */
const referencedAssets = () => [
    site.logo,
    site.logoFallback,
    site.icons.favicon,
    site.icons.appleTouch,
    site.icons.large,
    site.ogCard.path,
    ...referencedFonts()
];

/* The self-hosted typefaces (SPEC-006) are the same kind of hazard and then
   some: nothing regenerates them, and they are named only from CSS, so a
   dropped file does not break a layout or throw in a console — the page
   quietly renders in Times New Roman and nothing anywhere says why.

   Read out of the stylesheet rather than listed here, so the check cannot
   drift from the @font-face rules it is checking. Still deterministic: one
   file in src/, no clock, no environment, no network. */
function referencedFonts() {
    const css = readFileSync(join(STYLES, 'base.css'), 'utf8');
    const found = new Set();
    for (const [, name] of css.matchAll(/url\(\.\.\/(assets\/fonts\/[A-Za-z0-9._-]+)\)/g)) found.add(name);
    return [...found].sort();
}

function assertAssets() {
    const missing = referencedAssets().filter((rel) => !existsSync(join(ROOT, rel)));

    if (missing.length) {
        console.error('\nReferenced assets are missing from the checkout:');
        for (const rel of missing) console.error(`  MISSING  ${rel}`);
        console.error(
            `\n${missing.length} asset${missing.length === 1 ? ' is' : 's are'} referenced by src/ but not on disk.\n` +
            'Images: regenerate with ./scripts/build-assets.sh and commit the result.\n' +
            'Fonts:  re-download from the URL recorded in assets/fonts/SOURCES.txt and check its sha256.'
        );
        process.exit(1);
    }
}

function write() {
    mkdirSync(join(ROOT, 'css'), { recursive: true });
    for (const { path, contents } of artefacts()) {
        writeFileSync(path, contents);
        const lines = contents.split('\n').length;
        console.log(`  wrote ${path.replace(ROOT + '/', '')} (${lines} lines)`);
    }
}

function check() {
    let drifted = false;

    for (const { path, contents } of artefacts()) {
        const name = path.replace(ROOT + '/', '');
        let onDisk;
        try {
            onDisk = readFileSync(path, 'utf8');
        } catch {
            console.error(`  MISSING  ${name}`);
            drifted = true;
            continue;
        }
        if (onDisk === contents) {
            console.log(`  ok       ${name}`);
        } else {
            console.error(`  DRIFTED  ${name}`);
            drifted = true;
        }
    }

    if (drifted) {
        console.error('\nGenerated output does not match src/. Run `node build.mjs` and commit the result.');
        process.exit(1);
    }
    console.log('\nGenerated output is up to date.');
}

/* Facts Cameron has not supplied yet. Read straight from src/data/site.mjs,
   so this is deterministic — no clock, no environment, no network. The page
   itself flags every one of these on every host, production included (see
   src/styles/components/placeholder.css). */
function pendingPlaceholders() {
    return [
        site.phone.placeholder && 'phone number (src/data/site.mjs → phone)',
        site.licenseNumber.placeholder && 'DPS licence number (src/data/site.mjs → licenseNumber)'
    ].filter(Boolean);
}

/* Printed on every build and every check so a placeholder can never ship
   quietly. A warning only: it must not block the day-to-day work that is
   still going on around the facts Cameron owes us. */
function warnPlaceholders() {
    for (const item of pendingPlaceholders()) {
        console.warn(`  WARNING  placeholder still in place: ${item}`);
    }
}

/* The release gate, and the one place a placeholder is fatal rather than
   noisy. 37 Tex. Admin. Code §35.9 requires the real DPS licence number in
   every advertisement, and this website is advertising, so shipping B00000 to the
   public domain is a regulatory problem and not a cosmetic one. */
function verifyRelease() {
    const pending = pendingPlaceholders();

    if (pending.length) {
        console.error('\nNOT READY TO RELEASE — placeholder business facts remain:');
        for (const item of pending) {
            console.error(`  PENDING  ${item}`);
        }
        console.error(
            `\n${pending.length} placeholder${pending.length === 1 ? '' : 's'} pending. ` +
            'Supply the real value in src/data/site.mjs, set `placeholder: false`,\n' +
            'run `node build.mjs`, and commit the regenerated output.'
        );
        process.exit(1);
    }

    console.log('\nNo placeholders pending. Release gate passed.');
}

warnPlaceholders();

/* Before anything else: a page that renders perfectly while pointing at an
   icon that is not there is the failure this catches, and it is worth catching
   in every mode — writing, checking and releasing alike. */
assertAssets();

if (process.argv.includes('--verify-release')) {
    console.log('Verifying release readiness...');
    check();
    verifyRelease();
} else if (process.argv.includes('--check')) {
    console.log('Checking generated output...');
    check();
} else {
    console.log('Building Fused Protective Services...');
    write();
    console.log('\nDone. Preview with: python3 serve.py');
}
