/* ==========================================================================
   The one rule for a new password, shared by "Change my password" and the
   first-sign-in welcome page (SPEC-012), so the two can never disagree.
   ========================================================================== */

import { describe, expect, it } from 'vitest';
import { needsInitialPassword, newPasswordProblem } from '@/lib/security/policy';

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

/* The first-sign-in rule is enforced in the proxy, which runs on every request
   including client-side navigations; a layout does not re-render on those, so
   a layout-only check could be skipped by tapping a nav link. */
describe('needsInitialPassword', () => {
    const flagged = { must_change_password: true };

    it('sends a flagged account to the welcome page from any other portal page', () => {
        expect(needsInitialPassword(flagged, '/portal')).toBe(true);
        expect(needsInitialPassword(flagged, '/portal/leads')).toBe(true);
        expect(needsInitialPassword(flagged, '/portal/leads/abc')).toBe(true);
    });

    it('lets the welcome page itself render', () => {
        expect(needsInitialPassword(flagged, '/portal/welcome')).toBe(false);
    });

    it('never fights two-factor enrolment or sign-out (MFA-exempt paths)', () => {
        expect(needsInitialPassword(flagged, '/portal/security')).toBe(false);
        expect(needsInitialPassword(flagged, '/auth/signout')).toBe(false);
        expect(needsInitialPassword(flagged, '/login/mfa')).toBe(false);
    });

    it('does nothing for an account without the flag, or outside the portal', () => {
        expect(needsInitialPassword({}, '/portal')).toBe(false);
        expect(needsInitialPassword(undefined, '/portal')).toBe(false);
        expect(needsInitialPassword({ must_change_password: 'true' }, '/portal')).toBe(false);
        expect(needsInitialPassword(flagged, '/client')).toBe(false);
        expect(needsInitialPassword(flagged, '/')).toBe(false);
    });
});
