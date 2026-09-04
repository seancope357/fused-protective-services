/* ==========================================================================
   HERO — EMBLEM, THESIS, ACTIONS, PROOF FIGURES
   ========================================================================== */

import { html } from '../lib/html.mjs';
import { site, heroMetrics } from '../data/site.mjs';
import { uiIcons } from '../data/icons.mjs';

export const hero = () => html`
    <section class="hero">
        <div class="container">

            <div class="emblem-wrapper" id="emblemWrapper">
                <img src="${site.logo}" alt="${site.name} shield emblem" class="emblem-card" id="emblemCard" width="185" height="185">
            </div>

            <h1 class="hero-heading">
                Elite Protection When <span class="gold-gradient-text">Discretion &amp; Defense</span> Matter Most.
            </h1>

            <p class="hero-lead">
                Commissioned armed and unarmed tactical officers, VIP executive close protection, luxury event and nightlife venue security, and commercial perimeter defense. Rapid deployment across Austin, San Antonio, and statewide Texas.
            </p>

            <div class="hero-actions">
                <a href="#quote" class="btn-gold">
                    ${uiIcons.bolt('class="ui-icon ui-icon--lg ui-icon--filled"')} Request Immediate Security Detail
                </a>
                <a href="#assessment" class="btn-secondary-glass">
                    ${uiIcons.crosshair('class="ui-icon ui-icon--lg"')} 60-Sec Threat Assessment
                </a>
            </div>

            <div class="metrics-grid">
                ${heroMetrics.map(
                    (m) => html`
                <div class="metric-item">
                    <div class="metric-val">${m.value}</div>
                    <div class="metric-label">${m.label}</div>
                </div>`
                )}
            </div>

        </div>
    </section>`;
