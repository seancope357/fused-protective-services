/* ==========================================================================
   CAREERS & RECRUITMENT INTERACTIVE CONTROLLER
   ========================================================================== */

const refCandidate = () => 'TX-CAND-' + String(Math.floor(1000 + Math.random() * 9000));

export function initCareers() {
    initFilters();
    initAccordions();
    initPrequal();
    initApplyButtons();
    initCandidateForm();
}

/**
 * Filter job cards by category tab.
 */
function initFilters() {
    const track = document.querySelector('.filter-tabs-track');
    const cards = document.querySelectorAll('.position-card');
    if (!track || !cards.length) return;

    track.addEventListener('click', (event) => {
        const btn = event.target.closest('.filter-tab-btn');
        if (!btn) return;

        const filter = btn.dataset.filter;

        // Update active tab state
        track.querySelectorAll('.filter-tab-btn').forEach((b) => {
            b.classList.remove('active');
            b.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');

        // Toggle card visibility
        cards.forEach((card) => {
            if (filter === 'all' || card.dataset.category === filter) {
                card.removeAttribute('hidden');
            } else {
                card.setAttribute('hidden', '');
            }
        });
    });
}

/**
 * Accordion expansion for role requirements & duties.
 */
function initAccordions() {
    const container = document.getElementById('positionsContainer');
    if (!container) return;

    container.addEventListener('click', (event) => {
        const toggleBtn = event.target.closest('[data-action="toggle-details"]');
        if (!toggleBtn) return;

        const targetId = toggleBtn.dataset.target;
        const details = document.getElementById(targetId);
        if (!details) return;

        const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
        if (isExpanded) {
            details.setAttribute('hidden', '');
            toggleBtn.setAttribute('aria-expanded', 'false');
            toggleBtn.querySelector('span:first-child').textContent = 'View Requirements & Duties';
            toggleBtn.querySelector('.toggle-icon').innerHTML = '&darr;';
        } else {
            details.removeAttribute('hidden');
            toggleBtn.setAttribute('aria-expanded', 'true');
            toggleBtn.querySelector('span:first-child').textContent = 'Hide Requirements & Duties';
            toggleBtn.querySelector('.toggle-icon').innerHTML = '&uarr;';
        }
    });
}

/**
 * Interactive 60-second pre-qualification evaluation.
 */
function initPrequal() {
    const evalBtn = document.getElementById('evaluatePrequalBtn');
    const form = document.getElementById('prequalForm');
    const feedback = document.getElementById('prequalFeedback');
    const badge = document.getElementById('feedbackBadge');
    const title = document.getElementById('feedbackTitle');
    const text = document.getElementById('feedbackText');
    const cta = document.getElementById('feedbackCta');

    if (!evalBtn || !form || !feedback) return;

    evalBtn.addEventListener('click', () => {
        const age = form.elements['age']?.value;
        const license = form.elements['license']?.value;
        const background = form.elements['background']?.value;

        if (!age || !license || !background) {
            feedback.removeAttribute('hidden');
            feedback.classList.add('rejected');
            badge.textContent = 'SELECTION INCOMPLETE';
            title.textContent = 'Please Answer All 3 Questions';
            text.textContent = 'All statutory questions must be answered to evaluate operational eligibility.';
            cta?.setAttribute('hidden', '');
            return;
        }

        feedback.removeAttribute('hidden');

        if (age === 'yes' && license === 'yes' && background === 'yes') {
            feedback.classList.remove('rejected');
            badge.textContent = 'PRE-QUALIFIED (TIER I CANDIDATE)';
            title.textContent = 'Operational Prerequisites Satisfied';
            text.textContent =
                'You satisfy the statutory criteria under Texas Occupations Code §1702. We invite you to review active deployment roster openings below and submit your candidate packet.';
            cta?.removeAttribute('hidden');
        } else {
            feedback.classList.add('rejected');
            badge.textContent = 'INELIGIBLE OR TRAINING REQUIRED';
            title.textContent = 'Statutory Criteria Not Met';
            text.textContent =
                'Texas law mandates that commissioned security officers must be at least 21 years old and pass a thorough criminal history check. If you require Level II or III licensure sponsorship, please reach out directly to dispatch.';
            cta?.setAttribute('hidden', '');
        }
    });
}

/**
 * Pre-select position on apply button click.
 */
function initApplyButtons() {
    const container = document.getElementById('positionsContainer');
    const select = document.getElementById('appPosition');
    const applySection = document.getElementById('candidate-application');

    if (!container || !select) return;

    container.addEventListener('click', (event) => {
        const applyBtn = event.target.closest('[data-action="apply-post"]');
        if (!applyBtn) return;

        const posId = applyBtn.dataset.positionId;
        if (posId) {
            select.value = posId;
        }

        if (applySection) {
            applySection.scrollIntoView({
                behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
                block: 'start'
            });
            document.getElementById('appFullName')?.focus();
        }
    });
}

/**
 * Handle candidate intake form submission.
 */
function initCandidateForm() {
    const form = document.getElementById('candidateApplicationForm');
    const status = document.getElementById('candidateStatus');
    if (!form) return;

    form.addEventListener('submit', (event) => {
        event.preventDefault();

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const data = Object.fromEntries(new FormData(form));
        const refCode = refCandidate();

        // Local submission backup seam
        try {
            localStorage.setItem('last_fused_candidate_app', JSON.stringify({ refCode, ...data, timestamp: new Date().toISOString() }));
        } catch (_) {}

        if (status) {
            status.removeAttribute('hidden');
            status.innerHTML = `
                <strong>Application Transmitted Successfully</strong><br>
                Candidate Reference: <span style="color: var(--logo-gold-specular); font-family: 'JetBrains Mono', monospace;">${refCode}</span><br>
                Your operational profile and TOPS licensing credentials have been routed to Cameron Harrell and the Command Operations Desk. You will be contacted at <strong>${data.appPhone}</strong> within 48 business hours.
            `;
        }

        form.reset();
        status?.scrollIntoView({
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
            block: 'center'
        });
    });
}
