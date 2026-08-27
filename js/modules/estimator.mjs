/* ==========================================================================
   COVERAGE & BUDGET ESTIMATOR
   Rates arrive from the build rather than from numbers typed into onclick
   attributes, so the figure quoted here and the figure in src/data always
   agree.
   ========================================================================== */

import { config, goToQuote, setField } from './config.mjs';

let tierId;

const money = (n) => '$' + n.toLocaleString('en-US');

function inputs() {
    return {
        officers: Number(document.getElementById('guardRange')?.value ?? 0),
        hours: Number(document.getElementById('hoursRange')?.value ?? 0)
    };
}

function recalculate() {
    const tier = config.estimator.tiers[tierId];
    const { officers, hours } = inputs();
    if (!tier) return;

    const officerText = document.getElementById('guardCountText');
    const hoursText = document.getElementById('hoursText');
    const total = document.getElementById('calculatedTotal');
    const formula = document.getElementById('calculatedFormula');

    if (officerText) officerText.textContent = `${officers} ${officers === 1 ? 'Officer' : 'Officers'}`;
    if (hoursText) hoursText.textContent = `${hours} ${hours === 1 ? 'Hour' : 'Hours'}`;
    if (total) total.textContent = money(officers * hours * tier.rate);
    if (formula) formula.textContent = `${officers} ${tier.name} × ${hours} Hours @ $${tier.rate}/hr`;
}

function selectTier(id, buttons) {
    if (!config.estimator.tiers[id]) return;
    tierId = id;

    for (const button of buttons) {
        const isActive = button.dataset.tier === id;
        button.classList.toggle('active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    }
    recalculate();
}

function apply() {
    const tier = config.estimator.tiers[tierId];
    const { officers, hours } = inputs();
    if (!tier) return;

    setField('formSchedule', `${hours} Hours / Shift (${officers} Officers Estimated)`);
    setField('formArmedPreference', tier.armed);
    setField('formDivision', tier.division);   // null tiers leave the choice alone
    goToQuote();
}

export function initEstimator() {
    const card = document.querySelector('.estimator-card');
    if (!card || !config?.estimator) return;

    tierId = config.estimator.defaultTier;
    const buttons = [...card.querySelectorAll('[data-tier]')];

    card.addEventListener('click', (event) => {
        const tierButton = event.target.closest('[data-tier]');
        if (tierButton) {
            selectTier(tierButton.dataset.tier, buttons);
            return;
        }
        if (event.target.closest('[data-action="apply-estimate"]')) apply();
    });

    card.addEventListener('input', (event) => {
        if (event.target.classList.contains('range-slider')) recalculate();
    });

    recalculate();
}
