import { describe, expect, it } from 'vitest';
import { evaluateSession, evaluateMfa, isMfaExempt, SESSION } from '@/lib/security/policy';
import { buildCsp } from '@/lib/supabase/proxy';

const H = 3600 * 1000;

describe('session lifetime policy', () => {
    const now = 1_000 * H;
    it('first request after sign-in is fresh', () => {
        expect(evaluateSession({ startedAt: null, lastSeenAt: null }, now)).toBe('fresh');
    });
    it('active sessions stay ok', () => {
        expect(evaluateSession({ startedAt: now - 10 * H, lastSeenAt: now - 1 * H }, now)).toBe('ok');
    });
    it('idle beyond 8 hours expires', () => {
        expect(evaluateSession({ startedAt: now - 10 * H, lastSeenAt: now - SESSION.idleMs - 1 }, now)).toBe('idle_expired');
    });
    it('absolute beyond 72 hours expires even when active', () => {
        expect(evaluateSession({ startedAt: now - SESSION.absoluteMs - 1, lastSeenAt: now - 1000 }, now)).toBe('absolute_expired');
    });
});

describe('MFA policy', () => {
    it('clients and officers are never challenged', () => {
        expect(evaluateMfa({ role: 'client', hasVerifiedFactor: false, currentLevel: 'aal1', nextLevel: null })).toBe('ok');
        expect(evaluateMfa({ role: 'officer', hasVerifiedFactor: true, currentLevel: 'aal1', nextLevel: null })).toBe('ok');
    });
    it('staff without a factor must enroll; with a factor at aal1 must challenge; at aal2 pass', () => {
        expect(evaluateMfa({ role: 'owner', hasVerifiedFactor: false, currentLevel: 'aal1', nextLevel: null })).toBe('enroll');
        expect(evaluateMfa({ role: 'staff', hasVerifiedFactor: true, currentLevel: 'aal1', nextLevel: 'aal2' })).toBe('challenge');
        expect(evaluateMfa({ role: 'owner', hasVerifiedFactor: true, currentLevel: 'aal2', nextLevel: 'aal2' })).toBe('ok');
    });
    it('exempt paths let an unenrolled or unchallenged staff user reach enrollment and the challenge', () => {
        expect(isMfaExempt('/portal/security')).toBe(true);
        expect(isMfaExempt('/login/mfa')).toBe(true);
        expect(isMfaExempt('/portal/invoices')).toBe(false);
        expect(isMfaExempt('/portal/securityx')).toBe(false);
    });
});

describe('content security policy', () => {
    it('is nonce-based with no unsafe script sources and no framing', () => {
        const csp = buildCsp('abc123');
        expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
        expect(csp).not.toMatch(/script-src[^;]*unsafe/);
        expect(csp).toContain("frame-ancestors 'none'");
        expect(csp).toContain("object-src 'none'");
        expect(csp).toContain("form-action 'self'");
    });
});
