#!/usr/bin/env node
/* ==========================================================================
   Mirrors the repository's shared source (business facts, transports, design
   tokens) into app/shared/ before build, typecheck and test. The copies are
   gitignored build inputs, never edited: the single source stays in
   ../src/data, ../src/lib, ../src/styles and ../api/_lib, and the repo layout
   is preserved so the copied modules' own relative imports keep resolving.
   ========================================================================== */

import { cpSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const app = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = join(app, '..');
const out = join(app, 'shared');

const sources = [
    ['src/data', 'src/data'],
    ['src/lib', 'src/lib'],
    ['src/styles/tokens.css', 'src/styles/tokens.css'],
    ['api/_lib', 'api/_lib']
];

for (const [from] of sources) {
    if (!existsSync(join(repo, from))) {
        console.error(`sync-shared: ${from} is missing. The portal must be built from a checkout of the whole repository.`);
        process.exit(1);
    }
}
rmSync(out, { recursive: true, force: true });
for (const [from, to] of sources) {
    mkdirSync(dirname(join(out, to)), { recursive: true });
    cpSync(join(repo, from), join(out, to), { recursive: true });
}
console.log(`sync-shared: mirrored ${sources.length} sources into app/shared/`);
