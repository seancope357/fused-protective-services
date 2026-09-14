/* ==========================================================================
   SPEC-012 §4 — Cameron's first session.

   Today shows a "Getting started" checklist until the business has done each
   thing once. The steps are derived from facts the dashboard already counts,
   so the order, the links and the "done" rule are pinned here: a step that
   links to the wrong screen, or ticks itself too early, is a dead end for a
   first-time owner on a phone.

   The password rule is shared by "Change my password" and the forced first
   sign-in change, so it is proven once here rather than in two actions.
   ========================================================================== */

import { describe, expect, it } from 'vitest';
import { allDone, gettingStartedSteps, newPasswordProblem, type StartFacts } from '@/lib/domain/getting-started';

const none: StartFacts = { alertsSet: false, clients: 0, quotesSent: 0, jobs: 0, invoicesSent: 0 };

describe('gettingStartedSteps', () => {
    it('lists five undone steps in order, each linking to where it is done', () => {
        const steps = gettingStartedSteps(none);
        expect(steps.map((s) => s.id)).toEqual(['alerts', 'client', 'quote', 'job', 'invoice']);
        expect(steps.map((s) => s.href)).toEqual(['/portal/settings', '/portal/clients/new', '/portal/quotes/new', '/portal/jobs/new', '/portal/invoices']);
        expect(steps.every((s) => !s.done)).toBe(true);
        expect(steps.every((s) => s.label.length > 0)).toBe(true);
        expect(allDone(steps)).toBe(false);
    });

    it('is all done once every fact is present', () => {
        expect(allDone(gettingStartedSteps({ alertsSet: true, clients: 2, quotesSent: 1, jobs: 3, invoicesSent: 1 }))).toBe(true);
    });

    it('ticks only the step whose fact is present', () => {
        const steps = gettingStartedSteps({ ...none, alertsSet: true });
        expect(steps.filter((s) => s.done).map((s) => s.id)).toEqual(['alerts']);
    });
});

describe('newPasswordProblem', () => {
    it('refuses fewer than 12 characters', () => {
        expect(newPasswordProblem('short', 'short')).toMatch(/12/);
    });

    it('refuses a confirmation that does not match', () => {
        expect(newPasswordProblem('correct horse battery', 'correct horse battary')).toMatch(/match/);
    });

    it('accepts 12+ matching characters', () => {
        expect(newPasswordProblem('twelve chars', 'twelve chars')).toBeNull();
    });
});
