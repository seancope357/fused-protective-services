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
                JOIN THE <span class="text-gold-gradient">ELITE SHIELD</span>
            </h1>

            <p class="careers-hero-lead">
                Fused Protective Services is contracting Texas DPS Level IV Personal Protection Officers (PPO), Level III Commissioned Armed Officers, Level II Unarmed Officers, and tactical dispatch operators across Austin, San Antonio, and statewide Texas. We offer market-rate pay by license level, paid specialized training, a repayable gear stipend, and a command culture built on military, law enforcement, and confirmed skilled civilian experience.
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
                <div class="metric-val text-gold-gradient">${metric.value}</div>
                <div class="metric-lbl">${metric.label}</div>
            </div>`
            )}
        </div>
    </div>
</section>
`;
