import { html } from '../../lib/html.mjs';
import { site } from '../../data/site.mjs';
import { aerial } from '../../data/aerial.mjs';
export const aerialPage = () => html`<!doctype html>
<html lang="en" data-aerial-state="loading"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="${aerial.description}"><title>${aerial.title}</title>
<link rel="canonical" href="${site.url}/${aerial.slug}">
<link rel="icon" href="/${site.icons.favicon}"><link rel="stylesheet" href="/css/aerial.css">
</head><body class="aerial-page">
<a class="aerial-skip" href="#aerial-track">Skip to content</a>
<div class="aerial-stage" aria-hidden="true">
<svg class="aerial-poster" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
<defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#192e45"/><stop offset="1" stop-color="#091218"/></linearGradient><linearGradient id="land" x2="1" y2="1"><stop stop-color="#35464a"/><stop offset="1" stop-color="#0a171b"/></linearGradient></defs>
<rect width="1600" height="1000" fill="url(#sky)"/><path d="M0 620L400 470 820 600 1300 430 1600 590V1000H0Z" fill="url(#land)"/>
<path d="M700 800L1050 650 1450 760 1100 960Z" fill="#444b49"/><path d="M800 700V610L1120 500 1360 590V700L1050 820Z" fill="#26353c"/><path d="M800 610L1120 500 1360 590 1050 710Z" fill="#52616a"/>
<path d="M1070 725L1330 625V672L1070 775Z" fill="#c2a776"/><path d="M1100 1000L950 900 1000 860 1260 1000" fill="#687173"/>
<path d="M690 790L1040 630 1470 750V870L1080 1000 690 880Z" fill="none" stroke="#b8995a" stroke-width="2"/>
</svg><canvas id="aerial-canvas" aria-label="Illustrative aircraft and fictional property"></canvas></div>
<header class="aerial-nav"><a href="/" aria-label="Fused home">${site.shortName}<span> / AERIAL</span></a><a href="/#quote">Discuss your property ↗</a></header>
<main id="aerial-track" tabindex="-1">${aerial.chapters.map((chapter, index) => html`
<section class="aerial-chapter" aria-labelledby="chapter-${index}"><div class="aerial-copy"><p class="aerial-eyebrow">${chapter.eyebrow}</p>
${index === 0 ? html`<h1 id="chapter-${index}">${chapter.title}</h1>` : html`<h2 id="chapter-${index}">${chapter.title}</h2>`}
<p>${chapter.body}</p>${index === 3 ? html`<a class="aerial-inquiry" href="/#quote">Request a conversation ↗</a><p class="aerial-disclaimer">Illustrative aircraft; no claim of Fused ownership or manufacturer endorsement. Fictional property. Operational scope is confirmed during inquiry.</p><a href="/assets/aerial/PROVENANCE.md">Asset credits &amp; provenance</a>` : html`<a class="aerial-next" href="#chapter-${index + 1}">Scroll to explore ↓</a>`}</div></section>`)}
</main>
<aside class="aerial-controls" aria-label="Scene controls"><div class="aerial-view-label">Illustrative visualization</div>
<div class="aerial-toolbar"><button data-action="sensor" aria-label="Toggle illustrative sensor view" aria-pressed="false" disabled>Sensor view</button><button data-action="pause" aria-pressed="false" disabled>Pause</button><button data-action="inspect" aria-pressed="false" aria-controls="aerial-inspect" disabled>Inspect</button></div>
<div id="aerial-inspect" hidden><p>Drag to orbit. Arrow keys rotate. Escape exits.</p><div class="aerial-toolbar"><button data-action="rotate-left" aria-label="Rotate left">←</button><button data-action="rotate-right" aria-label="Rotate right">→</button><button data-action="rotate-up" aria-label="Rotate up">↑</button><button data-action="rotate-down" aria-label="Rotate down">↓</button><button data-action="reset">Reset</button></div></div>
<p id="aerial-status" role="status" aria-live="polite">Static preview. Preparing the interactive scene…</p><button data-action="retry" hidden>Retry scene</button>
<noscript><p>Static preview — JavaScript is off. All inquiry links remain available.</p></noscript></aside>
<script type="module" src="/js/aerial/boot.mjs"></script></body></html>`;
