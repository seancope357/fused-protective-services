/* ==========================================================================
   SPEC-008 — accessibility conformance for the portal screens.

   axe-core, driven through real Chromium, against a running portal. The
   static marketing site is scanned separately by the `a11y` job in
   .github/workflows/ci.yml using @axe-core/cli; `app/` is the only
   workspace in this repository allowed dependencies, which is why the
   Playwright half lives here.

   GATING. The suite needs a portal to point at, so it reads A11Y_PORTAL_URL
   and skips itself when that is absent — the same shape as the database
   suites, which skip without TEST_DATABASE_URL. The `a11y` CI job builds
   the portal, starts it, and sets the variable, so the skip never applies
   where the gate is meant to run. It exists so that `pnpm test` in the
   `portal` job stays a fast, browserless unit run.

   NO RULE IS DISABLED HERE, and none may be. The tag list below is the
   conformance target from context/ui-standards.md — WCAG 2.1 AA — and the
   assertion is a plain "zero violations". If a finding needs a design
   decision, it goes in docs/A11Y-AUDIT.md and gets raised; it does not get
   an exclusion in this file.
   ========================================================================== */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import AxeBuilder from '@axe-core/playwright';
import { chromium, type Browser, type Page } from 'playwright';

const BASE = process.env.A11Y_PORTAL_URL;
const d = BASE ? describe : describe.skip;

if (!BASE) {
    console.warn(
        '[a11y] A11Y_PORTAL_URL is not set — portal accessibility scan skipped. ' +
        'The `a11y` CI job sets it; run locally with A11Y_PORTAL_URL=http://localhost:3000.'
    );
}

/** The conformance target. Four tags, matching the axe-core CLI invocation
    for the static pages so the two halves of the gate agree on what "AA"
    means. */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** Cameron's screens. Signed out for now: the seeded-session screens named
    in SPEC-008 design 2 need the test-database harness wired into this job,
    which is tracked as the next slice in docs/A11Y-AUDIT.md. */
const SCREENS = [{ path: '/login', name: 'sign-in' }];

const VIEWPORTS = [
    { name: 'desktop', width: 1280, height: 800 },
    /* 320px is the reflow floor in WCAG 1.4.10; the portal is used on a
       phone in a car park as often as at a desk. */
    { name: 'mobile-320', width: 320, height: 640 }
];

type Finding = { id: string; impact: string | null | undefined; target: string; summary: string };

/** Formats violations so a failing CI log is actionable without a rerun:
    every line carries the rule, the selector and the reason. */
const format = (findings: Finding[]) =>
    findings
        .map((f) => `  [${f.id}] (${f.impact ?? 'n/a'}) ${f.target}\n      ${f.summary}`)
        .join('\n');

d('portal accessibility (WCAG 2.1 AA)', () => {
    let browser: Browser;

    beforeAll(async () => {
        browser = await chromium.launch();
    });

    afterAll(async () => {
        await browser?.close();
    });

    for (const screen of SCREENS) {
        for (const vp of VIEWPORTS) {
            it(`${screen.name} (${vp.name}) has no WCAG 2.1 AA violations`, async () => {
                const context = await browser.newContext({
                    viewport: { width: vp.width, height: vp.height },
                    /* Scan the reduced-motion presentation: entrance
                       animations otherwise leave content mid-transition and
                       axe measures a colour that no visitor ever sees. */
                    reducedMotion: 'reduce'
                });
                const page: Page = await context.newPage();

                try {
                    const response = await page.goto(`${BASE}${screen.path}`, { waitUntil: 'networkidle' });
                    expect(
                        response?.status(),
                        `${screen.path} did not load — is the portal running at ${BASE}?`
                    ).toBeLessThan(400);

                    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();

                    const findings: Finding[] = results.violations.flatMap((v) =>
                        v.nodes.map((n) => ({
                            id: v.id,
                            impact: v.impact,
                            target: n.target.join(' '),
                            summary: (n.failureSummary ?? '').replace(/\s+/g, ' ').trim()
                        }))
                    );

                    expect(
                        findings,
                        findings.length
                            ? `${findings.length} accessibility violation(s) on ${screen.path} at ${vp.name}:\n${format(findings)}`
                            : ''
                    ).toEqual([]);
                } finally {
                    await context.close();
                }
            });
        }
    }

    /* Structural properties axe does not test at the AA tag levels but that
       decide whether the page is navigable at all with a screen reader. */
    it('sign-in exposes a page title and a language', async () => {
        const context = await browser.newContext();
        const page = await context.newPage();
        try {
            await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
            expect(await page.title()).not.toBe('');
            expect(await page.getAttribute('html', 'lang')).toBeTruthy();
        } finally {
            await context.close();
        }
    });
});
