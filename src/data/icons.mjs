/* ==========================================================================
   TACTICAL SVG EMBLEM LIBRARY
   Bespoke metallic-gold vector marks. Each one is defined exactly once here
   and referenced by key; previously every mark was hand-inlined at each use.

   All strokes reference #tacticalGoldGrad, the linearGradient defined once
   in the document shell. Geometry is preserved verbatim from the hand-authored
   originals — these are drawings, not generated shapes, so they are data.
   ========================================================================== */

import { raw } from '../lib/html.mjs';

const G = 'url(#tacticalGoldGrad)';

/** Wraps icon body markup in a sized <svg>.
    When the caller's attrs carry their own class="…" (they always restate
    the base class plus a modifier), the default class must NOT also be
    emitted: two class attributes on one tag means HTML keeps the first and
    silently drops the caller's — which is how every icon modifier class
    (--quiz, --result, --lg, --filled) came to match nothing. */
const icon = (viewBox, body) => (attrs = '') =>
    raw(`<svg${attrs.includes('class="') ? '' : ' class="tactical-svg"'} viewBox="${viewBox}" aria-hidden="true"${attrs ? ' ' + attrs : ''}>${body}</svg>`);

/* ── Division spine emblems (32×32) ────────────────────────────── */

export const spineIcons = {
    executive: icon('0 0 32 32', `
    <path d="M16 2 L27 6 V15 C27 22 16 29 16 29 C16 29 5 22 5 15 V6 L16 2 Z" stroke="${G}" stroke-width="1.6" fill="none"/>
    <circle cx="16" cy="14" r="5.5" stroke="${G}" stroke-width="1.2" fill="none" stroke-dasharray="2 1"/>
    <circle cx="16" cy="14" r="2.5" fill="${G}"/>
    <line x1="16" y1="5" x2="16" y2="8" stroke="${G}" stroke-width="1.2"/>
    <line x1="16" y1="20" x2="16" y2="23" stroke="${G}" stroke-width="1.2"/>
    <line x1="7" y1="14" x2="10" y2="14" stroke="${G}" stroke-width="1.2"/>
    <line x1="22" y1="14" x2="25" y2="14" stroke="${G}" stroke-width="1.2"/>
    <path d="M12 24 C13 25 15 26 16 26 C17 26 19 25 20 24" stroke="${G}" stroke-width="1.2" fill="none"/>`),

    event: icon('0 0 32 32', `
    <path d="M4 26 V10 L16 3 L28 10 V26" stroke="${G}" stroke-width="1.6" fill="none"/>
    <path d="M10 26 V15 C10 12 22 12 22 15 V26" stroke="${G}" stroke-width="1.4" fill="none"/>
    <line x1="2" y1="26" x2="30" y2="26" stroke="${G}" stroke-width="1.8"/>
    <circle cx="16" cy="9" r="2" fill="${G}"/>
    <path d="M16 17 V22" stroke="${G}" stroke-width="1.2"/>
    <circle cx="6" cy="10" r="1.5" fill="${G}"/>
    <circle cx="26" cy="10" r="1.5" fill="${G}"/>
    <path d="M12 26 V20 H20 V26" stroke="${G}" stroke-width="1" fill="none"/>`),

    commercial: icon('0 0 32 32', `
    <rect x="5" y="8" width="10" height="18" rx="1" stroke="${G}" stroke-width="1.4" fill="none"/>
    <rect x="17" y="4" width="10" height="22" rx="1" stroke="${G}" stroke-width="1.4" fill="none"/>
    <line x1="8" y1="12" x2="12" y2="12" stroke="${G}" stroke-width="1"/>
    <line x1="8" y1="16" x2="12" y2="16" stroke="${G}" stroke-width="1"/>
    <line x1="8" y1="20" x2="12" y2="20" stroke="${G}" stroke-width="1"/>
    <line x1="20" y1="8" x2="24" y2="8" stroke="${G}" stroke-width="1"/>
    <line x1="20" y1="12" x2="24" y2="12" stroke="${G}" stroke-width="1"/>
    <line x1="20" y1="16" x2="24" y2="16" stroke="${G}" stroke-width="1"/>
    <line x1="20" y1="20" x2="24" y2="20" stroke="${G}" stroke-width="1"/>
    <circle cx="22" cy="4" r="1.5" fill="${G}"/>
    <path d="M2 28 H30" stroke="${G}" stroke-width="1.8"/>
    <path d="M22 1 A5 5 0 0 1 27 6" stroke="${G}" stroke-width="1" stroke-dasharray="2 1" fill="none"/>`),

    construction: icon('0 0 32 32', `
    <rect x="5" y="12" width="22" height="7" rx="1" stroke="${G}" stroke-width="1.5" fill="none"/>
    <line x1="7" y1="19" x2="12" y2="12" stroke="${G}" stroke-width="1.2"/>
    <line x1="13" y1="19" x2="18" y2="12" stroke="${G}" stroke-width="1.2"/>
    <line x1="19" y1="19" x2="24" y2="12" stroke="${G}" stroke-width="1.2"/>
    <line x1="8" y1="19" x2="8" y2="28" stroke="${G}" stroke-width="1.4"/>
    <line x1="24" y1="19" x2="24" y2="28" stroke="${G}" stroke-width="1.4"/>
    <circle cx="16" cy="9" r="1.8" fill="${G}"/>
    <line x1="16" y1="10.8" x2="16" y2="12" stroke="${G}" stroke-width="1.2"/>
    <path d="M7 8 A 11 11 0 0 1 25 8" stroke="${G}" stroke-width="1" stroke-dasharray="2 1" fill="none"/>
    <path d="M2 28 H30" stroke="${G}" stroke-width="1.8"/>`),

    estate: icon('0 0 32 32', `
    <path d="M3 26 V12 L16 3 L29 12 V26" stroke="${G}" stroke-width="1.5" fill="none"/>
    <path d="M7 26 V15 L16 8 L25 15 V26" stroke="${G}" stroke-width="1.2" fill="none"/>
    <line x1="16" y1="8" x2="16" y2="26" stroke="${G}" stroke-width="1.2"/>
    <line x1="7" y1="20" x2="25" y2="20" stroke="${G}" stroke-width="1"/>
    <circle cx="16" cy="14" r="2.5" fill="${G}"/>
    <line x1="1" y1="26" x2="31" y2="26" stroke="${G}" stroke-width="2"/>
    <path d="M12 26 V22 C12 20 20 20 20 22 V26" stroke="${G}" stroke-width="1.2" fill="none"/>`),

    emergency: icon('0 0 32 32', `
    <polygon points="17,2 7,16 15,16 13,30 25,14 17,14" fill="${G}" stroke="${G}" stroke-width="1"/>
    <circle cx="16" cy="16" r="13" stroke="${G}" stroke-width="1.2" stroke-dasharray="3 2" fill="none"/>
    <circle cx="16" cy="16" r="9" stroke="${G}" stroke-width="0.8" fill="none"/>
    <path d="M4 16 H1 M31 16 H28 M16 4 V1 M16 31 V28" stroke="${G}" stroke-width="1.5"/>`),

    shieldCheck: icon('0 0 32 32', `
    <path d="M16 2 L27 6 V15 C27 22 16 29 16 29 C16 29 5 22 5 15 V6 L16 2 Z" stroke="${G}" stroke-width="1.6" fill="none"/>
    <polyline points="11 16 15 20 21 12" stroke="${G}" stroke-width="1.8" fill="none"/>`)
};

/* ── Assessment quiz marks (24×24) ─────────────────────────────── */

export const quizIcons = {
    executive: icon('0 0 24 24', `
    <path d="M12 2 L20 5 V11 C20 16 12 21 12 21 C12 21 4 16 4 11 V5 L12 2 Z" stroke="${G}" stroke-width="1.5" fill="none"/>
    <circle cx="12" cy="10" r="3" stroke="${G}" stroke-width="1.2" fill="none"/>
    <path d="M9 17 C9 15 11 14 12 14 C13 14 15 15 15 17" stroke="${G}" stroke-width="1.2" fill="none"/>`),

    event: icon('0 0 24 24', `
    <path d="M3 20 V8 L12 2 L21 8 V20" stroke="${G}" stroke-width="1.5" fill="none"/>
    <path d="M8 20 V12 C8 9.5 16 9.5 16 12 V20" stroke="${G}" stroke-width="1.3" fill="none"/>
    <circle cx="12" cy="7" r="1.5" fill="${G}"/>
    <line x1="2" y1="20" x2="22" y2="20" stroke="${G}" stroke-width="1.8"/>`),

    commercial: icon('0 0 24 24', `
    <rect x="4" y="6" width="7" height="14" rx="1" stroke="${G}" stroke-width="1.4" fill="none"/>
    <rect x="13" y="3" width="7" height="17" rx="1" stroke="${G}" stroke-width="1.4" fill="none"/>
    <line x1="6" y1="9" x2="9" y2="9" stroke="${G}" stroke-width="1"/>
    <line x1="6" y1="13" x2="9" y2="13" stroke="${G}" stroke-width="1"/>
    <line x1="15" y1="7" x2="18" y2="7" stroke="${G}" stroke-width="1"/>
    <line x1="15" y1="11" x2="18" y2="11" stroke="${G}" stroke-width="1"/>
    <line x1="15" y1="15" x2="18" y2="15" stroke="${G}" stroke-width="1"/>
    <line x1="2" y1="21" x2="22" y2="21" stroke="${G}" stroke-width="1.8"/>`),

    construction: icon('0 0 24 24', `
    <rect x="4" y="9" width="16" height="5.5" rx="1" stroke="${G}" stroke-width="1.4" fill="none"/>
    <line x1="5.5" y1="14.5" x2="9.5" y2="9" stroke="${G}" stroke-width="1.1"/>
    <line x1="10" y1="14.5" x2="14" y2="9" stroke="${G}" stroke-width="1.1"/>
    <line x1="14.5" y1="14.5" x2="18.5" y2="9" stroke="${G}" stroke-width="1.1"/>
    <line x1="6.5" y1="14.5" x2="6.5" y2="21" stroke="${G}" stroke-width="1.3"/>
    <line x1="17.5" y1="14.5" x2="17.5" y2="21" stroke="${G}" stroke-width="1.3"/>
    <circle cx="12" cy="6.5" r="1.4" fill="${G}"/>
    <line x1="12" y1="7.9" x2="12" y2="9" stroke="${G}" stroke-width="1.1"/>
    <line x1="2" y1="21" x2="22" y2="21" stroke="${G}" stroke-width="1.8"/>`),

    low: icon('0 0 24 24', `
    <circle cx="12" cy="12" r="9" stroke="${G}" stroke-width="1.4" fill="none"/>
    <polyline points="9 12 11 14 15 10" stroke="var(--color-emerald)" stroke-width="1.6" fill="none"/>`),

    moderate: icon('0 0 24 24', `
    <circle cx="12" cy="12" r="9" stroke="${G}" stroke-width="1.4" fill="none"/>
    <circle cx="12" cy="12" r="4" stroke="${G}" stroke-width="1.2" fill="none"/>
    <line x1="12" y1="5" x2="12" y2="8" stroke="${G}" stroke-width="1"/>
    <line x1="12" y1="16" x2="12" y2="19" stroke="${G}" stroke-width="1"/>
    <line x1="5" y1="12" x2="8" y2="12" stroke="${G}" stroke-width="1"/>
    <line x1="16" y1="12" x2="19" y2="12" stroke="${G}" stroke-width="1"/>`),

    highProfile: icon('0 0 24 24', `
    <polygon points="12,2 15,9 22,12 15,15 12,22 9,15 2,12 9,9" stroke="${G}" stroke-width="1.4" fill="none"/>
    <circle cx="12" cy="12" r="2" fill="${G}"/>`),

    elevated: icon('0 0 24 24', `
    <path d="M12 2 L22 20 H2 Z" stroke="var(--color-crimson)" stroke-width="1.5" fill="none"/>
    <line x1="12" y1="8" x2="12" y2="13" stroke="var(--color-crimson)" stroke-width="1.5"/>
    <circle cx="12" cy="16.5" r="1" fill="var(--color-crimson)"/>`)
};

/* ── Interface marks (stroked, currentColor) ───────────────────── */

/* Same duplicate-class rule as icon() above. */
const ui = (body) => (attrs = '') =>
    raw(`<svg${attrs.includes('class="') ? '' : ' class="ui-icon"'} viewBox="0 0 24 24" aria-hidden="true"${attrs ? ' ' + attrs : ''}>${body}</svg>`);

export const uiIcons = {
    phone: ui('<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>'),

    bolt: ui('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>'),

    crosshair: ui('<circle cx="12" cy="12" r="10"></circle><line x1="22" y1="12" x2="18" y2="12"></line><line x1="6" y1="12" x2="2" y2="12"></line><line x1="12" y1="6" x2="12" y2="12"></line><line x1="12" y1="22" x2="12" y2="18"></line>'),

    lock: ui('<rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>')
};
