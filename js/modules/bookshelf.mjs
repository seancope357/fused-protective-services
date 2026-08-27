/* ==========================================================================
   DIVISIONS BOOKSHELF ACCORDION
   Pointer hover still opens a spine on devices that hover, but the rails are
   buttons now, so the same index is reachable by keyboard and announces its
   expanded state.
   ========================================================================== */

import { goToQuote, setField } from './config.mjs';

const canHover = () => window.matchMedia('(hover: hover)').matches;

function activate(spine, spines) {
    for (const other of spines) {
        const isTarget = other === spine;
        other.classList.toggle('active', isTarget);
        other.querySelector('[data-spine-trigger]')?.setAttribute('aria-expanded', String(isTarget));
    }
}

export function initBookshelf() {
    const shelf = document.getElementById('bookshelfAccordion');
    if (!shelf) return;

    const spines = [...shelf.querySelectorAll('[data-spine]')];

    shelf.addEventListener('click', (event) => {
        const trigger = event.target.closest('[data-spine-trigger]');
        if (trigger) {
            activate(trigger.closest('[data-spine]'), spines);
            return;
        }

        const deploy = event.target.closest('[data-deploy]');
        if (deploy) {
            setField('formDivision', deploy.dataset.deploy);
            goToQuote();
        }
    });

    /* Hover is an enhancement on pointer devices; it must never be the only
       way in, which is why the click handler above stands on its own. */
    for (const spine of spines) {
        spine.addEventListener('mouseenter', () => {
            if (canHover()) activate(spine, spines);
        });
    }
}
