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

import { initErrorReport } from './modules/error-report.mjs';
import { initDrawer } from './modules/drawer.mjs';
import { initBookshelf } from './modules/bookshelf.mjs';
import { initProtocol } from './modules/protocol.mjs';
import { initAssessment } from './modules/assessment.mjs';
import { initEstimator } from './modules/estimator.mjs';
import { initQuoteForm } from './modules/quote-form.mjs';
import { initCareers } from './modules/careers.mjs';
import { initParticles, initTilt, initSpotlight } from './modules/ambient.mjs';
import { initReveal } from './modules/reveal.mjs';

/* First, and outside the loop below: a widget that throws while the page is
   still starting up is exactly the failure worth hearing about, and the
   listeners have to be bound before anything can throw past them. It is
   itself failure-tolerant — see js/modules/error-report.mjs. */
initErrorReport();

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
        /* One failed widget must not take the rest of the page with it — and
           because it is caught here it never reaches window.onerror, so it is
           handed to the reporter explicitly or nobody ever hears about it. */
        console.error(`[fps] ${init.name} failed to initialise:`, err);
        window.dispatchEvent(new CustomEvent('fps:report', {
            detail: { kind: 'init_failed', message: `${init.name}: ${err?.message ?? err}` }
        }));
    }
}
