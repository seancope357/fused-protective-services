/* ==========================================================================
   COMMAND ISLAND NAVIGATION + MOBILE DRAWER
   Both menus render from one navItems list. The drawer is a real dialog-ish
   surface: it is hidden from assistive tech while closed and its trigger
   reports state, neither of which the inline-onclick version did.
   ========================================================================== */

import { html } from '../lib/html.mjs';
import { site, navItems } from '../data/site.mjs';
import { callLink } from './partials.mjs';

export const drawer = (isCareers = false) => html`
    <div class="drawer-overlay" id="drawerOverlay" data-action="close-drawer" hidden></div>
    <div class="mobile-drawer" id="mobileDrawer" role="dialog" aria-modal="true" aria-label="Command menu" hidden>
        <div class="drawer-head">
            <div class="drawer-title">COMMAND MENU</div>
            <button type="button" class="drawer-close" data-action="close-drawer" aria-label="Close command menu">&times;</button>
        </div>
        ${navItems.map((item) => {
            const href = isCareers && item.href.startsWith('#') ? `index.html${item.href}` : item.href;
            return html`
        <a href="${href}" class="drawer-nav-item" data-action="close-drawer"><span>${item.drawerLabel}</span> <span aria-hidden="true">&rarr;</span></a>`;
        })}

        <div class="drawer-foot">
            ${callLink({ className: 'btn-gold btn-gold--block', label: 'Call 24/7 Command Desk' })}
        </div>
    </div>`;

export const nav = (isCareers = false) => html`
    <div class="nav-island-wrapper">
        <nav class="hud-nav-island" id="hudNavIsland" aria-label="Primary">
            <a href="${isCareers ? 'index.html' : '#'}" class="brand-link">
                <img src="${site.logo}" alt="${site.name} gold shield emblem" class="brand-img" width="40" height="40">
                <div>
                    <div class="brand-title">${site.shortName}</div>
                    <div class="brand-subtitle">${site.subtitle}</div>
                </div>
            </a>

            <div class="segmented-nav-track">
                ${navItems.map((item) => {
                    const href = isCareers && item.href.startsWith('#') ? `index.html${item.href}` : item.href;
                    const isActive = isCareers && item.href === 'careers.html';
                    return html`<a href="${href}" class="nav-pill-item ${isActive ? 'active' : ''}">${item.label}</a>`;
                })}
            </div>

            <div class="nav-actions-cluster">
                ${callLink({ className: 'btn-dispatch' })}
                <button type="button" class="mobile-toggle-btn" data-action="open-drawer"
                        aria-controls="mobileDrawer" aria-expanded="false" aria-label="Open command menu">&#9776;</button>
            </div>
        </nav>
    </div>`;
