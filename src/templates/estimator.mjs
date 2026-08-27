/* ==========================================================================
   COVERAGE & BUDGET ESTIMATOR
   Tier rates come from data rather than from numbers typed into onclick
   attributes, so repricing is a one-line edit in src/data/estimator.mjs.
   ========================================================================== */

import { html } from '../lib/html.mjs';
import { tiers, ranges, estimatorCopy, defaultTier } from '../data/estimator.mjs';
import { sectionHead } from './partials.mjs';

const initialTotal = ranges.officers.value * ranges.hours.value * defaultTier.rate;

export const estimator = () => html`
    <section class="section-padding section-padding--sunken" id="calculator">
        <div class="container">
${sectionHead({
    tag: 'Interactive Planning',
    title: 'Security Coverage & Budget Estimator',
    desc: 'Configure your coverage parameters below for instant ballpark operational budgets.'
})}

            <div class="estimator-card">
                <div class="estimator-grid">
                    <div>
                        <div class="estimator-control-group">
                            <div class="control-header"><span id="tierLabel">Protection Tier</span></div>
                            <div class="tier-toggles" role="group" aria-labelledby="tierLabel">
                                ${tiers.map(
                                    (tier) => html`
                                <button type="button" class="tier-button${tier.default ? ' active' : ''}"
                                        data-tier="${tier.id}" aria-pressed="${tier.default ? 'true' : 'false'}">
                                    ${tier.label}<br><span class="tier-sublabel">${tier.sublabel}</span>
                                </button>`
                                )}
                            </div>
                        </div>

                        <div class="estimator-control-group">
                            <label class="control-header" for="guardRange">
                                <span>Officers Needed:</span>
                                <span id="guardCountText" class="font-mono control-value">${ranges.officers.value} Officers</span>
                            </label>
                            <input type="range" min="${ranges.officers.min}" max="${ranges.officers.max}"
                                   value="${ranges.officers.value}" class="range-slider" id="guardRange">
                        </div>

                        <div class="estimator-control-group">
                            <label class="control-header" for="hoursRange">
                                <span>Shift Duration (Hours):</span>
                                <span id="hoursText" class="font-mono control-value">${ranges.hours.value} Hours</span>
                            </label>
                            <input type="range" min="${ranges.hours.min}" max="${ranges.hours.max}"
                                   value="${ranges.hours.value}" class="range-slider" id="hoursRange">
                        </div>
                    </div>

                    <div class="estimate-summary-box">
                        <div class="control-header control-header--centred"><span>Estimated Deployment</span></div>
                        <div class="price-output" id="calculatedTotal" role="status">$${initialTotal.toLocaleString('en-US')}</div>
                        <div class="price-breakdown" id="calculatedFormula">${ranges.officers.value} ${defaultTier.name} &times; ${ranges.hours.value} Hours @ $${defaultTier.rate}/hr</div>
                        <button type="button" class="btn-gold btn-gold--block" data-action="apply-estimate">
                            ${estimatorCopy.cta}
                        </button>
                        <p class="estimator-disclaimer">${estimatorCopy.disclaimer}</p>
                    </div>
                </div>
            </div>
        </div>
    </section>`;
