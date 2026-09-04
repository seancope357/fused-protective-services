/* ==========================================================================
   OFFICER BENEFITS & THE FUSED STANDARD
   ========================================================================== */

import { html, raw } from '../../lib/html.mjs';
import { officerBenefits } from '../../data/careers.mjs';
import { spineIcons } from '../../data/icons.mjs';

export const careersBenefits = () => html`
<section class="careers-benefits-section" id="officer-standards">
    <div class="container">
        <div class="section-header-centered" data-reveal>
            <div class="tactical-badge">OPERATIONAL CULTURE</div>
            <h2 class="section-title">THE FUSED STANDARD FOR OFFICERS</h2>
            <p class="section-lead">
                We demand the top 5% of protective talent, whether it comes from military service, law enforcement, or confirmed skilled civilian protection work. In return, we invest heavily in your tactical capabilities, support your gear loadout, and respect your operational professionalism.
            </p>
        </div>

        <div class="benefits-grid">
            ${officerBenefits.map(
                (b) => html`
            <div class="benefit-card" data-reveal>
                <div class="benefit-icon-box">
                    ${spineIcons[b.icon] ? spineIcons[b.icon]('class="tactical-svg--lg"') : ''}
                </div>
                <h3 class="benefit-title">${b.title}</h3>
                <p class="benefit-desc">${b.body}</p>
            </div>`
            )}
        </div>
    </div>
</section>
`;
