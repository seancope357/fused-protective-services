#!/usr/bin/env node
/* ==========================================================================
   FUSED PROTECTIVE SERVICES — SITE GENERATOR
   ==========================================================================
   Zero dependencies, by design: `node build.mjs` is the whole toolchain.
   There is no package.json, no lockfile, and nothing to install or keep
   current — the site still deploys by dragging the directory at a host.

     node build.mjs           write index.html + css/site.css,
                              invoice.html + css/invoice.css, and careers.html
     node build.mjs --check   verify the committed output matches src/,
                              exit 1 if it drifted (for CI or a pre-push hook)
     node build.mjs --strict  as above, but ALSO exit 1 while any placeholder
                              value remains in src/data/site.mjs (combines
                              with --check; use it in the deploy pipeline)

   Both artefacts are generated AND committed. Committing them keeps the
   drag-and-drop deploy honest; --check is what stops a hand-edit of a
   generated file from silently surviving.

   Placeholders. site.mjs exports `placeholders()`, an audit of values that
   are still stand-ins: today the 555 dispatch number and the missing Texas
   DPS license number. After every successful build or check this script
   prints a warning block naming each one, the file:line to edit, and what
   it costs while it ships (a 555 number means every tel: link on the site
   dials a dead line). The warning alone never fails the build, because a
   contributor should still be able to build the site; `--strict` is what
   turns it into a refusal, so a deploy job that runs
   `node build.mjs --check --strict` cannot publish the placeholder by
   accident. Both are documented for Cameron next to the values themselves.
   ========================================================================== */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { page } from './src/templates/page.mjs';
import { invoicePage } from './src/templates/invoice/page.mjs';
import { careersPage } from './src/templates/careers/page.mjs';
import { placeholders } from './src/data/site.mjs';

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
    'components/reveal.css',
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
    'components/invoice-builder.css',
    'components/invoice-doc.css',
    'utilities.css',
    'components/invoice-print.css'
];

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

const artefacts = () => [
    { path: join(ROOT, 'index.html'), contents: String(page()) },
    { path: join(ROOT, 'css', 'site.css'), contents: buildStyles(STYLE_ORDER) },
    { path: join(ROOT, 'invoice.html'), contents: String(invoicePage()) },
    { path: join(ROOT, 'css', 'invoice.css'), contents: buildStyles(INVOICE_STYLE_ORDER) },
    { path: join(ROOT, 'careers.html'), contents: String(careersPage()) }
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

/* ---------------------------------------------------------------------------
   PLACEHOLDER REPORT
   Runs after a build or check has succeeded, never instead of one: the point
   is that the site builds fine and is still not fit to publish. The line
   number is found by searching the data file for the entry's `anchor` text
   rather than being hard-coded in site.mjs, so it stays right as that file
   is edited above the definition.
   --------------------------------------------------------------------------- */

/* Folds `text` under `label` with a hanging indent, no line wider than
   `width`, so a two-sentence consequence reads as a paragraph in a terminal
   and its label lines up with the `value:` and `edit:` rows above it. */
function wrap(label, text, indent, width = 78) {
    const hang = ' '.repeat(label.length);
    const lines = [];
    let line = '';
    for (const word of text.split(/\s+/)) {
        const prefix = indent + (lines.length ? hang : label);
        if (line && (prefix + line + ' ' + word).length > width) {
            lines.push(prefix + line);
            line = word;
        } else {
            line = line ? `${line} ${word}` : word;
        }
    }
    if (line) lines.push(indent + (lines.length ? hang : label) + line);
    return lines.join('\n');
}

function locate(file, anchor) {
    try {
        const lines = readFileSync(join(ROOT, file), 'utf8').split('\n');
        const index = lines.findIndex((l) => l.includes(anchor));
        return index === -1 ? file : `${file}:${index + 1}`;
    } catch {
        return file;
    }
}

function reportPlaceholders(strict) {
    const unresolved = placeholders();

    if (unresolved.length === 0) {
        if (strict) console.log('\n--strict: no placeholder values remain in src/data/site.mjs.');
        return;
    }

    const rule = '='.repeat(78);
    const noun = unresolved.length === 1 ? 'PLACEHOLDER VALUE IS' : 'PLACEHOLDER VALUES ARE';
    const out = [
        '',
        rule,
        `  WARNING: ${unresolved.length} ${noun} STILL IN THE GENERATED SITE`,
        rule
    ];

    unresolved.forEach((item, i) => {
        out.push(
            '',
            `  ${i + 1}. ${item.label}`,
            `     value:        ${item.value}`,
            `     edit:         ${locate(item.file, item.anchor)}`,
            /* The consequence is a sentence or two; fold it under its label. */
            wrap('consequence:  ', item.consequence, '     ')
        );
    });

    out.push(
        '',
        '  The site built, but it is not ready to publish. Fix the values above in',
        '  src/data/site.mjs, rebuild, and commit the regenerated output.',
        strict
            ? '  --strict is set: exiting 1 so this build cannot be deployed as it stands.'
            : '  Run `node build.mjs --strict` to make this a hard failure in a deploy job.',
        rule,
        ''
    );

    console.error(out.join('\n'));
    if (strict) process.exit(1);
}

const strict = process.argv.includes('--strict');

if (process.argv.includes('--check')) {
    console.log('Checking generated output...');
    check();
} else {
    console.log('Building Fused Protective Services...');
    write();
    console.log('\nDone. Preview with: python3 serve.py');
}

/* Only reached when the build or check above succeeded: check() has already
   exited 1 on drift, and a template error has already thrown. */
reportPlaceholders(strict);
