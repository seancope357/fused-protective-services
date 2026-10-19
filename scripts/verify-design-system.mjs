// I cannot see images, so verify the design-system page and homepage rendered the
// real tokens rather than falling back to unstyled defaults.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const BASE = 'http://127.0.0.1:5050';
const browser = await chromium.launch();
let fail = 0;
const ck = (n, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'}  ${n}${extra ? ' :: ' + extra : ''}`); if (!ok) fail++; };

// --- design-system reference page ---
let ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, reducedMotion: 'reduce' });
let page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto(BASE + '/prototypes/design-system/', { waitUntil: 'load' });
await page.waitForTimeout(1000);
const ds = await page.evaluate(() => {
  const g = (sel, p) => { const e = document.querySelector(sel); return e ? getComputedStyle(e)[p] : null; };
  return {
    cssLoaded: getComputedStyle(document.body).backgroundColor,
    displayWeight: g('.display', 'fontWeight'),
    displayTracking: g('.display', 'letterSpacing'),
    displayFamily: g('.display', 'fontFamily'),
    displayXlSize: g('.display--xl', 'fontSize'),
    eyebrowTracking: g('.eyebrow', 'letterSpacing'),
    eyebrowTransform: g('.eyebrow', 'textTransform'),
    linkRuleBorder: g('.link-rule', 'borderBottomColor'),
    linkRuleMin: g('.link-rule', 'minHeight'),
    pillRadius: g('.pill', 'borderRadius'),
    pillMin: g('.pill', 'minHeight'),
    proseMeasure: g('.prose', 'maxWidth'),
    btnGoldBg: g('.btn-gold', 'backgroundImage'),
    sections: document.querySelectorAll('.ds-sec').length,
    swatches: document.querySelectorAll('.ds-swatches li').length,
  };
});
ck('DS page: real site.css loaded', ds.cssLoaded === 'rgb(5, 5, 4)', ds.cssLoaded);
ck('DS page: --display-weight resolves to 400', ds.displayWeight === '400', ds.displayWeight);
ck('DS page: negative tracking applied', parseFloat(ds.displayTracking) < 0, ds.displayTracking);
ck('DS page: display uses Outfit not Cinzel', /Outfit/i.test(ds.displayFamily) && !/Cinzel/i.test(ds.displayFamily), ds.displayFamily);
ck('DS page: display--xl is large', parseFloat(ds.displayXlSize) >= 51, ds.displayXlSize);
ck('DS page: eyebrow is wide + uppercase', parseFloat(ds.eyebrowTracking) > 1 && ds.eyebrowTransform === 'uppercase', `${ds.eyebrowTracking}/${ds.eyebrowTransform}`);
ck('DS page: link-rule gold hairline', ds.linkRuleBorder === 'rgb(198, 162, 92)', ds.linkRuleBorder);
ck('DS page: link-rule 44px target', parseFloat(ds.linkRuleMin) >= 44, ds.linkRuleMin);
ck('DS page: pill is a full-radius 44px control', parseFloat(ds.pillRadius) > 100 && parseFloat(ds.pillMin) >= 44, `${ds.pillRadius}/${ds.pillMin}`);
ck('DS page: prose held to body measure', ds.proseMeasure === '380px', ds.proseMeasure);
ck('DS page: btn-gold uses CLAMPED ui ramp', ds.btnGoldBg.includes('161, 129, 76') && !ds.btnGoldBg.includes('114, 84, 43'), ds.btnGoldBg.slice(0, 120));
ck('DS page: all sections rendered', ds.sections >= 5 && ds.swatches === 7, `${ds.sections} sections / ${ds.swatches} swatches`);
ck('DS page: no page errors', errs.length === 0, errs.join(';'));
await ctx.close();

// --- live homepage: architectural register intact, gold face now safe ---
ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, reducedMotion: 'reduce' });
page = await ctx.newPage();
await page.goto(BASE + '/', { waitUntil: 'load' });
await page.waitForTimeout(2000);
const home = await page.evaluate(() => {
  const g = (sel, p) => { const e = document.querySelector(sel); return e ? getComputedStyle(e)[p] : null; };
  return {
    heroFamily: g('.hero-title, h1', 'fontFamily'),
    heroWeight: g('.hero-title, h1', 'fontWeight'),
    btnGoldBg: g('.btn-gold', 'backgroundImage'),
    btnGoldColor: g('.btn-gold', 'color'),
    outlineBefore: !!document.querySelector('.btn-outline'),
    editorialAvailable: !!getComputedStyle(document.documentElement).getPropertyValue('--display-tracking').trim(),
  };
});
ck('Home: hero still ARCHITECTURAL (Cinzel)', /Cinzel/i.test(home.heroFamily || ''), home.heroFamily);
ck('Home: hero still heavy weight', parseInt(home.heroWeight) >= 700, home.heroWeight);
ck('Home: btn-gold now on clamped ramp', (home.btnGoldBg || '').includes('161, 129, 76') && !(home.btnGoldBg || '').includes('114, 84, 43'), (home.btnGoldBg || '').slice(0, 120));
ck('Home: btn-gold keeps dark label', home.btnGoldColor === 'rgb(5, 5, 4)', home.btnGoldColor);
ck('Home: editorial tokens available site-wide', home.editorialAvailable === true, String(home.editorialAvailable));
await browser.close();
console.log(fail ? `\n${fail} FAILED` : '\nDESIGN SYSTEM VERIFIED — tokens real, registers distinct, gold faces safe');
process.exit(fail ? 1 : 0);
