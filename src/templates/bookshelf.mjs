/* ==========================================================================
   TACTICAL DIVISIONS — BOOKSHELF ACCORDION
   Six spines from one data list. The rail is a real <button> with
   aria-expanded: the previous version was a <div onmouseenter onclick>, so
   the entire capability index was unreachable by keyboard and silent to
   screen readers.
   ========================================================================== */

import { html } from '../lib/html.mjs';
import { divisions, divisionNumber } from '../data/divisions.mjs';
import { spineIcons } from '../data/icons.mjs';
import { sectionHead } from './partials.mjs';

const spine = (division, index) => {
    const isFirst = index === 0;
    const payloadId = `payload-${division.id}`;

    return html`
                <div class="bookshelf-spine${isFirst ? ' active' : ''}" data-spine>
                    <button type="button" class="spine-rail" data-spine-trigger
                            aria-expanded="${isFirst ? 'true' : 'false'}" aria-controls="${payloadId}">
                        <span class="spine-icon-housing">${spineIcons[division.icon]()}</span>
                        <span class="spine-vertical-title">${division.spineTitle}</span>
                        <span class="spine-code">${division.code}</span>
                    </button>
                    <div class="spine-expanded-payload" id="${payloadId}">
                        <div>
                            <span class="payload-badge${division.badgeTone === 'urgent' ? ' payload-badge--urgent' : ''}">${division.badge}</span>
                            <h3 class="payload-heading">${division.heading}</h3>
                            <p class="payload-desc">${division.description}</p>
                            <ul class="payload-checklist">
                                ${division.checklist.map((item) => html`<li>${item}</li>`)}
                            </ul>
                        </div>
                        <button type="button" class="btn-select-division" data-deploy="${division.quoteValue}">
                            Deploy Division ${divisionNumber(index)} <span aria-hidden="true">&rarr;</span>
                        </button>
                    </div>
                </div>`;
};

export const bookshelf = () => html`
    <section class="section-padding" id="capabilities">
        <div class="container">
${sectionHead({
    tag: 'Interactive Capability Index',
    title: 'Full-Spectrum Tactical Divisions',
    desc: 'Select any division spine to slide open its operational deployment details.'
})}

            <div class="bookshelf-container" id="bookshelfAccordion">
${divisions.map(spine)}
            </div>
        </div>
    </section>`;
