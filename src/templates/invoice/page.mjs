/* ==========================================================================
   LEGACY INVOICE TOOL — EXPORT PAGE
   Invoicing moved into the operations portal (app/), where numbers are
   minted by the database and payment status comes from Stripe. This page
   exists so the records the old browser-only builder saved in localStorage
   can be carried across: it reads them, shows them, and offers the JSON the
   portal's import page accepts. Nothing else on the old tool remains.
   ========================================================================== */

import { html } from '../../lib/html.mjs';
import { site, portalUrl } from '../../data/site.mjs';
import { invoiceHead } from './head.mjs';

export const invoicePage = () => html`<!DOCTYPE html>
<html lang="en">
<head>
${invoiceHead()}
</head>
<body class="inv-body">

    <a href="#invoice-export" class="skip-link">Skip to export</a>

    <main class="inv-moved" id="invoice-export">
        <img src="${site.logo}" alt="" width="64" height="64">
        <h1>Invoicing has moved to the operations portal</h1>
        <p>
            Invoices are now created, sent and paid at <a href="${portalUrl}/portal/invoices">${portalUrl.replace(/^https?:\/\//, '')}/portal/invoices</a>.
            Numbers are issued by the database, so two devices can never collide, and payment status comes from Stripe.
        </p>
        <p>
            If this browser still holds invoices from the old tool, they are listed below. Copy the export and paste it into
            <strong>Portal → Invoices → Import legacy</strong>. Nothing is transmitted from this page; the copy is yours to paste.
        </p>

        <p class="form-status" id="invExportStatus" role="status" aria-live="polite"></p>
        <div id="invExportSummary" hidden>
            <p><span id="invExportCount"></span> saved in this browser.</p>
            <pre id="invExportJson" tabindex="0" aria-label="Invoice export JSON"></pre>
            <div class="inv-actions">
                <button type="button" class="btn-gold" data-action="copy-export">Copy export to clipboard</button>
                <a class="btn-secondary-glass" href="${portalUrl}/portal/invoices/import">Open the import page</a>
            </div>
        </div>
        <p id="invExportEmpty" hidden>No invoices are saved in this browser. There is nothing to migrate.</p>
    </main>

    <script type="module" src="js/invoice.mjs"></script>
</body>
</html>
`;
