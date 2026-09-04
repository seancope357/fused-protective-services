/* ==========================================================================
   INTERACTIVE PRE-QUALIFICATION CHECK
   ========================================================================== */

import { html } from '../../lib/html.mjs';
import { prequalQuestions } from '../../data/careers.mjs';

export const careersPrequal = () => html`
<section class="careers-prequal-section" id="prequal-check">
    <div class="container">
        <div class="section-header-centered" data-reveal>
            <div class="tactical-badge">STATUTORY ELIGIBILITY</div>
            <h2 class="section-title">60-SECOND CANDIDATE PRE-CHECK</h2>
            <p class="section-lead">
                Texas Occupations Code §1702 sets stringent legal standards for commissioned security personnel. Confirm your operational eligibility before filing an official candidate packet.
            </p>
        </div>

        <div class="prequal-box" data-reveal>
            <form id="prequalForm" class="prequal-form" novalidate>
                <div class="prequal-grid">
                    ${prequalQuestions.map(
                        (q, i) => html`
                    <div class="prequal-item">
                        <div class="prequal-num">0${i + 1}</div>
                        <div class="prequal-body">
                            <label class="prequal-label" for="prequal_${q.id}">${q.label}</label>
                            <span class="prequal-helper">${q.helper}</span>
                        </div>
                        <div class="prequal-switch-group">
                            <label class="prequal-choice">
                                <input type="radio" name="${q.id}" value="yes" required>
                                <span>YES</span>
                            </label>
                            <label class="prequal-choice">
                                <input type="radio" name="${q.id}" value="no" required>
                                <span>NO</span>
                            </label>
                        </div>
                    </div>`
                    )}
                </div>

                <div class="prequal-actions">
                    <button type="button" class="btn btn-gold" id="evaluatePrequalBtn" data-action="eval-prequal">
                        Run Operational Eligibility Check
                    </button>
                </div>
            </form>

            <div class="prequal-feedback" id="prequalFeedback" aria-live="polite" hidden>
                <div class="feedback-status-badge" id="feedbackBadge">PENDING</div>
                <div class="feedback-title" id="feedbackTitle">Status Check</div>
                <p class="feedback-text" id="feedbackText"></p>
                <a href="#open-postings" class="btn btn-gold feedback-cta" id="feedbackCta" hidden>View Matching Open Postings &darr;</a>
            </div>
        </div>
    </div>
</section>
`;
