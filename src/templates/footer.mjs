/* ==========================================================================
   DISPATCH BAR + FOOTER
   ========================================================================== */

import { html } from '../lib/html.mjs';
import { site, navItems } from '../data/site.mjs';
import { callLink } from './partials.mjs';

export const dispatchBar = () => html`
    <div class="floating-dispatch-bar">
        <div class="pulse-dot" aria-hidden="true"></div>
        <span class="dispatch-label">24/7 COMMAND</span>
        ${callLink({ className: 'btn-quick-call', label: `Call ${site.phone.display}` })}
    </div>`;

export const footer = (isCareers = false) => html`
    <footer class="footer-block">
        <div class="container">
            <img src="${site.logo}" alt="" class="footer-badge-img" width="110" height="110">
            <div class="footer-wordmark">${site.name.toUpperCase()}</div>
            <p class="footer-motto">${site.motto}</p>

            <nav class="footer-menu" aria-label="Footer">
                ${navItems.map((item) => {
                    const href = isCareers && item.href.startsWith('#') ? `index.html${item.href}` : item.href;
                    return html`<a href="${href}">${item.drawerLabel}</a>`;
                })}
                <a href="tel:${site.phone.e164}">24/7 Dispatch</a>
            </nav>

            <p class="footer-areas">
                <span class="footer-areas-label">Areas of Operation</span>
                ${site.areaServed.map((a) => (a.type === 'State' ? `Statewide ${a.name}` : a.name)).join(' \u2022 ')}
            </p>

            <p class="footer-disclaimer">
                ${site.name} is a licensed and insured private security company operating in full compliance with the Texas Department of Public Safety Private Security Bureau (PSB). All rights reserved.
            </p>
            <p class="footer-credit">&copy; ${site.copyrightYear} ${site.name}. Built &amp; Powered by Apex Digital Engineering.</p>
        </div>
    </footer>`;
