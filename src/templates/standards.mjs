/* ==========================================================================
   THE FUSED STANDARD
   ========================================================================== */

import { html } from '../lib/html.mjs';
import { standards } from '../data/site.mjs';
import { sectionHead } from './partials.mjs';

export const standardsSection = () => html`
    <section class="section-padding section-padding--framed" id="standards">
        <div class="container">
${sectionHead({
    tag: 'Operational Excellence',
    title: 'The Fused Standard of Protection',
    desc: 'We combine military and law-enforcement tactical discipline with the highest standards of client hospitality and brand preservation.'
})}

            <div class="standards-grid">
                ${standards.map(
                    (standard, index) => html`
                <div class="standard-card">
                    <div class="standard-index" aria-hidden="true">${String(index + 1).padStart(2, '0')}</div>
                    <h3 class="standard-title">${standard.title}</h3>
                    <p class="standard-body">${standard.body}</p>
                </div>`
                )}
            </div>
        </div>
    </section>`;
