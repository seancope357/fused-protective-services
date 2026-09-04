/* ==========================================================================
   INVOICING VOCABULARY
   Everything the invoice builder needs that is policy rather than markup:
   how numbers are formed, which payment terms exist, the tax default, and
   the boilerplate that prints on every document. Lives in data so repricing
   terms or rewording the remit block never touches a template or a script.

   NOTE FOR CAMERON: confirm the tax rate with your CPA — 8.25% is the Austin
   combined state/local sales tax rate, and security services are taxable in
   Texas. Set `defaultRatePct` to 0 if your invoices should start untaxed.
   ========================================================================== */

export const numbering = {
    prefix: 'FPS',
    /* Digits in the sequential part: FPS-2026-0001. */
    pad: 4
};

export const netTerms = [
    { id: 'due-on-receipt', label: 'Due on receipt', days: 0 },
    { id: 'net-7', label: 'Net 7', days: 7 },
    { id: 'net-15', label: 'Net 15', days: 15 },
    { id: 'net-30', label: 'Net 30', days: 30, default: true }
];

export const defaultNetTerm = netTerms.find((t) => t.default) ?? netTerms[0];

export const tax = {
    label: 'TX Sales Tax',
    defaultRatePct: 8.25
};

export const invoiceStatuses = [
    { id: 'draft', label: 'Draft' },
    { id: 'sent', label: 'Sent' },
    { id: 'paid', label: 'Paid' }
];

/* Printed in the document footer. The remit email derives from site.mjs at
   render time; only the wording lives here. */
export const paymentCopy = {
    heading: 'Payment',
    instructions:
        'Pay securely online via credit card or ACH using the link or QR code below. Remit physical checks payable to Fused Protective Services.'
};

export const defaultNotes =
    'Thank you for trusting Fused Protective Services with your protection detail.';

export const defaultTerms =
    'Payment is due by the date shown above. Past-due balances accrue interest at 1.5% per month or the maximum rate permitted by Texas law. Deployment hours are billed as scheduled; extensions requested on site are billed at the contracted rate.';
