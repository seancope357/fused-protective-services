/* ==========================================================================
   The one rule for a new password, shared by "Change my password" and the
   first-sign-in welcome page (SPEC-012), so the two can never disagree.
   ========================================================================== */

import { describe, expect, it } from 'vitest';
import { newPasswordProblem } from '@/lib/security/policy';

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
