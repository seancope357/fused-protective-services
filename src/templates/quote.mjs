/* ==========================================================================
   SECURITY DETAIL INTAKE FORM
   The division <select> is generated from the same list that renders the
   bookshelf, so a spine's "Deploy Division" button can never target an option
   that does not exist. Every label is now bound to its control with `for` —
   previously the labels were unassociated text, so screen readers announced
   the inputs unnamed.
   ========================================================================== */

import { html } from '../lib/html.mjs';
import { divisions } from '../data/divisions.mjs';
import { armedPreferences, armedPreferenceOrder } from '../data/intake.mjs';
import { uiIcons } from '../data/icons.mjs';
import { sectionHead } from './partials.mjs';

const field = ({ id, label, type = 'text', placeholder = '', required = false }) => html`
                        <div class="form-field">
                            <label for="${id}">${label}</label>
                            <input type="${type}" id="${id}" name="${id}" placeholder="${placeholder}"${required ? ' required' : ''}>
                        </div>`;

export const quote = () => html`
    <section class="section-padding" id="quote">
        <div class="container">
${sectionHead({
    tag: 'Direct Operational Booking',
    title: 'Request a Security Detail Quote',
    desc: 'Submit your coverage parameters below. Our operations command will review your requirements and respond with a formal quote within 2 hours.'
})}

            <div class="form-shell">
                <form id="securityQuoteForm" novalidate>
                    <div class="form-row-2col">
${field({ id: 'formName', label: 'Point of Contact Name', placeholder: 'Full name', required: true })}
${field({ id: 'formCompany', label: 'Company / Organization Name', placeholder: 'Organization' })}
                    </div>

                    <div class="form-row-2col">
${field({ id: 'formPhone', label: 'Direct Phone Number', type: 'tel', placeholder: '(512) 555-0199', required: true })}
${field({ id: 'formEmail', label: 'Email Address', type: 'email', placeholder: 'name@company.com', required: true })}
                    </div>

                    <div class="form-row-2col">
                        <div class="form-field">
                            <label for="formDivision">Service Division</label>
                            <select id="formDivision" name="formDivision">
                                ${divisions.map((d) => html`<option value="${d.quoteValue}">${d.quoteValue}</option>`)}
                            </select>
                        </div>
                        <div class="form-field">
                            <label for="formArmedPreference">Armed / Unarmed Preference</label>
                            <select id="formArmedPreference" name="formArmedPreference">
                                ${armedPreferenceOrder.map(
                                    (key) => html`<option value="${armedPreferences[key]}">${armedPreferences[key]}</option>`
                                )}
                            </select>
                        </div>
                    </div>

                    <div class="form-row-2col">
${field({ id: 'formLocation', label: 'Deployment Location / Venue', placeholder: 'City, county, or venue address', required: true })}
${field({ id: 'formSchedule', label: 'Estimated Shift Schedule & Date(s)', placeholder: 'e.g. October 24-26, 6pm - 2am daily', required: true })}
                    </div>

                    <div class="form-field full-span form-field--notes">
                        <label for="formNotes">Mission Specifics &amp; Threat Parameters</label>
                        <textarea id="formNotes" name="formNotes" rows="4" placeholder="Detail any VIP arrivals, high-value assets, crowd size, access control checkpoints, or specific security protocols required..."></textarea>
                    </div>

                    <button type="submit" class="btn-gold btn-gold--block btn-gold--lg">
                        Submit Confidential Security Request
                    </button>
                    <p class="form-assurance">
                        ${uiIcons.lock('class="ui-icon"')} All inquiries are protected under attorney-client and private security non-disclosure standards.
                    </p>
                    <p class="form-status" id="formStatus" role="status" aria-live="polite"></p>
                </form>
            </div>
        </div>
    </section>`;
