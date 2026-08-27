/* ==========================================================================
   DEPLOYMENT PROTOCOL — TAB PANEL
   Implements the ARIA tabs pattern: one tab stop for the whole set, arrow
   keys move between phases, Home/End jump to the ends.
   ========================================================================== */

function select(index, tabs, panels) {
    tabs.forEach((tab, i) => {
        const isActive = i === index;
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-selected', String(isActive));
        tab.tabIndex = isActive ? 0 : -1;
    });

    panels.forEach((panel, i) => {
        const isActive = i === index;
        panel.classList.toggle('active', isActive);
        panel.hidden = !isActive;
    });
}

export function initProtocol() {
    const list = document.querySelector('[role="tablist"]');
    if (!list) return;

    const tabs = [...list.querySelectorAll('[data-stage]')];
    const panels = tabs.map((tab) => document.getElementById(tab.getAttribute('aria-controls')));
    if (!tabs.length || panels.some((p) => !p)) return;

    list.addEventListener('click', (event) => {
        const tab = event.target.closest('[data-stage]');
        if (tab) select(tabs.indexOf(tab), tabs, panels);
    });

    list.addEventListener('keydown', (event) => {
        const current = tabs.indexOf(event.target.closest('[data-stage]'));
        if (current < 0) return;

        const moves = {
            ArrowRight: current + 1,
            ArrowDown: current + 1,
            ArrowLeft: current - 1,
            ArrowUp: current - 1,
            Home: 0,
            End: tabs.length - 1
        };
        if (!(event.key in moves)) return;

        event.preventDefault();
        const next = (moves[event.key] + tabs.length) % tabs.length;
        select(next, tabs, panels);
        tabs[next].focus();
    });
}
