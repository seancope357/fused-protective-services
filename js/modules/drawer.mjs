/* ==========================================================================
   MOBILE COMMAND DRAWER
   Hidden from assistive technology while closed, restores focus on close,
   and closes on Escape — none of which the inline-onclick version did.
   ========================================================================== */

let drawer, overlay, trigger, lastFocus;

function open() {
    drawer.hidden = false;
    overlay.hidden = false;
    /* The class drives the transition; [hidden] drives existence. Setting
       both in the same frame would skip the slide, so the class lands next. */
    requestAnimationFrame(() => {
        drawer.classList.add('open');
        overlay.classList.add('open');
    });
    trigger.setAttribute('aria-expanded', 'true');
    lastFocus = document.activeElement;
    drawer.querySelector('a, button')?.focus();
}

function close() {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
    trigger.setAttribute('aria-expanded', 'false');

    const done = () => {
        drawer.hidden = true;
        overlay.hidden = true;
    };
    /* Wait for the slide-out so the panel does not vanish mid-transition. */
    drawer.addEventListener('transitionend', done, { once: true });
    setTimeout(done, 400);   // fallback if the transition never fires

    lastFocus?.focus();
}

export function initDrawer() {
    drawer = document.getElementById('mobileDrawer');
    overlay = document.getElementById('drawerOverlay');
    trigger = document.querySelector('[data-action="open-drawer"]');
    if (!drawer || !overlay || !trigger) return;

    document.addEventListener('click', (event) => {
        const action = event.target.closest('[data-action]')?.dataset.action;
        if (action === 'open-drawer') open();
        else if (action === 'close-drawer') close();
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !drawer.hidden) close();
    });
}
