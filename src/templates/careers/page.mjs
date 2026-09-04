/* ==========================================================================
   CAREERS PAGE SHELL
   ========================================================================== */

import { html, json } from '../../lib/html.mjs';
import { positions, prequalQuestions } from '../../data/careers.mjs';
import { careersHead } from './head.mjs';
import { nav, drawer } from '../nav.mjs';
import { careersHero } from './hero.mjs';
import { careersPrequal } from './prequal.mjs';
import { careersBenefits } from './benefits.mjs';
import { careersPositions } from './positions.mjs';
import { careersVetting } from './vetting.mjs';
import { careersApply } from './apply.mjs';
import { dispatchBar, footer } from '../footer.mjs';

const clientCareersConfig = () => ({
    positions: positions.map((p) => ({
        id: p.id,
        title: p.title,
        category: p.category,
        compensation: p.compensation
    })),
    prequal: prequalQuestions.map((q) => q.id)
});

export const careersPage = () => html`<!DOCTYPE html>
<html lang="en">
<head>
${careersHead()}
</head>
<body class="careers-body">

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

    <a href="#open-postings" class="skip-link">Skip to open postings</a>

    <canvas id="tactical-bg-canvas" aria-hidden="true"></canvas>
    <div class="cursor-spotlight" id="cursorSpotlight" aria-hidden="true"></div>

${drawer(true)}
${nav(true)}

    <main id="main">
${careersHero()}
${careersPrequal()}
${careersBenefits()}
${careersPositions()}
${careersVetting()}
${careersApply()}
    </main>

${dispatchBar()}
${footer(true)}

    <script type="application/json" id="fps-careers-config">
${json(clientCareersConfig())}
    </script>

    <script type="module" src="js/app.mjs"></script>
</body>
</html>
`;
