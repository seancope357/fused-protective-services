/* ==========================================================================
   RESPONSIVE CAPTURE — every portal screen, signed in, at four widths.

   The verification harness for the mobile-first rebuild. It signs in as the
   seeded owner through the real /login UI (password, then a TOTP code on
   /login/mfa), signs a client and an officer in through the real magic-link
   landing (/auth/confirm), visits every route under /portal and /client plus
   the public /pay and /review pages, and for each screen × viewport:

     ASSERTS    HTTP status < 400; the page is the one asked for (not a
                redirect to /login); no console errors; no horizontal page
                overflow — documentElement.scrollWidth <= viewport width + 1
                (the emulated device width; see measure() for why not
                innerWidth).
     RECORDS    axe-core violations (WCAG 2.0/2.1 A+AA and 2.2 AA), and on
                phone/tablet every visible interactive element smaller than
                44×44 CSS px. Recorded, never failed on: they are the
                work-list, not the gate.
     SAVES      a full-page PNG to .demo/screens/<label>/<viewport>/<screen>.png
                and .demo/screens/<label>/report.json.

   GATING. Skips unless RESPONSIVE_PORTAL_URL is set, exactly as a11y.test.ts
   skips without A11Y_PORTAL_URL, so `pnpm test` stays a browserless unit run.
   `pnpm screens` sets it to http://localhost:3100 by default.

   PREREQUISITES. The local Supabase stack, `pnpm demo:seed`, and a portal
   running against that stack. See scripts/README-demo.md.

   ENV
     RESPONSIVE_PORTAL_URL  portal origin, e.g. http://localhost:3100
     SCREENS_LABEL          output folder under .demo/screens (default "after")
     DEMO_DIR               where owner/client/officer/ids.json live and where
                            screens are written (default app/.demo) — lets a
                            baseline checkout write into this worktree
     DEMO_ENV_FILE          env file holding SUPABASE_URL and the service key
                            used to mint magic links (default app/.env.local)
     SCREENS_ONLY           regex over screen names, for a quick partial run;
                            results merge into an existing report.json
     VIEWPORTS_ONLY         regex over viewport names

   HOW OVERFLOW IS MEASURED. documentElement.scrollWidth only grows when the
   page itself can scroll sideways. Content that scrolls inside its own
   overflow-x: auto container (a wide table in .table-wrap) is clipped by that
   container and does not grow it, so it is not counted; neither are
   position: fixed boxes (a bottom tab bar, a fixed action bar), which never
   contribute to the document's scrollable overflow. When a page does
   overflow, the report names the culprits: the innermost elements whose box
   extends past the viewport and which are not inside a clipping or fixed
   ancestor.

   HOW TAP TARGETS ARE MEASURED. Every visible a[href], button, input (not
   hidden), select, textarea and summary, by getBoundingClientRect — fixed
   elements included, measured by their own box like anything else. Two
   exemptions, both from WCAG 2.5.8's own exceptions:
     inline text links — an <a> whose computed display is `inline` and which
       shares a line with text: its parent (or any inline ancestor up to the
       first block) has a non-empty text node of its own. "Call dispatch at
       <a>512…</a>" is exempt; a link alone in a table cell is not.
     labelled checkboxes and radios — compliant when the associated <label>'s
       box is at least 44px tall, because the label is the target. The label
       size is reported either way.
   Elements of 1px or less in either dimension are visually hidden (skip
   links) and skipped. The audit runs at phone (375) and tablet (768); the
   320 run is for reflow only and does not repeat it.
   ========================================================================== */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import AxeBuilder from '@axe-core/playwright';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertLocalUrl, demoDir, demoEnv, readEnvFile, totp, waitForFreshStep } from '../scripts/demo-lib.mjs';

const BASE = process.env.RESPONSIVE_PORTAL_URL?.replace(/\/$/, '');
const d = BASE ? describe : describe.skip;

if (!BASE) {
    console.warn(
        '[responsive] RESPONSIVE_PORTAL_URL is not set — responsive capture skipped. ' +
        'Run `pnpm screens` against a seeded local portal (scripts/README-demo.md).'
    );
}

const APP = fileURLToPath(new URL('..', import.meta.url));
const LABEL = process.env.SCREENS_LABEL || 'after';
const DEMO = demoDir();
const OUT = join(DEMO, 'screens', LABEL);
const ONLY = process.env.SCREENS_ONLY ? new RegExp(process.env.SCREENS_ONLY) : null;
const VP_ONLY = process.env.VIEWPORTS_ONLY ? new RegExp(process.env.VIEWPORTS_ONLY) : null;

/** Same conformance target as a11y.test.ts, plus 2.2 AA (target-size lives there). */
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const MIN_TARGET = 44;

type Viewport = { name: string; width: number; height: number; mobile: boolean; auditTargets: boolean };

const VIEWPORTS: Viewport[] = [
    /* 320 is the WCAG 1.4.10 reflow floor. Overflow only; phone covers targets. */
    { name: 'phone-320', width: 320, height: 640, mobile: true, auditTargets: false },
    { name: 'phone', width: 375, height: 812, mobile: true, auditTargets: true },
    { name: 'tablet', width: 768, height: 1024, mobile: true, auditTargets: true },
    { name: 'desktop', width: 1280, height: 800, mobile: false, auditTargets: false }
].filter((v) => !VP_ONLY || VP_ONLY.test(v.name));

type Ids = {
    lead: string; quote: string; job: string; invoice: string; client: string; candidate: string;
    clientProposal: string; clientJob: string; clientInvoice: string; payToken: string; reviewToken: string;
};

type Auth = 'none' | 'owner-partial' | 'owner' | 'staff-first' | 'client' | 'officer';

type Screen = {
    name: string;
    /** The app/src/app route this screen covers, e.g. /portal/leads/[id]. */
    route: string;
    path: (ids: Ids) => string;
    auth: Auth;
};

const S = (name: string, route: string, auth: Auth, path?: (ids: Ids) => string): Screen => ({ name, route, auth, path: path ?? (() => route) });

const SCREENS: Screen[] = [
    S('login', '/login', 'none'),
    S('login-mfa', '/login/mfa', 'owner-partial'),

    S('portal-today', '/portal', 'owner'),
    S('portal-leads', '/portal/leads', 'owner'),
    S('portal-lead-detail', '/portal/leads/[id]', 'owner', (i) => `/portal/leads/${i.lead}`),
    S('portal-quotes', '/portal/quotes', 'owner'),
    S('portal-quote-new', '/portal/quotes/new', 'owner'),
    S('portal-quote-detail', '/portal/quotes/[id]', 'owner', (i) => `/portal/quotes/${i.quote}`),
    S('portal-jobs', '/portal/jobs', 'owner'),
    S('portal-jobs-past', '/portal/jobs', 'owner', () => '/portal/jobs?show=past'),
    S('portal-job-new', '/portal/jobs/new', 'owner'),
    S('portal-jobs-calendar', '/portal/jobs/calendar', 'owner'),
    S('portal-job-detail', '/portal/jobs/[id]', 'owner', (i) => `/portal/jobs/${i.job}`),
    S('portal-invoices', '/portal/invoices', 'owner'),
    S('portal-invoice-import', '/portal/invoices/import', 'owner'),
    S('portal-invoice-detail', '/portal/invoices/[id]', 'owner', (i) => `/portal/invoices/${i.invoice}`),
    S('portal-clients', '/portal/clients', 'owner'),
    S('portal-client-new', '/portal/clients/new', 'owner'),
    S('portal-client-detail', '/portal/clients/[id]', 'owner', (i) => `/portal/clients/${i.client}`),
    S('portal-candidates', '/portal/candidates', 'owner'),
    S('portal-candidate-detail', '/portal/candidates/[id]', 'owner', (i) => `/portal/candidates/${i.candidate}`),
    S('portal-reviews', '/portal/reviews', 'owner'),
    S('portal-activity', '/portal/activity', 'owner'),
    S('portal-notifications', '/portal/notifications', 'owner'),
    S('portal-settings', '/portal/settings', 'owner'),
    S('portal-security', '/portal/security', 'owner'),
    S('portal-welcome', '/portal/welcome', 'staff-first'),

    S('client-overview', '/client', 'client'),
    S('client-proposals', '/client/proposals', 'client'),
    S('client-proposal-detail', '/client/proposals/[id]', 'client', (i) => `/client/proposals/${i.clientProposal}`),
    S('client-jobs', '/client/jobs', 'client'),
    S('client-job-detail', '/client/jobs/[id]', 'client', (i) => `/client/jobs/${i.clientJob}`),
    S('client-invoices', '/client/invoices', 'client'),
    S('client-invoice-detail', '/client/invoices/[id]', 'client', (i) => `/client/invoices/${i.clientInvoice}`),

    S('pay', '/pay/[token]', 'none', (i) => `/pay/${i.payToken}`),
    S('review', '/review/[token]', 'none', (i) => `/review/${i.reviewToken}`),
    S('officer', '/officer', 'officer')
];

const ACTIVE = SCREENS.filter((s) => !ONLY || ONLY.test(s.name));

/* ---------- Report shapes ---------- */

type Box = { width: number; height: number };
type Offender = { selector: string; left: number; right: number; width: number };
type SmallTarget = { selector: string; tag: string; text: string; width: number; height: number; label?: Box };
type AxeRule = { id: string; impact: string | null; help: string; count: number; targets: string[] };

type Result = {
    screen: string;
    path: string;
    viewport: string;
    status: number;
    finalPath: string;
    /** Layout viewport as Chrome reports it; wider than the device when a mobile page overflows. */
    innerWidth: number;
    deviceWidth: number;
    scrollWidth: number;
    overflowPx: number;
    overflowOffenders: Offender[];
    consoleErrors: string[];
    ignoredConsoleErrors: string[];
    axe: AxeRule[];
    smallTargets: SmallTarget[] | null;
    targetsCompliantViaLabel: (Box & { selector: string; label: Box })[] | null;
    screenshot: string;
    error?: string;
};

const results = new Map<string, Result>();

/* Console messages that only a development server produces. Kept in the report
   under ignoredConsoleErrors, never silently dropped, but not failed on:
   neither can occur in a production build. */
const DEV_ONLY_CONSOLE: RegExp[] = [
    /* React's development build calls eval() to rebuild server call stacks.
       The portal's nonce CSP rightly has no 'unsafe-eval'; production React
       never calls it. */
    /^eval\(\) is not supported in this environment/
];

/* Next's dev-tools badge ("N · 1 Issue") is dev-server chrome, not portal UI.
   Left in, it lands in every screenshot, overlaps the nav, and is counted as a
   tap target and by axe. Hidden before anything is measured. The page CSP
   allows inline styles, so the injected rule applies. */
async function hideDevChrome(page: Page) {
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' }).catch(() => {});
}

/* ---------- Seeded artefacts ---------- */

const readJson = <T,>(name: string): T => {
    const path = join(DEMO, name);
    if (!existsSync(path)) throw new Error(`${path} is missing. Run \`pnpm demo:seed\` against the local stack first.`);
    return JSON.parse(readFileSync(path, 'utf8')) as T;
};

/* ==========================================================================
   Measurement — runs inside the page. Self-contained: no closures.
   ========================================================================== */

/* WHY deviceWidth AND NOT innerWidth. Under mobile emulation (isMobile), as on
   a real Android phone, Chrome widens the layout viewport to fit content that
   overflows it — a 375px phone reports innerWidth 638 on a page 638px wide —
   so `scrollWidth <= innerWidth` could never fail there. Overflow is measured
   against the emulated device width instead, which equals innerWidth on any
   page that does not overflow. Both numbers are reported. */
function measure({ auditTargets, minTarget, deviceWidth }: { auditTargets: boolean; minTarget: number; deviceWidth: number }) {
    const vw = deviceWidth;
    const root = document.documentElement;
    const scrollWidth = root.scrollWidth;

    const cssPath = (el: Element): string => {
        const parts: string[] = [];
        let node: Element | null = el;
        while (node && node !== document.body && node !== root && parts.length < 4) {
            const tag = node.tagName.toLowerCase();
            if (node.id) {
                parts.unshift(`${tag}#${CSS.escape(node.id)}`);
                break;
            }
            let part = tag + [...node.classList].slice(0, 2).map((c) => `.${CSS.escape(c)}`).join('');
            const parent: Element | null = node.parentElement;
            if (parent) {
                const same = [...parent.children].filter((c) => c.tagName === node!.tagName);
                if (same.length > 1) part += `:nth-of-type(${same.indexOf(node) + 1})`;
            }
            parts.unshift(part);
            node = parent;
        }
        return parts.join(' > ');
    };

    /* An ancestor that clips horizontally, or a fixed ancestor, takes its
       descendants out of the page's own horizontal overflow. */
    const contained = new Map<Element, boolean>();
    const isContained = (el: Element): boolean => {
        const parent = el.parentElement;
        if (!parent || parent === document.body || parent === root) return false;
        const cached = contained.get(parent);
        if (cached !== undefined) return cached;
        const cs = getComputedStyle(parent);
        const value = cs.position === 'fixed' || cs.overflowX !== 'visible' || isContained(parent);
        contained.set(parent, value);
        return value;
    };

    /* Culprits. A widened mobile layout makes every block as wide as the
       overflow, so boxes are compared with the root pinned to the device
       width: then only what cannot fit sticks out. An element is named when
       it extends past the device width and past its own parent's box — the
       thing breaking out, not the wrappers that grew around it. The pin is
       removed before the screenshot. */
    let innermost: { selector: string; left: number; right: number; width: number }[] = [];
    if (scrollWidth > vw + 1) {
        const saved = root.getAttribute('style');
        root.style.setProperty('width', `${vw}px`, 'important');
        root.style.setProperty('max-width', `${vw}px`, 'important');
        void root.offsetWidth;
        const offenders: { el: Element; left: number; right: number; width: number }[] = [];
        for (const el of document.body.querySelectorAll('*')) {
            if (getComputedStyle(el).position === 'fixed') continue;
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) continue;
            if (r.right <= vw + 1 && r.left >= -1) continue;
            if (isContained(el)) continue;
            const parent = el.parentElement;
            const pr = parent && parent !== document.body ? parent.getBoundingClientRect() : { right: vw, left: 0 };
            if (r.right <= pr.right + 1 && r.left >= pr.left - 1) continue;
            offenders.push({ el, left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) });
        }
        innermost = offenders
            .sort((a, b) => b.right - a.right)
            .slice(0, 12)
            .map((o) => ({ selector: cssPath(o.el), left: o.left, right: o.right, width: o.width }));
        if (saved === null) root.removeAttribute('style');
        else root.setAttribute('style', saved);
        void root.offsetWidth;
    }

    let smallTargets: { selector: string; tag: string; text: string; width: number; height: number; label?: { width: number; height: number } }[] | null = null;
    let viaLabel: { selector: string; width: number; height: number; label: { width: number; height: number } }[] | null = null;

    if (auditTargets) {
        smallTargets = [];
        viaLabel = [];
        const inlineInText = (el: Element): boolean => {
            let node: Element | null = el;
            while (node && node !== document.body) {
                const parent: Element | null = node.parentElement;
                if (!parent) return false;
                const hasText = [...parent.childNodes].some((c) => c.nodeType === Node.TEXT_NODE && (c.textContent ?? '').trim().length > 0);
                if (hasText) return true;
                if (getComputedStyle(parent).display !== 'inline') return false;
                node = parent;
            }
            return false;
        };
        for (const el of document.querySelectorAll('a[href], button, input, select, textarea, summary')) {
            if (el instanceof HTMLInputElement && el.type === 'hidden') continue;
            if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
            const r = el.getBoundingClientRect();
            if (r.width <= 1 || r.height <= 1) continue;
            if (el.tagName === 'A' && getComputedStyle(el).display === 'inline' && inlineInText(el)) continue;
            const width = Math.round(r.width * 10) / 10;
            const height = Math.round(r.height * 10) / 10;
            let label: { width: number; height: number } | undefined;
            if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio') && el.labels?.length) {
                const lr = el.labels[0].getBoundingClientRect();
                label = { width: Math.round(lr.width * 10) / 10, height: Math.round(lr.height * 10) / 10 };
                if (lr.height >= minTarget) {
                    viaLabel.push({ selector: cssPath(el), width, height, label });
                    continue;
                }
            }
            if (width >= minTarget && height >= minTarget) continue;
            const text = (el.getAttribute('aria-label') || el.textContent || (el as HTMLInputElement).name || (el as HTMLInputElement).type || '').replace(/\s+/g, ' ').trim().slice(0, 50);
            smallTargets.push({ selector: cssPath(el), tag: el.tagName.toLowerCase(), text, width, height, ...(label ? { label } : {}) });
        }
    }

    return { innerWidth: window.innerWidth, scrollWidth, offenders: innermost, smallTargets, viaLabel };
}

/* ==========================================================================
   Suite
   ========================================================================== */

d('responsive capture', () => {
    let browser: Browser;
    let ids: Ids;
    const states: Partial<Record<Auth, Awaited<ReturnType<BrowserContext['storageState']>>>> = {};
    const contexts = new Map<string, BrowserContext>();

    /* Magic links are single-use, so each run mints its own with the service
       role — local stack only. */
    async function mintSession(email: string, next: string): Promise<Awaited<ReturnType<BrowserContext['storageState']>>> {
        const file = readEnvFile();
        const url = demoEnv('SUPABASE_URL', file) || demoEnv('NEXT_PUBLIC_SUPABASE_URL', file);
        const key = demoEnv('SUPABASE_SERVICE_ROLE_KEY', file);
        assertLocalUrl(url);
        if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set (process env or the local env file).');
        const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
        const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
        if (error || !data?.properties?.hashed_token) throw new Error(`generateLink for ${email} failed: ${error?.message ?? 'no token'}`);
        const context = await browser.newContext();
        try {
            const page = await context.newPage();
            const link = `${BASE}/auth/confirm?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=magiclink&next=${encodeURIComponent(next)}`;
            await page.goto(link, { waitUntil: 'load', timeout: 120_000 });
            const landed = new URL(page.url()).pathname;
            if (!landed.startsWith(next)) throw new Error(`magic link for ${email} landed on ${landed}, expected ${next}`);
            return await context.storageState();
        } finally {
            await context.close();
        }
    }

    /* The owner goes through the real sign-in screens: the Command staff tab,
       email + password, then /login/mfa with a code from the seeded secret.
       The half-signed-in state (aal1, factor enrolled) is kept too, because it
       is the only state in which /login/mfa renders. */
    async function signInStaff(file: string, key: 'owner' | 'staff-first', partialKey?: 'owner-partial') {
        const owner = readJson<{ email: string; password: string; totpSecret: string }>(file);
        const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
        try {
            const page = await context.newPage();
            await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 120_000 });
            const password = page.getByLabel(/password/i);
            for (let i = 0; i < 5 && !(await password.isVisible()); i++) {
                /* Retried: a click before hydration does nothing. */
                await page.getByRole('tab', { name: /command staff/i }).click();
                await password.waitFor({ state: 'visible', timeout: 3_000 }).catch(() => {});
            }
            await page.getByLabel(/email/i).fill(owner.email);
            await password.fill(owner.password);
            await page.getByRole('button', { name: /^sign in$/i }).click();
            await page.waitForURL(/\/login\/mfa/, { timeout: 60_000 }).catch(async () => {
                const alert = (await page.locator('[role="status"]').allTextContents()).join(' ').trim();
                throw new Error(`password sign-in did not reach /login/mfa (at ${page.url()}): ${alert || 'no message'}`);
            });
            await page.waitForLoadState('networkidle').catch(() => {});
            if (partialKey) states[partialKey] = await context.storageState();

            for (let attempt = 0; attempt < 2; attempt++) {
                await waitForFreshStep(6);
                await page.getByLabel(/code/i).fill(totp(owner.totpSecret));
                await page.getByRole('button', { name: /verify/i }).click();
                const ok = await page.waitForURL((u) => u.pathname.startsWith('/portal'), { timeout: 30_000 }).then(() => true, () => false);
                if (ok) break;
                if (attempt === 1) {
                    const alert = (await page.locator('[role="status"]').allTextContents()).join(' ').trim();
                    throw new Error(`TOTP verification did not reach /portal (at ${page.url()}): ${alert || 'no message'}`);
                }
                await new Promise((r) => setTimeout(r, 31_000));
            }
            await page.waitForLoadState('networkidle').catch(() => {});
            states[key] = await context.storageState();
        } finally {
            await context.close();
        }
    }

    async function contextFor(vp: Viewport, auth: Auth): Promise<BrowserContext> {
        const key = `${vp.name}:${auth}`;
        const existing = contexts.get(key);
        if (existing) return existing;
        const context = await browser.newContext({
            viewport: { width: vp.width, height: vp.height },
            isMobile: vp.mobile,
            hasTouch: vp.mobile,
            deviceScaleFactor: 1,
            /* As in a11y.test.ts: capture the settled, reduced-motion page. */
            reducedMotion: 'reduce',
            ...(auth === 'none' ? {} : { storageState: states[auth] })
        });
        contexts.set(key, context);
        return context;
    }

    beforeAll(async () => {
        ids = readJson<Ids>('ids.json');
        browser = await chromium.launch();
        const needs = new Set(ACTIVE.map((s) => s.auth));
        if (needs.has('owner') || needs.has('owner-partial')) await signInStaff('owner.json', 'owner', 'owner-partial');
        /* The staff account lands on /portal/welcome after two-factor: its password is still temporary. */
        if (needs.has('staff-first')) await signInStaff('staff.json', 'staff-first');
        if (needs.has('client')) states.client = await mintSession(readJson<{ email: string }>('client.json').email, '/client');
        if (needs.has('officer')) states.officer = await mintSession(readJson<{ email: string }>('officer.json').email, '/officer');
    }, 300_000);

    afterAll(async () => {
        for (const context of contexts.values()) await context.close().catch(() => {});
        await browser?.close();
        writeReport();
    });

    it('covers every page route under /portal and /client', () => {
        const root = join(APP, 'src', 'app');
        const walk = (dir: string): string[] =>
            existsSync(dir)
                ? readdirSync(dir).flatMap((entry) => {
                    const full = join(dir, entry);
                    return statSync(full).isDirectory() ? walk(full) : entry === 'page.tsx' ? [full] : [];
                })
                : [];
        const routes = [...walk(join(root, 'portal')), ...walk(join(root, 'client'))].map((file) =>
            `/${relative(root, dirname(file)).split(sep).filter((seg) => !/^\(.*\)$/.test(seg)).join('/')}`
        );
        const covered = new Set(SCREENS.map((s) => s.route));
        const missing = routes.filter((r) => !covered.has(r)).sort();
        expect(missing, `routes with no screen in tests/responsive.test.ts: ${missing.join(', ')}`).toEqual([]);
    });

    for (const vp of VIEWPORTS) {
        for (const screen of ACTIVE) {
            it(`${screen.name} @ ${vp.name}`, { timeout: 240_000 }, async () => {
                const path = screen.path(ids);
                const context = await contextFor(vp, screen.auth);
                const page: Page = await context.newPage();
                /* Recording stops before axe runs: axe-core fetches
                   cross-origin stylesheets (Google Fonts) over XHR to read
                   their rules, and the portal's connect-src correctly refuses
                   it. That error is the harness's, not the page's. */
                let recording = true;
                const consoleErrors: string[] = [];
                const ignoredConsoleErrors: string[] = [];
                const record = (text: string) => {
                    if (!recording) return;
                    (DEV_ONLY_CONSOLE.some((re) => re.test(text)) ? ignoredConsoleErrors : consoleErrors).push(text.slice(0, 500));
                };
                page.on('console', (msg) => {
                    if (msg.type() === 'error') record(msg.text());
                });
                page.on('pageerror', (err) => record(`pageerror: ${err.message}`));

                const shotPath = join(OUT, vp.name, `${screen.name}.png`);
                const result: Result = {
                    screen: screen.name, path, viewport: vp.name, status: 0, finalPath: '', innerWidth: vp.width, deviceWidth: vp.width, scrollWidth: 0,
                    overflowPx: 0, overflowOffenders: [], consoleErrors, ignoredConsoleErrors, axe: [], smallTargets: null, targetsCompliantViaLabel: null,
                    screenshot: relative(DEMO, shotPath)
                };
                results.set(`${screen.name}@${vp.name}`, result);

                try {
                    const response = await page.goto(`${BASE}${path}`, { waitUntil: 'load', timeout: 180_000 });
                    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
                    await page.evaluate(() => document.fonts.ready.then(() => undefined));
                    await hideDevChrome(page);

                    result.status = response?.status() ?? 0;
                    result.finalPath = new URL(page.url()).pathname;

                    const m = await page.evaluate(measure, { auditTargets: vp.auditTargets, minTarget: MIN_TARGET, deviceWidth: vp.width });
                    result.innerWidth = m.innerWidth;
                    result.scrollWidth = m.scrollWidth;
                    result.overflowPx = Math.max(0, m.scrollWidth - vp.width);
                    result.overflowOffenders = m.offenders;
                    result.smallTargets = m.smallTargets;
                    result.targetsCompliantViaLabel = m.viaLabel;

                    mkdirSync(dirname(shotPath), { recursive: true });
                    await page.screenshot({ path: shotPath, fullPage: true });

                    recording = false;
                    const axe = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
                    result.axe = axe.violations.map((v) => ({
                        id: v.id,
                        impact: v.impact ?? null,
                        help: v.help,
                        count: v.nodes.length,
                        targets: v.nodes.slice(0, 3).map((n) => n.target.join(' '))
                    }));
                } catch (err) {
                    result.error = err instanceof Error ? err.message : String(err);
                    throw err;
                } finally {
                    await page.close().catch(() => {});
                }

                const expectedPath = path.split('?')[0];
                expect.soft(result.status, `${path} returned HTTP ${result.status}`).toBeLessThan(400);
                expect.soft(result.finalPath, `${path} redirected to ${result.finalPath}`).toBe(expectedPath);
                expect.soft(consoleErrors, `console errors on ${path} @ ${vp.name}`).toEqual([]);
                expect.soft(
                    result.overflowPx,
                    `${path} @ ${vp.name} scrolls sideways by ${result.overflowPx}px; culprits: ${result.overflowOffenders.map((o) => `${o.selector} (right ${o.right})`).join('; ')}`
                ).toBeLessThanOrEqual(1);
            });
        }
    }
});

/* ==========================================================================
   Report
   ========================================================================== */

function writeReport() {
    mkdirSync(OUT, { recursive: true });
    const reportPath = join(OUT, 'report.json');
    /* A filtered run (SCREENS_ONLY / VIEWPORTS_ONLY) updates its own entries
       and keeps the rest of an earlier full run. */
    let previous: Result[] = [];
    if ((ONLY || VP_ONLY) && existsSync(reportPath)) {
        try {
            previous = (JSON.parse(readFileSync(reportPath, 'utf8')) as { results: Result[] }).results ?? [];
        } catch {
            previous = [];
        }
    }
    const merged = new Map(previous.map((r) => [`${r.screen}@${r.viewport}`, r]));
    for (const [key, r] of results) merged.set(key, r);
    const all = [...merged.values()];

    const viewports = [...new Set(all.map((r) => r.viewport))];
    const summary = Object.fromEntries(
        viewports.map((vp) => {
            const rows = all.filter((r) => r.viewport === vp);
            const axeByRule: Record<string, { nodes: number; screens: number; impact: string | null }> = {};
            for (const r of rows) {
                for (const a of r.axe) {
                    const entry = (axeByRule[a.id] ??= { nodes: 0, screens: 0, impact: a.impact });
                    entry.nodes += a.count;
                    entry.screens += 1;
                }
            }
            const overflowing = rows.filter((r) => r.overflowPx > 1).sort((a, b) => b.overflowPx - a.overflowPx);
            return [vp, {
                screens: rows.length,
                failedToLoad: rows.filter((r) => r.error || r.status >= 400 || (r.finalPath && r.finalPath !== r.path.split('?')[0])).map((r) => r.screen),
                withConsoleErrors: rows.filter((r) => r.consoleErrors.length).map((r) => r.screen),
                overflowing: overflowing.length,
                worstOverflow: overflowing.slice(0, 10).map((r) => ({ screen: r.screen, px: r.overflowPx })),
                axeViolationNodes: Object.values(axeByRule).reduce((s, v) => s + v.nodes, 0),
                axeByRule,
                smallTargets: rows.some((r) => r.smallTargets) ? rows.reduce((s, r) => s + (r.smallTargets?.length ?? 0), 0) : null
            }];
        })
    );

    const report = {
        label: LABEL,
        base: BASE,
        generatedAt: new Date().toISOString(),
        viewports: VIEWPORTS.map(({ name, width, height, mobile }) => ({ name, width, height, mobile })),
        axeTags: AXE_TAGS,
        minTarget: MIN_TARGET,
        summary,
        results: all.sort((a, b) => a.viewport.localeCompare(b.viewport) || a.screen.localeCompare(b.screen))
    };
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`[responsive] ${all.length} captures → ${reportPath}`);
    for (const [vp, s] of Object.entries(summary)) {
        console.log(`[responsive] ${vp}: ${s.overflowing}/${s.screens} overflow · ${s.axeViolationNodes} axe nodes · ${s.smallTargets ?? '—'} small targets · ${s.failedToLoad.length} failed to load`);
    }
}
