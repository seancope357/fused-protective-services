/* ==========================================================================
   SCROLL REVEAL
   Marks every [data-reveal] element as revealed the first time it enters
   the viewport. The starting (hidden) state lives in reveal.css behind
   `@media (scripting: enabled)`, so this module only ever adds a class —
   it never hides anything, and a failure here leaves the page readable.
   ========================================================================== */

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

export function initReveal() {
    const targets = document.querySelectorAll('[data-reveal]');
    if (!targets.length) return;

    const reveal = (el) => el.classList.add('is-revealed');

    /* No observer, or the visitor asked for calm: land everything at once. */
    if (!('IntersectionObserver' in window) || reduced.matches) {
        targets.forEach(reveal);
        return;
    }

    const observer = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                reveal(entry.target);
                observer.unobserve(entry.target);
            }
        },
        /* Trigger once ~10% of the element has cleared the bottom edge, so a
           card is already moving as the eye reaches it rather than popping in
           at the fold. Tall surfaces (the bookshelf, the intake form) clear
           the threshold early because it is a fraction, not a pixel count. */
        { rootMargin: '0px 0px -8% 0px', threshold: 0.1 }
    );

    targets.forEach((el) => observer.observe(el));
}
