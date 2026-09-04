/* ==========================================================================
   FUSED PROTECTIVE SERVICES — APPLICATION ENTRY
   ==========================================================================
   Every interactive surface is a module that finds its own elements and does
   nothing if they are absent, so a section can be removed from the page
   without leaving a script throwing into the console.

   Loaded as type="module", which is deferred by definition: the DOM is
   parsed before this runs, and no module leaks a global. The page it drives
   carries no inline event handlers at all.
   ========================================================================== */

import { initDrawer } from './modules/drawer.mjs';
import { initBookshelf } from './modules/bookshelf.mjs';
import { initProtocol } from './modules/protocol.mjs';
import { initAssessment } from './modules/assessment.mjs';
import { initEstimator } from './modules/estimator.mjs';
import { initQuoteForm } from './modules/quote-form.mjs';
import { initCareers } from './modules/careers.mjs';
import { initParticles, initTilt, initSpotlight } from './modules/ambient.mjs';
import { initReveal } from './modules/reveal.mjs';

for (const init of [
    initDrawer,
    initBookshelf,
    initProtocol,
    initAssessment,
    initEstimator,
    initQuoteForm,
    initCareers,
    initParticles,
    initTilt,
    initSpotlight,
    initReveal
]) {
    try {
        init();
    } catch (err) {
        /* One failed widget must not take the rest of the page with it. */
        console.error(`[fps] ${init.name} failed to initialise:`, err);
    }
}
