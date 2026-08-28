/* ==========================================================================
   THREAT & VULNERABILITY ASSESSMENT
   Each answer carries its own routing, supplied by the build. The previous
   engine read meaning out of the visible label with .includes('VIP') and
   friends, which meant a copy edit could silently change a recommendation —
   and the Commercial Property answer matched no branch at all, so it handed
   the quote form whatever division was already selected.
   ========================================================================== */

import { config, goToQuote, setField } from './config.mjs';

const state = { environment: null, threat: null };

function show(stepId) {
    const steps = [...document.querySelectorAll('.threat-quiz-step')];
    for (const step of steps) {
        const isTarget = step.id === stepId;
        step.hidden = !isTarget;
        step.classList.toggle('active', isTarget);
    }
    document.getElementById(stepId)?.querySelector('button')?.focus();
}

function present() {
    const { recommendations } = config.assessment;
    const key = state.threat?.escalate ? 'ppo' : (state.environment?.recommend ?? 'squad');
    const text = document.getElementById('quizRecommendationText');
    if (text) text.textContent = `Recommended: ${recommendations[key]}`;
    show('quizResult');
}

function choose(stepId, optionId) {
    const answers = config.assessment[stepId];
    const option = answers?.[optionId];
    if (!option) return;

    if (stepId === 'environment') {
        state.environment = option;
        show('quizStep2');
    } else {
        state.threat = option;
        present();
    }
}

function apply() {
    const { environment, threat } = state;
    if (!environment) return;

    setField('formDivision', environment.division);
    setField('formArmedPreference', environment.armed);

    const rec = document.getElementById('quizRecommendationText')?.textContent.trim() ?? '';
    const notes = document.getElementById('formNotes');
    if (notes) {
        const summary = [
            'Assessment Results:',
            `- Environment: ${environment.value}`,
            `- Threat Level: ${threat?.value ?? 'Not specified'}`,
            `- ${rec}`
        ].join('\n');
        /* Anything the visitor already typed is *their* threat detail —
           the assessment appends below it rather than silently erasing it.
           Re-applying the assessment replaces only its own earlier block. */
        const typed = notes.value.split('\n\nAssessment Results:')[0].trim();
        notes.value = typed ? `${typed}\n\n${summary}` : summary;
    }

    goToQuote();
}

export function initAssessment() {
    const wrapper = document.querySelector('.assessment-wrapper');
    if (!wrapper || !config?.assessment) return;

    wrapper.addEventListener('click', (event) => {
        const option = event.target.closest('[data-option]');
        if (option) {
            choose(option.dataset.quizStep, option.dataset.option);
            return;
        }
        if (event.target.closest('[data-action="apply-assessment"]')) apply();
    });
}
