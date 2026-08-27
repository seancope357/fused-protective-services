/* ==========================================================================
   FAQ ACCORDION
   Built on <details>/<summary>, which gives keyboard operation, expanded
   state, and screen-reader semantics from the platform. The previous markup
   was a <div onclick> toggling inline display, reachable only by mouse.
   ========================================================================== */

import { html } from '../lib/html.mjs';
import { faqs } from '../data/faq.mjs';
import { sectionHead } from './partials.mjs';

export const faqSection = () => html`
    <section class="section-padding section-padding--sunken" id="faq">
        <div class="container">
${sectionHead({ tag: 'Intelligence Brief', title: 'Frequently Asked Questions' })}

            <div class="faq-stack">
                ${faqs.map(
                    (faq) => html`
                <details class="faq-box">
                    <summary class="faq-question">
                        <span>${faq.question}</span>
                        <span class="faq-toggle-icon font-mono" aria-hidden="true"></span>
                    </summary>
                    <div class="faq-answer">${faq.answer}</div>
                </details>`
                )}
            </div>
        </div>
    </section>`;
