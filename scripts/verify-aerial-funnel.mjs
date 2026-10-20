// Local conversion checks. All intake requests are intercepted; no real leads are sent.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { aerial } from '../src/data/aerial.mjs';
import { divisions } from '../src/data/divisions.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '../app/node_modules/playwright/index.mjs');
const { default: AxeBuilder } = await import(process.env.AXE_MODULE || '../app/node_modules/@axe-core/playwright/dist/index.mjs');
const BASE = process.env.SITE_PREVIEW_URL || 'http://127.0.0.1:5050';
const OUT = 'output/playwright/aerial-funnel';
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const checks = [], errors = [];
const check = (name, ok) => { checks.push({ name, pass: Boolean(ok) }); assert.ok(ok, name); };
try {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (/Content Security Policy|Refused to|violates.*directive/i.test(m.text())) errors.push(m.text()); });
    await context.route('**/api/client-error', r => r.fulfill({ status: 200, body: '{}' }));
    for (const width of [320, 375, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(BASE + '/aerial');
        await page.evaluate(() => document.fonts.ready);
        await page.waitForFunction(() => document.documentElement.dataset.aerialState === 'ready');
        for (let i = 0; i < 4; i++) {
            const chapter = page.locator('.aerial-chapter').nth(i);
            await chapter.evaluate(el => scrollTo({ top: el.offsetTop, behavior: 'instant' }));
            const fit = await chapter.evaluate(el => {
                const copy = el.querySelector('.aerial-copy').getBoundingClientRect();
                const cta = el.querySelector('.aerial-inquiry').getBoundingClientRect();
                const controls = document.querySelector('.aerial-controls').getBoundingClientRect();
                const nav = document.querySelector('.aerial-nav').getBoundingClientRect();
                return { overflow: document.documentElement.scrollWidth > innerWidth + 1,
                    copyFits: copy.top >= nav.bottom && copy.bottom <= innerHeight,
                    ctaClear: cta.bottom <= controls.top || cta.right <= controls.left,
                    hit: document.elementFromPoint(cta.x + cta.width / 2, cta.y + cta.height / 2)?.closest('a')?.classList.contains('aerial-inquiry') };
            });
            check(`${width}px chapter ${i}: copy fits below navigation`, fit.copyFits);
            check(`${width}px chapter ${i}: CTA clickable and clear of controls`, fit.ctaClear && fit.hit);
            check(`${width}px chapter ${i}: no horizontal overflow`, !fit.overflow);
            if ([375, 1440].includes(width)) await page.screenshot({ path: `${OUT}/chapter-${i}-${width}.png` });
        }
        const navFit = await page.locator('.aerial-nav').evaluate(el => {
            const a = el.children[0].getBoundingClientRect(), b = el.children[1].getBoundingClientRect();
            return a.right + 8 <= b.left;
        });
        check(`${width}px navigation links do not overlap`, navFit);
        await page.locator('.aerial-next').first().click();
        check(`${width}px Continue leaves the next heading below navigation`, await page.locator('#chapter-1').evaluate(el =>
            el.getBoundingClientRect().top >= document.querySelector('.aerial-nav').getBoundingClientRect().bottom));
    }
    await page.setViewportSize({ width: 375, height: 900 });
    await page.goto(BASE + '/aerial');
    for (const mode of ['day', 'night']) {
        await page.locator(`[data-action=${mode}]`).click();
        check(`${mode}: selected`, await page.locator(`[data-action=${mode}]`).getAttribute('aria-pressed') === 'true');
        const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        check(`${mode}: WCAG AA`, scan.violations.length === 0);
    }
    let payload, delivery = 'failed';
    await page.route('**/api/intake', async route => {
        payload = route.request().postDataJSON();
        if (delivery === 'offline') return route.abort();
        if (delivery === 'invalid') return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        return route.fulfill({ status: delivery === 'failed' ? 503 : 200, contentType: 'application/json',
            body: JSON.stringify(delivery === 'failed' ? { ok: false, message: 'Preview delivery unavailable' } : { ok: true, refCode: 'AERIAL-PREVIEW' }) });
    });
    await page.locator('.aerial-inquiry').first().click();
    await page.locator('#quote h2').filter({ hasText: aerial.inquiry.title }).waitFor();
    check('CTA reaches the drone-specific inquiry form', new URL(page.url()).searchParams.get('service') === 'aerial');
    check('property division has no silent PPO default', await page.locator('#formDivision').inputValue() === '');
    check('original seven divisions retained', await page.locator('#formDivision option').count() === divisions.length + 1);
    check('armed preference starts with recommendation', /Recommendation/.test(await page.locator('#formArmedPreference').inputValue()));
    await page.screenshot({ path: `${OUT}/inquiry-375.png` });
    for (const [id, value] of Object.entries({ formName: 'Aerial Preview', formPhone: '5125550100', formEmail: 'preview@example.com', formLocation: 'Preview property', formSchedule: 'Dates to discuss', formNotes: 'North gate and 20 acres.' })) await page.locator(`#${id}`).fill(value);
    await page.locator('#securityQuoteForm [type=submit]').click();
    check('division choice required before sending', !payload && await page.locator('#formDivision').evaluate(el => !el.validity.valid));
    await page.locator('#formDivision').selectOption(divisions.find(d => d.code.includes('RANCH')).quoteValue);
    for (const mode of ['failed', 'offline', 'invalid']) {
        delivery = mode;
        await page.locator('#securityQuoteForm [type=submit]').click();
        await page.locator('#formStatus').filter({ hasText: mode === 'failed' ? 'Preview delivery unavailable' : 'We could not send' }).waitFor();
        check(`${mode}: no false success or lost input`, await page.locator('#formNotes').inputValue() === 'North gate and 20 acres.');
    }
    delivery = 'success';
    await page.locator('#securityQuoteForm [type=submit]').click();
    await page.locator('#formStatus').filter({ hasText: 'AERIAL-PREVIEW' }).waitFor();
    check('payload preserves aerial intent and buyer notes', payload.formNotes === `${aerial.inquiry.marker}\n\nNorth gate and 20 acres.`);
    check('payload preserves division contract', payload.formDivision === divisions.find(d => d.code.includes('RANCH')).quoteValue);
    check('confirmation distinguishes request from booking', (await page.locator('#formStatus').textContent()).includes('not a confirmed booking'));
    check('consent remains opt-in', !payload.formSmsConsent);
    check('successful form resets', await page.locator('#formName').inputValue() === '');
    check('reset retains consultation preference for another drone inquiry', /Recommendation/.test(await page.locator('#formArmedPreference').inputValue()));
    await page.goto(BASE + '/?service=unknown#quote');
    check('unknown service leaves standard quote copy alone', !(await page.locator('#quote h2').textContent()).includes('drone'));
    await page.goto(BASE + '/');
    check('normal form keeps original seven division options', await page.locator('#formDivision option').count() === 7);
    const plainContext = await browser.newContext({ javaScriptEnabled: false });
    const plain = await plainContext.newPage();
    await plain.goto(BASE + '/aerial');
    check('no-JavaScript offer and inquiry remain available', await plain.locator('.aerial-inquiry').count() === 4 && (await plain.locator('h1').textContent()).includes('Drone patrols'));
    await plainContext.close();
    await page.goto(pathToFileURL(process.cwd() + '/docs/fused-aerial-competitive-brief-2026-10-20.html').href);
    check('research brief renders four sections and embedded styling', await page.locator('section').count() === 4 && await page.locator('style').count() === 1);
    check('research sources remain clickable', await page.locator('a[href^="https://"]').count() === 6);
    await page.screenshot({ path: `${OUT}/research-brief.png`, fullPage: true });
    check('no runtime or CSP errors', errors.length === 0);
    await writeFile(`${OUT}/verification.json`, JSON.stringify({ checks, errors }, null, 2));
    console.log(`${checks.length} aerial funnel checks passed; captures in ${OUT}`);
} finally { await browser.close(); }
