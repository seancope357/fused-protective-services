/* ==========================================================================
   SPEC-012 §4 — the first-session checklist on Today.

   Pure on purpose: the facts are counted in queries.ts, the card is drawn in
   portal/page.tsx, and the decision between them — which steps exist, where
   each one is done, when the card goes away — is proven by
   tests/getting-started.test.ts without a database.
   ========================================================================== */

export type StartFacts = { alertsSet: boolean; clients: number; quotesSent: number; jobs: number; invoicesSent: number };

export type StartStep = { id: 'alerts' | 'client' | 'quote' | 'job' | 'invoice'; label: string; href: string; done: boolean };

/** Always five steps, in the order the business actually runs: alerts first,
    because every later step can produce a message the owner needs to see. */
export function gettingStartedSteps(f: StartFacts): StartStep[] {
    return [
        { id: 'alerts', label: 'Set where alerts go', href: '/portal/settings', done: f.alertsSet },
        { id: 'client', label: 'Add your first client', href: '/portal/clients/new', done: f.clients > 0 },
        { id: 'quote', label: 'Send your first quote', href: '/portal/quotes/new', done: f.quotesSent > 0 },
        { id: 'job', label: 'Schedule your first job', href: '/portal/jobs/new', done: f.jobs > 0 },
        { id: 'invoice', label: 'Send your first invoice', href: '/portal/invoices', done: f.invoicesSent > 0 }
    ];
}

export const allDone = (steps: StartStep[]): boolean => steps.every((s) => s.done);
