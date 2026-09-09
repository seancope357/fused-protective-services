/* ==========================================================================
   SHARED PARTIALS
   Small pieces repeated across sections. Kept here so a change to the section
   heading rhythm or the call button lands everywhere at once.
   ========================================================================== */

import { html } from '../lib/html.mjs';
import { site } from '../data/site.mjs';
import { uiIcons } from '../data/icons.mjs';

/** Eyebrow + title + optional standfirst, centred above a section's content. */
export const sectionHead = ({ tag, title, desc }) => html`
            <div class="section-head" data-reveal>
                <span class="section-tag">${tag}</span>
                <h2 class="section-title">${title}</h2>
                ${desc ? html`<p class="section-desc">${desc}</p>` : ''}
            </div>`;

/** Visible only on non-production hosts (see placeholder.css): marks a fact
    Cameron has not supplied yet so it cannot ship unnoticed. Renders nothing
    once the fact's `placeholder` flag is false. */
export const placeholderFlag = (fact, what) =>
    fact?.placeholder ? html`<span class="placeholder-flag" role="note">Placeholder ${what}</span>` : '';

/** The 24/7 line. One definition, so the label and the href cannot diverge. */
export const callLink = ({ className, label, iconClass = '' }) => html`<a href="tel:${site.phone.e164}" class="${className}"${site.phone.placeholder ? ' data-placeholder="phone"' : ''}>
                    ${uiIcons.phone(iconClass ? `class="ui-icon ${iconClass}"` : '')} ${label ?? site.phone.display}
                </a>${placeholderFlag(site.phone, 'phone')}`;
