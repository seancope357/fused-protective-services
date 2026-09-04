/* ==========================================================================
   THE 5-PHASE VETTING PROTOCOL VISUALIZER
   ========================================================================== */

import { html } from '../../lib/html.mjs';
import { vettingStages } from '../../data/careers.mjs';

export const careersVetting = () => html`
<section class="careers-vetting-section" id="vetting-protocol">
    <div class="container">
        <div class="section-header-centered" data-reveal>
            <div class="tactical-badge">SCREENING MATRIX</div>
            <h2 class="section-title">THE 5-STAGE VETTING PROTOCOL</h2>
            <p class="section-lead">
                Every candidate is evaluated through an exhaustive 5-stage verification process to ensure flawless tactical judgment, moral integrity, and client discretion.
            </p>
        </div>

        <div class="vetting-stepper-track">
            ${vettingStages.map(
                (stage, idx) => html`
            <div class="vetting-stage-card" data-step="${stage.step}" data-reveal>
                <div class="stage-step-indicator">
                    <span class="stage-step-num">${stage.step}</span>
                    <span class="stage-step-connector" aria-hidden="true"></span>
                </div>
                <div class="stage-card-body">
                    <div class="stage-badge">${stage.badge}</div>
                    <h3 class="stage-heading">${stage.heading}</h3>
                    <p class="stage-text">${stage.body}</p>
                    <div class="stage-checkpoint">
                        <span class="checkpoint-icon">🛡️</span>
                        <span class="checkpoint-label">Gate Metric: ${stage.checkpoint}</span>
                    </div>
                </div>
            </div>`
            )}
        </div>
    </div>
</section>
`;
