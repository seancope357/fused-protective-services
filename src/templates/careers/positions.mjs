/* ==========================================================================
   OPEN POSTINGS & INTERACTIVE JOB BOARD
   ========================================================================== */

import { html } from '../../lib/html.mjs';
import { positions } from '../../data/careers.mjs';

const categories = [
    { id: 'all', label: 'All Postings' },
    { id: 'executive', label: 'Executive PPO' },
    { id: 'armed', label: 'Armed Patrol' },
    { id: 'event', label: 'Event Operations' },
    { id: 'unarmed', label: 'Concierge & Gate' },
    { id: 'operations', label: 'Command Desk' }
];

export const careersPositions = () => html`
<section class="careers-positions-section" id="open-postings">
    <div class="container">
        <div class="section-header-centered">
            <div class="tactical-badge">ACTIVE REQUISITIONS</div>
            <h2 class="section-title">DEPLOYMENT ROSTER OPENINGS</h2>
            <p class="section-lead">
                Review active contractual security assignments in the greater Austin area and statewide Texas. Select a requisition to inspect operational duties and prerequisite licensing.
            </p>
        </div>

        <div class="filter-tabs-track" role="tablist" aria-label="Filter Positions by Category">
            ${categories.map(
                (cat, idx) => html`
            <button type="button" class="filter-tab-btn ${idx === 0 ? 'active' : ''}" 
                    role="tab" 
                    id="tab-${cat.id}"
                    aria-selected="${idx === 0 ? 'true' : 'false'}" 
                    data-filter="${cat.id}">
                ${cat.label}
            </button>`
            )}
        </div>

        <div class="positions-list" id="positionsContainer">
            ${positions.map(
                (pos) => html`
            <article class="position-card" data-category="${pos.category}" id="${pos.id}">
                <div class="position-header">
                    <div class="position-meta-top">
                        <span class="position-code">${pos.code}</span>
                        <span class="position-badge">${pos.badge}</span>
                        <span class="position-license">${pos.licenseTier}</span>
                    </div>
                    <h3 class="position-title">${pos.title}</h3>
                    <div class="position-stats-strip">
                        <div class="stat-pill"><span class="stat-icon">📍</span> ${pos.location}</div>
                        <div class="stat-pill"><span class="stat-icon">⏱️</span> ${pos.schedule}</div>
                        <div class="stat-pill stat-pill--gold"><span class="stat-icon">💵</span> ${pos.compensation}</div>
                    </div>
                </div>

                <p class="position-summary">${pos.summary}</p>

                <div class="position-details" id="details-${pos.id}" hidden>
                    <div class="details-grid">
                        <div class="details-column">
                            <h4 class="details-heading">Prerequisites &amp; Licensing</h4>
                            <ul class="details-list">
                                ${pos.requirements.map((req) => html`<li>${req}</li>`)}
                            </ul>
                        </div>
                        <div class="details-column">
                            <h4 class="details-heading">Tactical Responsibilities</h4>
                            <ul class="details-list">
                                ${pos.duties.map((duty) => html`<li>${duty}</li>`)}
                            </ul>
                        </div>
                    </div>
                </div>

                <div class="position-card-footer">
                    <button type="button" class="position-toggle-btn" 
                            aria-expanded="false" 
                            aria-controls="details-${pos.id}"
                            data-action="toggle-details" 
                            data-target="details-${pos.id}">
                        <span>View Requirements &amp; Duties</span>
                        <span class="toggle-icon" aria-hidden="true">&darr;</span>
                    </button>

                    <button type="button" class="btn btn-gold btn-sm" 
                            data-action="apply-post" 
                            data-position-id="${pos.id}"
                            data-position-title="${pos.title}">
                        Apply For This Post &rarr;
                    </button>
                </div>
            </article>`
            )}
        </div>
    </div>
</section>
`;
