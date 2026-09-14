/* ==========================================================================
   SPEC-008 — the skip link is the first focusable element on every page.

   This is the cheapest test in the repository and it protects the single
   most important keyboard affordance on the site. The home page opens with
   a 350vh scroll-driven WebGL intro; a visitor who cannot perform a scroll
   gesture reaches the content by Tab or by this link and by nothing else.
   A template reshuffle that drops a focusable element above it — a logo
   anchor, a language picker, a cookie button — silently strands that
   visitor at the top of the page, and nothing else in CI would notice.

   Read against the GENERATED html, not the templates: source order in
   src/templates/ is not the order the browser sees once the page shell has
   composed the partials.

   What is deliberately NOT asserted here: that the link targets `#main`.
   Today `/` targets `#capabilities` and `/careers` targets `#open-postings`,
   both of which skip past their page's hero. That is recorded as A11Y-01 in
   docs/A11Y-AUDIT.md and is fixed in the follow-up that lands the template
   changes; asserting it now would fail a check that has nothing to do with
   the property this file exists to protect.
   ========================================================================== */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const PAGES = [
    'index.html',
    'careers.html',
    'privacy.html',
    'terms.html',
    'sms-consent.html',
    'invoice.html'
];

const read = (page) => readFileSync(join(ROOT, page), 'utf8');

/** Everything the sequential focus order can land on, in document order.
    An <a> without href is not focusable, and an explicit negative tabindex
    removes an element from the order however else it is marked up — those
    are the two exclusions that matter for "what comes first". */
function focusableCandidates(html) {
    const found = [];
    const tag = /<(a|button|input|select|textarea|summary)\b([^>]*)>/gi;

    for (const m of html.matchAll(tag)) {
        const [whole, name, attrs] = m;
        if (/\btabindex\s*=\s*["']?-\d/i.test(attrs)) continue;
        if (name.toLowerCase() === 'a' && !/\bhref\s*=/i.test(attrs)) continue;
        found.push({ index: m.index, name: name.toLowerCase(), whole });
    }

    /* Anything opted in with a non-negative tabindex, whatever its tag. */
    const opted = /<([a-z][\w-]*)\b([^>]*\btabindex\s*=\s*["']?\d+[^>]*)>/gi;
    for (const m of opted.matchAll ? html.matchAll(opted) : []) {
        if (/^(a|button|input|select|textarea|summary)$/i.test(m[1])) continue;
        found.push({ index: m.index, name: m[1].toLowerCase(), whole: m[0] });
    }

    return found.sort((a, b) => a.index - b.index);
}

const skipLinkMatch = (html) => html.match(/<a\b[^>]*class="[^"]*\bskip-link\b[^"]*"[^>]*>/i);

for (const page of PAGES) {
    test(`${page}: the skip link is the first focusable element`, () => {
        const html = read(page);
        const skip = skipLinkMatch(html);

        assert.ok(skip, `${page} has no .skip-link — every page must offer one`);

        const candidates = focusableCandidates(html);
        assert.ok(candidates.length > 1, `${page}: expected more than one focusable element`);

        const first = candidates[0];
        assert.equal(
            first.index,
            skip.index,
            `${page}: the first focusable element is ${first.whole.slice(0, 120)} — ` +
            `the skip link must come before it, or a keyboard visitor meets that control first`
        );
    });

    test(`${page}: exactly one skip link, and it points at a real id inside <main>`, () => {
        const html = read(page);

        const all = [...html.matchAll(/class="[^"]*\bskip-link\b[^"]*"/gi)];
        assert.equal(all.length, 1, `${page}: expected exactly one skip link, found ${all.length}`);

        const href = skipLinkMatch(html)[0].match(/href="#([^"]+)"/i);
        assert.ok(href, `${page}: the skip link must be a fragment link`);

        const target = href[1];
        const hasId = new RegExp(`\\bid="${target}"`).test(html);
        assert.ok(hasId, `${page}: the skip link points at #${target}, which is not an id on this page`);

        /* The destination must be the main landmark or live inside it —
           a link that lands in the header or the footer is not a skip link. */
        const main = html.match(/<main\b[^>]*>[\s\S]*?<\/main>/i);
        assert.ok(main, `${page}: no <main> landmark`);
        const targetInMain =
            new RegExp(`<main\\b[^>]*\\bid="${target}"`).test(html) ||
            new RegExp(`\\bid="${target}"`).test(main[0]);
        assert.ok(
            targetInMain,
            `${page}: the skip link target #${target} is outside <main>`
        );
    });
}

test('the skip link is styled to become visible on focus, and is never display:none', () => {
    const css = readFileSync(join(ROOT, 'css', 'site.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

    const rules = css.match(/[^{}]*\.skip-link[^{}]*\{[^}]*\}/g) ?? [];
    assert.ok(rules.length >= 2, 'expected a resting rule and a focus rule for .skip-link');

    for (const rule of rules) {
        assert.doesNotMatch(
            rule,
            /display:\s*none|visibility:\s*hidden/,
            `a skip link removed from the page is no skip link at all: ${rule.trim()}`
        );
    }

    assert.ok(
        rules.some((r) => /:focus(-visible)?/.test(r) && /top:\s*0/.test(r)),
        'the skip link must move into view when focused'
    );
});
