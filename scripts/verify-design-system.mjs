// Public-site visual and interaction regression checks. Serve with python3 serve.py.
// Uses an existing external Playwright install; adds no site dependencies.
// PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node scripts/verify-design-system.mjs
// Optional AXE_MODULE=/absolute/path/to/@axe-core/playwright/dist/index.mjs enables AA scans.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { tiers } from '../src/data/estimator.mjs';
import { divisions } from '../src/data/divisions.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const AxeBuilder = process.env.AXE_MODULE ? (await import(process.env.AXE_MODULE)).default : null;
const BASE = process.env.SITE_PREVIEW_URL || 'http://127.0.0.1:5050';
const OUT = process.env.SITE_SCREENSHOTS || 'output/playwright';
const paths = ['/', '/careers', '/aerial', '/privacy', '/terms', '/sms-consent', '/invoice'];
const browser = await chromium.launch();
const errors = [];
let checks = 0;
const check = (name, ok) => { assert.ok(ok, name); checks++; };
await mkdir(OUT, { recursive: true });

try {
    // Real computed styles, responsive geometry, browser/CSP errors, both motion modes.
    for (const reducedMotion of process.env.SITE_FLOWS_ONLY ? [] : ['reduce', 'no-preference']) {
        const context = await browser.newContext({ reducedMotion });
        for (const width of [320, 375, 768, 1024, 1440]) {
            const page = await context.newPage();
            await page.setViewportSize({ width, height: 900 });
            page.on('pageerror', e => errors.push(e.message));
            page.on('console', m => { if (/Content Security Policy|Refused to|violates.*directive/i.test(m.text())) errors.push(m.text()); });
            for (const path of paths) {
                const response = await page.goto(BASE + path);
                await page.evaluate(() => document.fonts.ready);
                if (path === '/careers') await page.waitForFunction(() => getComputedStyle(document.querySelector('h1')).opacity === '1');
                const styles = await page.evaluate(() => {
                    const h1 = getComputedStyle(document.querySelector('h1'));
                    return {
                        overflow: document.documentElement.scrollWidth > innerWidth + 1,
                        family: h1.fontFamily, weight: h1.fontWeight,
                        tracking: parseFloat(h1.letterSpacing),
                        fields: [...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=range]), select, textarea')]
                            .filter(e => e.getBoundingClientRect().width > 1 && e.getBoundingClientRect().left >= 0)
                            .every(e => parseFloat(getComputedStyle(e).fontSize) >= 16),
                    };
                });
                check(`${path} ${width}px ${reducedMotion}: HTTP 200`, response.status() === 200);
                check(`${path} ${width}px ${reducedMotion}: no horizontal overflow`, !styles.overflow);
                check(`${path}: Outfit 400 heading with aerial tracking`, /Outfit/.test(styles.family) && styles.weight === '400' && styles.tracking < 0);
                check(`${path}: phone-safe input type size`, styles.fields);
                if ([375, 1440].includes(width) && reducedMotion === 'reduce') {
                    const target = path === '/' ? '.hero' : path === '/careers' ? '.careers-hero-section' : path === '/aerial' ? '.aerial-chapter' : 'main';
                    await page.evaluate(sel => scrollTo({ top: Math.max(0, document.querySelector(sel).getBoundingClientRect().top + scrollY - 96), behavior: 'instant' }), target);
                    await page.screenshot({ path: `${OUT}/${path === '/' ? 'home' : path.slice(1)}-${width}.png` });
                }
                if (AxeBuilder && width === 1440) {
                    console.log(`Scanning ${path} (${reducedMotion})`);
                    const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
                    check(`${path} ${reducedMotion}: WCAG AA`, scan.violations.length === 0 || (console.log(JSON.stringify(scan.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })))), false));
                }
            }
            await page.close();
        }
        await context.close();
    }

    const context = await browser.newContext({ viewport: { width: 375, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    // Intercept every intake request in this isolated browser. No real leads are sent.
    let payload, failDelivery = false;
    await page.route('**/api/intake', async route => {
        payload = route.request().postDataJSON();
        await route.fulfill({ status: failDelivery ? 503 : 200, contentType: 'application/json',
            body: JSON.stringify(failDelivery ? { ok: false, message: 'Preview delivery unavailable' } : { ok: true, refCode: 'VISUAL-PREVIEW' }) });
    });
    await page.goto(BASE + '/');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    check('Skip link focuses main', await page.locator('main').evaluate(e => e === document.activeElement));

    console.log('Checking keyboard and conversion flows');
    const menu = page.locator('[data-action="open-drawer"]');
    await menu.click();
    await page.locator("#mobileDrawer.open").waitFor();
    check('Mobile menu opens', await menu.getAttribute('aria-expanded') === 'true');
    const last = page.locator('.drawer-foot a');
    await last.focus(); await page.keyboard.press('Tab');
    check('Menu traps forward focus', await page.locator('.drawer-close').evaluate(e => e === document.activeElement));
    await page.keyboard.press('Shift+Tab');
    check('Menu traps backward focus', await last.evaluate(e => e === document.activeElement));
    await page.keyboard.press('Escape');
    check('Escape returns focus to menu trigger', await menu.evaluate(e => e === document.activeElement));

    const rails = page.locator('.spine-rail');
    check('All seven service divisions remain', await rails.count() === divisions.length);
    for (let i = 0; i < divisions.length; i++) {
        await rails.nth(i).focus(); await page.keyboard.press('Enter');
        const spine = page.locator('.bookshelf-spine').nth(i);
        check(`Division ${i + 1} keyboard expansion`, await rails.nth(i).getAttribute('aria-expanded') === 'true');
        await spine.locator('[data-deploy]').click();
        check(`Division ${i + 1} prefills quote`, await page.locator('#formDivision').inputValue() === divisions[i].quoteValue);
    }
    const tabs = page.locator('.protocol-stepper-btn');
    await tabs.first().focus(); await page.keyboard.press('ArrowRight');
    check('Protocol arrow-key navigation', await tabs.nth(1).getAttribute('aria-selected') === 'true');
    await page.keyboard.press('End');
    check('Protocol End key', await tabs.last().getAttribute('aria-selected') === 'true');
    await page.keyboard.press('Home');
    check('Protocol Home key', await tabs.first().getAttribute('aria-selected') === 'true');

    await page.locator('[data-quiz-step="environment"]').first().click();
    await page.locator('[data-quiz-step="threat"]').first().click();
    check('Assessment shows result', await page.locator('#quizResult').isVisible());
    await page.locator('#formNotes').fill('Keep these coverage notes.');
    await page.locator('[data-action="apply-assessment"]').click();
    check('Assessment preserves notes and appends recommendation', /Keep these coverage notes\.[\s\S]*Assessment Results:/.test(await page.locator('#formNotes').inputValue()));

    for (const tier of tiers) {
        await page.locator(`[data-tier="${tier.id}"]`).click();
        check(`${tier.label} estimator calculates`, (await page.locator('#calculatedTotal').textContent()).replace(/[^\d]/g, '') === String(tier.rate * 2 * 8));
    }
    await page.locator('#guardRange').fill('3'); await page.locator('#hoursRange').fill('10');
    await page.locator('[data-action="apply-estimate"]').click();
    check('Estimator applies selected tier', await page.locator('#formDivision').inputValue() === tiers.at(-1).division);
    check('Estimator applies schedule', /10.*3/.test(await page.locator('#formSchedule').inputValue()));
    await page.locator('#formName').focus();
    check('Input focus remains visible', await page.locator('#formName').evaluate(e => getComputedStyle(e).outlineStyle !== 'none'));
    for (const [id, value] of Object.entries({ formName: 'Visual Preview', formPhone: '5125550100', formEmail: 'preview@example.com', formLocation: 'Preview site' })) await page.locator(`#${id}`).fill(value);
    failDelivery = true;
    await page.locator('#securityQuoteForm [type=submit]').click();
    await page.locator('#formStatus').filter({ hasText: 'Preview delivery unavailable' }).waitFor();
    check('Quote delivery failure preserves input', await page.locator('#formName').inputValue() === 'Visual Preview');
    failDelivery = false;
    await page.locator('#securityQuoteForm [type=submit]').click();
    await page.locator('#formStatus').filter({ hasText: 'VISUAL-PREVIEW' }).waitFor();
    check('Quote submits expected form payload', payload.type === 'quote' && payload.formName === 'Visual Preview');
    const faq = page.locator('.faq-box').first();
    await faq.locator('summary').focus(); await page.keyboard.press('Enter');
    check('FAQ keyboard toggle', await faq.getAttribute('open') !== null);

    await page.goto(BASE + '/careers');
    const filters = page.locator('[data-filter]');
    for (let i = 0; i < await filters.count(); i++) {
        await filters.nth(i).focus(); await page.keyboard.press('Enter');
        const filter = await filters.nth(i).getAttribute('data-filter');
        check(`Careers ${filter} filter`, await page.locator('.position-card').evaluateAll((cards, value) => cards.every(e => e.hidden === (value !== 'all' && e.dataset.category !== value)), filter));
    }
    await filters.first().click();
    const toggle = page.locator('[data-action="toggle-details"]').first();
    await toggle.focus(); await page.keyboard.press('Enter');
    check('Careers requirements expand', await toggle.getAttribute('aria-expanded') === 'true');
    await page.locator('[data-action="apply-post"]').first().click();
    check('Apply preselects role', !!await page.locator('#appPosition').inputValue());
    await page.locator('#evaluatePrequalBtn').click();
    check('Eligibility incomplete feedback', await page.locator('#feedbackBadge').textContent() === 'SELECTION INCOMPLETE');
    for (const name of ['age', 'license', 'background']) await page.locator(`input[name="${name}"][value=yes]`).check();
    await page.locator('#evaluatePrequalBtn').click();
    check('Eligibility success feedback', !await page.locator('#prequalFeedback').evaluate(e => e.classList.contains('rejected')));
    await page.locator('input[name=age][value=no]').check(); await page.locator('#evaluatePrequalBtn').click();
    check('Eligibility rejection feedback', await page.locator('#prequalFeedback').evaluate(e => e.classList.contains('rejected')));
    await page.locator('#appLicenseLevel').selectOption({ index: 1 });
    for (const [id, value] of Object.entries({ appFullName: 'Visual Preview', appPhone: '5125550100', appEmail: 'preview@example.com', appBio: 'Local visual verification only.' })) await page.locator(`#${id}`).fill(value);
    await page.locator('#submitCandidateBtn').click();
    await page.locator('#candidateStatus').filter({ hasText: 'Application Received' }).waitFor();
    check('Application submits expected payload', payload.type === 'candidate' && payload.appFullName === 'Visual Preview');

    await page.goto(BASE + '/invoice');
    await page.locator('#invExportEmpty:not([hidden])').waitFor();
    check('Legacy export empty state', await page.locator('#invExportEmpty').isVisible());
    await page.evaluate(() => localStorage.setItem('fps_invoices_v1', JSON.stringify([{number:'FPS-2026-0001', notes:'Preview export'}])));
    await page.reload();
    await page.locator('#invExportSummary:not([hidden])').waitFor();
    check('Legacy export retains saved invoice JSON', (await page.locator('#invExportJson').textContent()).includes('FPS-2026-0001'));
    await context.close();

    const noScript = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 900 } });
    const staticPage = await noScript.newPage();
    for (const path of paths) {
        await staticPage.goto(BASE + path);
        check(`${path}: heading readable without JavaScript`, await staticPage.locator('h1').isVisible());
    }
    await noScript.close();
    check('No page or CSP errors', errors.length === 0 || (console.log(errors), false));
    console.log(`${checks} design-system and interaction checks passed${AxeBuilder ? ', including all seven pages in both AA scan modes' : ''}.`);
} finally {
    await browser.close();
}
