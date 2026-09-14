/* ==========================================================================
   A quote's or job's site must belong to its client.

   The forms used to load sites only from ?client=, so choosing a client left
   the site list stale, and no action checked the pair: a quote for one client
   could carry another client's site — its address, access notes and tax rate
   would then flow into the brief and the invoice. The rule is one pure
   function so every action applies the same check with the same words.
   ========================================================================== */

import { describe, expect, it } from 'vitest';
import { siteClientProblem } from '@/lib/domain/sites';

describe('siteClientProblem', () => {
    it('accepts no site at all', () => {
        expect(siteClientProblem(null, 'client-a', undefined)).toBeNull();
    });

    it("accepts a site that belongs to the chosen client", () => {
        expect(siteClientProblem('site-1', 'client-a', { client_id: 'client-a' })).toBeNull();
    });

    it("refuses another client's site", () => {
        expect(siteClientProblem('site-1', 'client-a', { client_id: 'client-b' })).toMatch(/different client/i);
    });

    it('refuses a site that does not exist', () => {
        expect(siteClientProblem('site-missing', 'client-a', null)).toMatch(/no longer exists|not found/i);
    });

    it('refuses a site when no client is chosen', () => {
        expect(siteClientProblem('site-1', '', { client_id: 'client-a' })).toMatch(/client/i);
    });
});
