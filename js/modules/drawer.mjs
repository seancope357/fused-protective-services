/* ==========================================================================
   MOBILE COMMAND DRAWER
   Hidden from assistive technology while closed, restores focus on close,
   and closes on Escape — none of which the inline-onclick version did.
   ========================================================================== */

let drawer, overlay, trigger, lastFocus;
let hideTimer = null;
let hideOnEnd = null;

function disarmHiders() {
    clearTimeout(hideTimer);
    if (hideOnEnd) drawer.removeEventListener('transitionend', hideOnEnd);
    hideOnEnd = null;
}

function open() {
    /* A reopen inside the close's grace window must disarm the deferred
       hiders below, or the stale timeout hides the freshly opened drawer
       mid-use — open, X, open again within 400ms and it vanished. */
    disarmHiders();
    drawer.hidden = false;
    overlay.hidden = false;
    /* The class drives the transition; [hidden] drives existence. Setting
       both in the same frame would skip the slide, so the class lands next. */
    requestAnimationFrame(() => {
        drawer.classList.add('open');
        overlay.classList.add('open');
    });
    trigger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    lastFocus = document.activeElement;
    drawer.querySelector('a, button')?.focus();
}

function close() {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
    trigger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';

    const done = () => {
        disarmHiders();
        drawer.hidden = true;
        overlay.hidden = true;
    };
    /* Wait for the slide-out so the panel does not vanish mid-transition. */
    disarmHiders();
    hideOnEnd = done;
    drawer.addEventListener('transitionend', done, { once: true });
    hideTimer = setTimeout(done, 400);   // fallback if the transition never fires

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
        if (drawer.hidden) return;
        if (event.key === 'Escape') {
            close();
            return;
        }
        /* The drawer declares aria-modal="true", so the promise has to be
           kept: while it is open, Tab cycles inside it instead of escaping
           into the page AT has been told is inert. */
        if (event.key !== 'Tab') return;
        const focusables = drawer.querySelectorAll('a[href], button:not([disabled])');
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (!drawer.contains(document.activeElement)) {
            event.preventDefault();
            first.focus();
        } else if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });
}
