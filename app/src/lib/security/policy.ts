/* ==========================================================================
   SESSION AND MFA POLICY — pure decisions
   The proxy asks these questions on every request. Keeping them pure makes
   the policy testable and the proxy small.
   ========================================================================== */

export const SESSION = {
    /** Sign out after this much inactivity. */
    idleMs: 8 * 60 * 60 * 1000,
    /** Sign out this long after sign-in regardless of activity. */
    absoluteMs: 72 * 60 * 60 * 1000
};

export type SessionMarks = { startedAt: number | null; lastSeenAt: number | null };

export type SessionVerdict = 'ok' | 'idle_expired' | 'absolute_expired' | 'fresh';

/** `fresh` means no marks yet (first request after sign-in): set them. */
export function evaluateSession(marks: SessionMarks, now: number): SessionVerdict {
    if (marks.startedAt === null || marks.lastSeenAt === null) return 'fresh';
    if (now - marks.startedAt > SESSION.absoluteMs) return 'absolute_expired';
    if (now - marks.lastSeenAt > SESSION.idleMs) return 'idle_expired';
    return 'ok';
}

export type MfaState = { role: string | null; hasVerifiedFactor: boolean; currentLevel: string | null; nextLevel: string | null };

export type MfaVerdict = 'ok' | 'challenge' | 'enroll';

/**
 * Staff must have a verified factor and a session at aal2. Clients and
 * officers are never asked for one. A staff member with a factor but an
 * aal1 session must complete the challenge; one without a factor must enroll.
 */
export function evaluateMfa(state: MfaState): MfaVerdict {
    const staff = state.role === 'owner' || state.role === 'staff';
    if (!staff) return 'ok';
    if (state.hasVerifiedFactor) {
        return state.currentLevel === 'aal2' ? 'ok' : 'challenge';
    }
    return 'enroll';
}

/** Paths a signed-in user may reach regardless of MFA state. */
export const MFA_EXEMPT_PATHS = ['/login/mfa', '/portal/security', '/auth/signout', '/auth/confirm'];

export const isMfaExempt = (path: string): boolean => MFA_EXEMPT_PATHS.some((p) => path === p || path.startsWith(`${p}/`));

/* ---------- Login rate limit ---------- */

export const LOGIN_LIMITS = {
    perIp: 10,
    perEmail: 5,
    windowSeconds: 15 * 60
};
