/* ==========================================================================
   BUILD-SUPPLIED CONFIGURATION
   The generator serializes the slice of src/data the browser needs into a
   JSON island. Reading it here means the client and the markup cannot hold
   different ideas of what a division, a tier, or a recommendation is.
   ========================================================================== */

function read() {
    const island = document.getElementById('fps-config');
    if (!island) {
        console.error('[fps] #fps-config is missing; interactive modules are inert.');
        return null;
    }
    try {
        return JSON.parse(island.textContent);
    } catch (err) {
        console.error('[fps] #fps-config is not valid JSON:', err);
        return null;
    }
}

export const config = read();

/** Scrolls the intake form into view; the one place that behaviour lives.
    An explicit 'smooth' would override the reduced-motion CSS, animating a
    long ride across the intro track for users who asked for no motion. */
export function goToQuote() {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('quote')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
}

/** Sets a form control's value only when that exact option exists. */
export function setField(id, value) {
    if (value === null || value === undefined) return;
    const el = document.getElementById(id);
    if (!el) return;

    if (el.tagName === 'SELECT' && ![...el.options].some((o) => o.value === value)) {
        console.warn(`[fps] #${id} has no option "${value}"; leaving it unchanged.`);
        return;
    }
    el.value = value;
}
