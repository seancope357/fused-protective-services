/* ==========================================================================
   DOCUMENT SHELL
   Assembles every section into the page and hands the browser the slice of
   data its interactive modules need, as one JSON island. That island is
   serialized from the same src/data modules the markup renders from, so the
   client's idea of a division and the page's idea of a division are the same
   object — the old scripts kept their own hard-coded copies of both.
   ========================================================================== */

import { html, json } from '../lib/html.mjs';
import { site } from '../data/site.mjs';
import { divisions } from '../data/divisions.mjs';
import { assessment, recommendations } from '../data/assessment.mjs';
import { tiers, defaultTier } from '../data/estimator.mjs';

import { head } from './head.mjs';
import { nav, drawer } from './nav.mjs';
import { assembly } from './assembly.mjs';
import { hero } from './hero.mjs';
import { bookshelf } from './bookshelf.mjs';
import { protocol } from './protocol.mjs';
import { assessmentSection } from './assessment.mjs';
import { estimator } from './estimator.mjs';
import { standardsSection } from './standards.mjs';
import { quote } from './quote.mjs';
import { faqSection } from './faq.mjs';
import { dispatchBar, footer } from './footer.mjs';

/** Exactly what the browser modules need — no more. */
const clientConfig = () => ({
    divisions: divisions.map((d) => ({ id: d.id, quoteValue: d.quoteValue })),
    assessment: {
        recommendations,
        environment: Object.fromEntries(
            assessment.steps[0].options.map((o) => [
                o.id,
                { value: o.value, recommend: o.recommend, division: o.division, armed: o.armed }
            ])
        ),
        threat: Object.fromEntries(
            assessment.steps[1].options.map((o) => [o.id, { value: o.value, escalate: o.escalate }])
        )
    },
    estimator: {
        tiers: Object.fromEntries(
            tiers.map((t) => [t.id, { name: t.name, rate: t.rate, armed: t.armed, division: t.division }])
        ),
        defaultTier: defaultTier.id
    }
});

export const page = () => html`<!DOCTYPE html>
<html lang="en">
<head>
${head()}
</head>
<body>

    <!-- Global SVG gradient referenced by every tactical emblem -->
    <svg class="svg-defs" width="0" height="0" aria-hidden="true" focusable="false">
        <defs>
            <linearGradient id="tacticalGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#ffffff" />
                <stop offset="25%" stop-color="#f7e5b2" />
                <stop offset="50%" stop-color="#c6a25c" />
                <stop offset="75%" stop-color="#ba9857" />
                <stop offset="100%" stop-color="#72542b" />
            </linearGradient>
        </defs>
    </svg>

    <a href="#capabilities" class="skip-link">Skip to main content</a>

    <canvas id="tactical-bg-canvas" aria-hidden="true"></canvas>
    <div class="cursor-spotlight" id="cursorSpotlight" aria-hidden="true"></div>

${drawer()}
${nav()}

    <main id="main">
${assembly()}
${hero()}
${bookshelf()}
${protocol()}
${assessmentSection()}
${estimator()}
${standardsSection()}
${quote()}
${faqSection()}
    </main>

${dispatchBar()}
${footer()}

    <script type="application/json" id="fps-config">
${json(clientConfig())}
    </script>

    <script type="module" src="js/logo-forge.js"></script>
    <script type="module" src="js/app.mjs"></script>
</body>
</html>
`;
