import { readFile } from 'node:fs/promises';

// three.js is vendored upstream as .js, while this dependency-free repo has
// deliberately no package.json declaring type:module. Older Node 20 versions
// therefore need an explicit module format in the geometry tests only.
const engineURL = new URL('../../js/vendor/three.module.js', import.meta.url).href;
export async function load(url, context, nextLoad) {
    if (url !== engineURL) return nextLoad(url, context);
    return { format: 'module', source: await readFile(new URL(url), 'utf8'), shortCircuit: true };
}
