/* ==========================================================================
   CAREERS HERO SECTION
   ========================================================================== */

import { html } from '../../lib/html.mjs';
import { careersMetrics } from '../../data/careers.mjs';

export const careersHero = () => html`
<section class="careers-hero-section" id="recruiting-hero">
    <div class="container">
        <div class="careers-hero-content">
            <div class="tactical-eyebrow">
                <span class="eyebrow-pip"></span>
                <span>COMMAND RECRUITING // TEXAS DPS LEVEL II, III &amp; IV</span>
            </div>

            <h1 class="careers-hero-title">
                YOUR EXPERIENCE <span class="gold-gradient-text">COUNTS HERE</span>
            </h1>

            <p class="careers-hero-lead">
                Whether you earned it in uniform, on a police force, or on private protective details, your experience is verified and credited before you are rostered. Level IV officers run executive protection. Level III officers hold armed posts and patrols. Level II officers work gates, lobbies, and venue floors. Dispatchers run the command desk. Your license level sets your pay across Austin, San Antonio, and statewide Texas, advanced training is paid, and a repayable gear stipend is there if you need kit.
            </p>

            <div class="careers-hero-actions">
                <a href="#open-postings" class="btn btn-gold">Explore Open Posts &darr;</a>
                <a href="#prequal-check" class="btn btn-outline">Check Eligibility (30s)</a>
            </div>
        </div>

        <div class="careers-metrics-grid" aria-label="Recruiting Key Figures">
            ${careersMetrics.map(
                (metric) => html`
            <div class="careers-metric-card">
                <div class="metric-val gold-gradient-text">${metric.value}</div>
                <div class="metric-lbl">${metric.label}</div>
            </div>`
            )}
        </div>
    </div>
</section>
`;
