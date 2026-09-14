/* ==========================================================================
   THE FUSED DEPLOYMENT PROTOCOL — FOUR-PHASE HUB
   Rendered as a proper ARIA tablist. Phase numbers come from array position,
   so reordering the data reorders the protocol and renumbers it in one edit.
   ========================================================================== */

import { html } from '../lib/html.mjs';
import { protocolStages } from '../data/protocol.mjs';
import { sectionHead } from './partials.mjs';

const phaseLabel = (index) => `STEP ${String(index + 1).padStart(2, '0')}`;

const panel = (stage, index) => html`
                <div class="protocol-stage-content${index === 0 ? ' active' : ''}" id="stagePanel${index}"
                     role="tabpanel" tabindex="0" aria-labelledby="stageTab${index}"${index === 0 ? '' : ' hidden'}>
                    <div>
                        <h3 class="stage-hero-heading">${stage.heading}</h3>
                        <p class="stage-paragraph">${stage.body}</p>
                        <a href="#quote" class="btn-gold">
                            ${stage.cta} <span aria-hidden="true">&rarr;</span>
                        </a>
                    </div>

                    <div class="stage-expectations">
                        <h4>What you can expect</h4>
                        <ul>
                            ${stage.expectations.map((expectation) => html`<li>${expectation}</li>`)}
                        </ul>
                    </div>
                </div>`;

export const protocol = () => html`
    <section class="section-padding section-padding--sunken" id="lifecycle">
        <div class="container">
${sectionHead({
    tag: 'How It Works',
    title: 'Feel supported. Stay focused.',
    desc: 'Protecting your people, property, and peace of mind starts with a clear plan. Here is what working with Fused looks like.'
})}

            <div class="protocol-hub" data-reveal>
                <div class="protocol-stepper-nav" role="tablist" aria-label="How your security service works">
                    ${protocolStages.map(
                        (stage, index) => html`
                    <button type="button" class="protocol-stepper-btn${index === 0 ? ' active' : ''}" id="stageTab${index}"
                            role="tab" aria-selected="${index === 0 ? 'true' : 'false'}" aria-controls="stagePanel${index}"
                            tabindex="${index === 0 ? '0' : '-1'}" data-stage="${index}">
                        <span class="step-num">${phaseLabel(index)}</span>
                        <span class="step-name">${stage.name}</span>
                    </button>`
                    )}
                </div>

${protocolStages.map(panel)}
            </div>
        </div>
    </section>`;
