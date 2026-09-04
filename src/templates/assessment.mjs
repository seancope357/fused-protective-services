/* ==========================================================================
   60-SECOND THREAT & VULNERABILITY ASSESSMENT
   Each option carries its own routing (`data-option`), so the engine no
   longer infers meaning by substring-matching the label a copywriter wrote.
   ========================================================================== */

import { html } from '../lib/html.mjs';
import { assessment } from '../data/assessment.mjs';
import { quizIcons, spineIcons } from '../data/icons.mjs';
import { sectionHead } from './partials.mjs';

const step = (stepData, index) => html`
                <div class="threat-quiz-step${index === 0 ? ' active' : ''}" id="quizStep${index + 1}"${index === 0 ? '' : ' hidden'}>
                    <div class="quiz-q-title">${stepData.title}</div>
                    <div class="quiz-options-grid">
                        ${stepData.options.map(
                            (option) => html`
                        <button type="button" class="quiz-option-btn" data-quiz-step="${stepData.id}" data-option="${option.id}">
                            ${quizIcons[option.icon]('class="tactical-svg tactical-svg--quiz"')} ${option.label}
                        </button>`
                        )}
                    </div>
                </div>`;

export const assessmentSection = () => html`
    <section class="section-padding section-padding--deep" id="assessment">
        <div class="container">
${sectionHead({
    tag: 'Interactive Diagnostics',
    title: '60-Second Threat & Vulnerability Assessment',
    desc: 'Answer 2 quick operational questions to calculate your risk level and receive an instant squad deployment recommendation.'
})}

            <div class="assessment-wrapper" data-reveal>
${assessment.steps.map(step)}

                <div class="threat-quiz-step quiz-result" id="quizResult" hidden>
                    ${spineIcons.shieldCheck('class="tactical-svg tactical-svg--result"')}
                    <h3 class="quiz-result-heading">${assessment.result.heading}</h3>
                    <div id="quizRecommendationText" class="quiz-result-rec" role="status">
                        Recommended: ${assessment.result.placeholder}
                    </div>
                    <p class="quiz-result-body">${assessment.result.body}</p>
                    <button type="button" class="btn-gold" data-action="apply-assessment">
                        ${assessment.result.cta}
                    </button>
                </div>
            </div>
        </div>
    </section>`;
