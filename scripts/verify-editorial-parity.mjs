// Prove the editorial token refactor is visually neutral on /aerial by comparing
// COMPUTED styles between local (new tokens) and production (pre-refactor CSS).
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const LOCAL = process.env.LOCAL_URL || 'http://127.0.0.1:5050/aerial';
const PROD = process.env.PROD_URL || 'https://fusedprotectiveservices.com/aerial';

const PROBE = `(() => {
  const want = {
    '.aerial-copy': ['maxWidth'],
    '.aerial-copy h1': ['fontSize','fontWeight','lineHeight','letterSpacing','fontFamily','textTransform','maxWidth'],
    '.aerial-copy h2': ['fontSize','fontWeight','lineHeight','letterSpacing'],
    '.aerial-eyebrow': ['fontSize','letterSpacing','textTransform','color'],
    '.aerial-chapter': ['paddingTop','paddingLeft','minHeight','alignItems'],
    '.aerial-inquiry': ['borderBottomColor','borderBottomWidth','paddingTop'],
    '.aerial-controls button': ['minHeight','borderRadius','borderColor','backgroundColor','fontSize'],
    '.aerial-nav a': ['letterSpacing','fontSize','minHeight'],
  };
  const out = {};
  for (const [sel, props] of Object.entries(want)) {
    const el = document.querySelector(sel);
    if (!el) { out[sel] = 'MISSING'; continue; }
    const cs = getComputedStyle(el);
    out[sel] = Object.fromEntries(props.map(p => [p, cs[p]]));
  }
  // Body prose paragraph (first non-eyebrow p inside copy)
  const p = [...document.querySelectorAll('.aerial-copy > p')].find(e => !e.classList.contains('aerial-eyebrow'));
  if (p) { const cs = getComputedStyle(p); out['prose p'] = { fontSize: cs.fontSize, lineHeight: cs.lineHeight, maxWidth: cs.maxWidth, color: cs.color }; }
  return out;
})()`;

async function probe(url) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(2500);
  const r = await page.evaluate(PROBE);
  await browser.close();
  return r;
}

const [a, b] = await Promise.all([probe(LOCAL), probe(PROD)]);
let diffs = 0, checked = 0;
for (const sel of Object.keys(b)) {
  const la = a[sel], lb = b[sel];
  if (typeof lb === 'string' || typeof la === 'string') {
    if (la !== lb) { console.log(`DIFF ${sel}: local=${la} prod=${lb}`); diffs++; }
    continue;
  }
  for (const p of Object.keys(lb)) {
    checked++;
    if (la?.[p] !== lb[p]) { console.log(`DIFF ${sel} { ${p} }  local="${la?.[p]}"  prod="${lb[p]}"`); diffs++; }
  }
}
console.log(`\n${checked} computed properties compared across ${Object.keys(b).length} selectors`);
console.log(diffs ? `${diffs} DIFFERENCES — refactor changed rendering` : 'IDENTICAL — editorial token refactor is visually neutral on /aerial');
process.exit(diffs ? 1 : 0);
