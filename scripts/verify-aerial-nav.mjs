// Verify the new Aerial nav entry: present, reachable, and no layout overflow.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const BASE = process.env.AERIAL_PREVIEW_URL || 'http://127.0.0.1:5050';
const browser = await chromium.launch();
let failures = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${extra ? ' :: ' + extra : ''}`); if (!ok) failures++; };

for (const width of [375, 414, 768, 1024, 1440]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(400);

  const m = await page.evaluate(() => {
    const links = [...document.querySelectorAll('a[href]')];
    const aerial = links.filter(a => /aerial/i.test(a.getAttribute('href')));
    return {
      docWidth: document.documentElement.scrollWidth,
      inner: window.innerWidth,
      aerialCount: aerial.length,
      aerialHrefs: [...new Set(aerial.map(a => a.getAttribute('href')))],
      // Any nav link visibly spilling past the viewport?
      navOverflow: [...document.querySelectorAll('nav a, header a')]
        .filter(a => a.getClientRects().length)
        .filter(a => { const r = a.getBoundingClientRect(); return r.right > window.innerWidth + 1 || r.left < -1; })
        .map(a => a.textContent.trim()),
    };
  });
  check(`${width}px: no horizontal page overflow`, m.docWidth <= m.inner + 1, `doc=${m.docWidth} inner=${m.inner}`);
  check(`${width}px: no nav link spills outside viewport`, m.navOverflow.length === 0, m.navOverflow.join(','));
  check(`${width}px: Aerial link present`, m.aerialCount > 0, `hrefs=${m.aerialHrefs.join('|')}`);
  check(`${width}px: no page errors`, errors.length === 0, errors.join('; '));
  await page.close();
}

// The link must actually resolve to the real page with a live scene.
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE + '/aerial.html?verify=1', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__aerial?.ready, { timeout: 60000 });
const s = await page.evaluate(() => window.__aerial.stats());
check('aerial page loads model via nav path', s.modelLoaded === true);
check('rotor rig recognized (4 rotors)', s.rotorCount === 4, `rotorCount=${s.rotorCount}`);
check('page is indexable (no noindex)', await page.locator('meta[name="robots"][content*="noindex"]').count() === 0);
check('canonical points at /aerial', (await page.locator('link[rel="canonical"]').getAttribute('href')) === 'https://fusedprotectiveservices.com/aerial');
check('home link returns to site root', await page.locator('.aerial-nav a[href="/"]').count() > 0);
await page.close();

console.log(failures ? `\n${failures} FAILED` : '\nALL NAV/INTEGRATION CHECKS PASSED');
await browser.close();
process.exit(failures ? 1 : 0);
