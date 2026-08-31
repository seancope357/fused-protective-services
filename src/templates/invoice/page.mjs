/* ==========================================================================
   INVOICE PAGE SHELL
   The internal invoicing tool, assembled the same way the marketing page is:
   markup from src/data, one JSON island carrying exactly the slice the
   browser script needs. It reuses the island id #fps-config so the shared
   config reader works unchanged. Rates and terms reach the script only
   through the island — the same contract PROJECT_CONTEXT sets for the
   marketing page holds here.
   ========================================================================== */

import { html, json } from '../../lib/html.mjs';
import { site } from '../../data/site.mjs';
import { tiers, defaultTier } from '../../data/estimator.mjs';
import { numbering, netTerms, defaultNetTerm, tax } from '../../data/invoice.mjs';

import { invoiceHead } from './head.mjs';
import { builder } from './builder.mjs';
import { invoiceDoc } from './document.mjs';

/** Exactly what js/modules/invoice-form.mjs needs — no more. Company facts
    are not here because the document renders them at build time. */
const clientConfig = () => ({
    invoice: {
        numbering,
        netTerms: Object.fromEntries(netTerms.map((t) => [t.id, { label: t.label, days: t.days }])),
        defaultNetTerm: defaultNetTerm.id,
        tax
    },
    estimator: {
        tiers: Object.fromEntries(tiers.map((t) => [t.id, { name: t.name, rate: t.rate }])),
        defaultTier: defaultTier.id
    }
});

export const invoicePage = () => html`<!DOCTYPE html>
<html lang="en">
<head>
${invoiceHead()}
</head>
<body class="inv-body">

    <a href="#invoice-builder" class="skip-link">Skip to invoice builder</a>

    <header class="inv-topbar">
        <a class="inv-topbar__brand" href="/">
            <img src="${site.logo}" alt="" width="40" height="40">
            <span class="inv-topbar__name">${site.shortName} <span class="inv-topbar__sub">Invoicing</span></span>
        </a>
        <span class="inv-topbar__tag">Internal Tool — nothing leaves this browser</span>
    </header>

    <main class="inv-layout" id="invoice-builder">
${builder()}
        <section class="inv-preview" aria-label="Invoice document">
${invoiceDoc()}
        </section>
    </main>

    <script type="application/json" id="fps-config">
${json(clientConfig())}
    </script>

    <script type="module" src="js/invoice.mjs"></script>
</body>
</html>
`;
