/* ==========================================================================
   LEGACY INVOICE EXPORT
   Reads the records the retired browser builder saved (fps_invoices_v1) and
   presents them as JSON for the portal's import. Read-only; nothing here
   writes storage or the network.
   ========================================================================== */

import { listInvoices } from './modules/invoice-store.mjs';

function init() {
    const summary = document.getElementById('invExportSummary');
    const empty = document.getElementById('invExportEmpty');
    const status = document.getElementById('invExportStatus');
    const pre = document.getElementById('invExportJson');
    const count = document.getElementById('invExportCount');
    if (!summary || !empty || !pre) return;

    const invoices = listInvoices();
    if (invoices.length === 0) {
        empty.hidden = false;
        return;
    }
    const json = JSON.stringify(invoices, null, 2);
    pre.textContent = json;
    count.textContent = `${invoices.length} invoice${invoices.length === 1 ? '' : 's'}`;
    summary.hidden = false;

    document.querySelector('[data-action="copy-export"]')?.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(json);
            status.textContent = 'Export copied. Paste it into the portal import page.';
        } catch {
            status.textContent = 'Clipboard blocked — select the text above and copy it manually.';
        }
    });
}

try {
    init();
} catch (err) {
    console.error('[fps] invoice export failed to initialise:', err);
}
