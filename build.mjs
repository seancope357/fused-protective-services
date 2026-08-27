#!/usr/bin/env node
/* ==========================================================================
   FUSED PROTECTIVE SERVICES — SITE GENERATOR
   ==========================================================================
   Zero dependencies, by design: `node build.mjs` is the whole toolchain.
   There is no package.json, no lockfile, and nothing to install or keep
   current — the site still deploys by dragging the directory at a host.

     node build.mjs           write index.html and css/site.css
     node build.mjs --check   verify the committed output matches src/,
                              exit 1 if it drifted (for CI or a pre-push hook)

   Both artefacts are generated AND committed. Committing them keeps the
   drag-and-drop deploy honest; --check is what stops a hand-edit of a
   generated file from silently surviving.
   ========================================================================== */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { page } from './src/templates/page.mjs';

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
    'components/dispatch-bar.css',
    'components/footer.css',
    'utilities.css'
];

const BANNER = `/* ==========================================================================
   GENERATED FILE — DO NOT EDIT
   Built from src/styles/ by build.mjs. Edit the module, then run:
       node build.mjs
   ========================================================================== */`;

function buildStyles() {
    const parts = STYLE_ORDER.map((name) => {
        const css = readFileSync(join(STYLES, name), 'utf8').trim();
        return `/* ── ${name} ${'─'.repeat(Math.max(0, 58 - name.length))} */\n${css}`;
    });

    /* The layer order is declared once, up front. Every module opts into a
       layer, so a component can never out-specify a utility by accident. */
    return `${BANNER}\n\n@layer tokens, base, layout, components, utilities;\n\n${parts.join('\n\n')}\n`;
}

function buildHtml() {
    return String(page());
}

const artefacts = () => [
    { path: join(ROOT, 'index.html'), contents: buildHtml() },
    { path: join(ROOT, 'css', 'site.css'), contents: buildStyles() }
];

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

if (process.argv.includes('--check')) {
    console.log('Checking generated output...');
    check();
} else {
    console.log('Building Fused Protective Services...');
    write();
    console.log('\nDone. Preview with: python3 serve.py');
}
