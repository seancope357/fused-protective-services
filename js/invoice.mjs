/* ==========================================================================
   FUSED PROTECTIVE SERVICES — INVOICING ENTRY
   The invoice page loads this instead of app.mjs: the builder is the only
   interactive surface here, and the marketing page's ambient canvas and
   drawer have no business on an internal tool. Same failure posture as
   app.mjs — a thrown init logs, it does not blank the page.
   ========================================================================== */

import { initInvoiceBuilder } from './modules/invoice-form.mjs';

for (const init of [initInvoiceBuilder]) {
    try {
        init();
    } catch (err) {
        console.error(`[fps] ${init.name} failed to initialise:`, err);
    }
}
