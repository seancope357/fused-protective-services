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

/* ---------- Passwords ----------
   One rule for a new password, shared by "Change my password" and the
   first-sign-in welcome page (SPEC-012), so the two can never disagree. */

/** Shortest password the portal accepts. Stricter than Supabase's own minimum,
    which is configured per project and cannot be relied on to match. */
export const MIN_PASSWORD_LENGTH = 12;

/** Why a new password is refused, in words for the person typing it, or null
    when it is acceptable. Never echoes the password. */
export function newPasswordProblem(password: string, confirm: string): string | null {
    if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    if (password !== confirm) return 'The two passwords do not match.';
    return null;
}

/* ---------- First sign-in ---------- */

/** True when an account still on a temporary password must be sent to
    /portal/welcome (SPEC-012). Enforced in the proxy, which runs on every
    request including client-side navigations — a shared layout does not
    re-render on those, so a layout-only check could be skipped by tapping a
    nav link. MFA-exempt paths are left alone so two-factor enrolment and
    sign-out always work. */
export function needsInitialPassword(appMetadata: Record<string, unknown> | null | undefined, path: string): boolean {
    if (appMetadata?.must_change_password !== true) return false;
    if (path !== '/portal' && !path.startsWith('/portal/')) return false;
    return path !== '/portal/welcome' && !isMfaExempt(path);
}
