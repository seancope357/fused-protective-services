// WCAG 2.1 contrast math for the gold ramp decision. No dependencies.
const srgb = c => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
const lum = hex => {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

const VOID = '#050504';
const ramp = {
  'gold-specular  0%': '#f7e5b2',
  'gold-highlight    ': '#dfc07b',
  'gold-glint        ': '#c6a25c',
  'gold-bevel   25%': '#ba9857',
  'gold-core    50%': '#a1814c',
  'gold-warm    75%': '#87693b',
  'gold-shadow 100%': '#72542b',
};

console.log('=== Current --gradient-gold-brushed stops vs --color-void ===');
console.log('(interactive faces need 4.5:1 normal text, 3:1 large text)\n');
for (const [name, hex] of Object.entries(ramp)) {
  const r = ratio(hex, VOID);
  const verdict = r >= 4.5 ? 'PASS 4.5' : r >= 3 ? 'large-text only' : 'FAIL';
  console.log(`  ${name}  ${hex}  ${r.toFixed(2)}:1  ${verdict}`);
}

console.log('\n=== Proposed --gradient-gold-brushed-ui (clamped at gold-core) ===');
const uiStops = ['#f7e5b2', '#ba9857', '#a1814c'];
let worst = Infinity;
for (const hex of uiStops) {
  const r = ratio(hex, VOID);
  worst = Math.min(worst, r);
  console.log(`  ${hex}  ${r.toFixed(2)}:1 on void`);
}
console.log(`  worst stop: ${worst.toFixed(2)}:1 -> ${worst >= 4.5 ? 'PASSES 4.5:1 everywhere' : 'STILL FAILS'}`);

console.log('\n=== Dark text ON a gold fill (button face) ===');
for (const hex of uiStops) console.log(`  ${VOID} on ${hex}  ${ratio(VOID, hex).toFixed(2)}:1`);

console.log('\n=== Aerial flat-gold usages (what Sean likes) ===');
for (const [label, hex] of [['--text-gold-core (eyebrow/rule)', '#c6a25c'], ['--text-gold-light (eyebrow)', '#f7e5b2']]) {
  console.log(`  ${label}  ${hex}  ${ratio(hex, VOID).toFixed(2)}:1 on void`);
}
console.log('\n=== Aerial border token ===');
console.log(`  --border-gold-subtle rgba(186,152,87,.35) over void composites to ~#473b26`);
const composite = (fg, a, bg) => {
  const h = x => [0, 2, 4].map(i => parseInt(x.replace('#', '').slice(i, i + 2), 16));
  const [fr, fg_, fb] = h(fg), [br, bg_, bb] = h(bg);
  const mix = (f, b) => Math.round(f * a + b * (1 - a));
  return '#' + [mix(fr, br), mix(fg_, bg_), mix(fb, bb)].map(v => v.toString(16).padStart(2, '0')).join('');
};
const comp = composite('#ba9857', 0.35, VOID);
console.log(`  computed composite: ${comp}  ${ratio(comp, VOID).toFixed(2)}:1 (decorative border, 3:1 non-text target)`);
