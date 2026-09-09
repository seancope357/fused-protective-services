import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { evaluateSession, evaluateMfa, isMfaExempt, SESSION } from '@/lib/security/policy';

const PROTECTED = ['/portal', '/client', '/officer'];
const MARK_START = 'fps_session_start';
const MARK_SEEN = 'fps_last_seen';
const MFA_OK = 'fps_mfa_ok';
const MFA_OK_TTL_S = 10 * 60;

const isProtected = (path: string) => PROTECTED.some((p) => path === p || path.startsWith(`${p}/`));

/**
 * Runs on every request:
 *   1. refreshes the Supabase session cookie;
 *   2. enforces the session lifetime policy (idle and absolute);
 *   3. for signed-in users on protected paths, enforces MFA for staff;
 *   4. attaches a per-request CSP nonce.
 * Role checks beyond "signed in" stay in the area layouts.
 */
export async function updateSession(request: NextRequest) {
    const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64');
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-nonce', nonce);
    const csp = buildCsp(nonce);
    requestHeaders.set('content-security-policy', csp);

    let response = NextResponse.next({ request: { headers: requestHeaders } });
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        cookies: {
            getAll: () => request.cookies.getAll(),
            setAll: (toSet) => {
                for (const { name, value } of toSet) request.cookies.set(name, value);
                response = NextResponse.next({ request: { headers: requestHeaders } });
                for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
            }
        }
    });

    const { data: claimsData } = await supabase.auth.getClaims();
    const claims = claimsData?.claims ?? null;
    const path = request.nextUrl.pathname;
    const now = Date.now();

    if (!claims) {
        if (isProtected(path)) return redirect(request, '/login', { next: path });
        return finish(response, csp);
    }

    /* ---- Session lifetime ---- */
    const marks = {
        startedAt: numberCookie(request, MARK_START),
        lastSeenAt: numberCookie(request, MARK_SEEN)
    };
    const verdict = evaluateSession(marks, now);
    if (verdict === 'idle_expired' || verdict === 'absolute_expired') {
        await supabase.auth.signOut();
        const out = redirect(request, '/login', { reason: verdict, next: isProtected(path) ? path : undefined });
        for (const name of [MARK_START, MARK_SEEN, MFA_OK]) out.cookies.delete(name);
        return out;
    }
    const cookieOpts = { httpOnly: true, sameSite: 'lax' as const, secure: request.nextUrl.protocol === 'https:', path: '/' };
    if (verdict === 'fresh') response.cookies.set(MARK_START, String(now), { ...cookieOpts, maxAge: SESSION.absoluteMs / 1000 });
    response.cookies.set(MARK_SEEN, String(now), { ...cookieOpts, maxAge: SESSION.idleMs / 1000 });

    if (path === '/login') return redirect(request, '/');

    /* ---- MFA for staff ---- */
    if ((isProtected(path) || path === '/') && !isMfaExempt(path)) {
        const cached = request.cookies.get(MFA_OK)?.value;
        const aal = typeof claims.aal === 'string' ? claims.aal : 'aal1';
        if (cached !== aal) {
            const [{ data: profile }, { data: factors }] = await Promise.all([
                supabase.from('profiles').select('role').eq('id', String(claims.sub)).maybeSingle(),
                supabase.auth.mfa.listFactors()
            ]);
            const state = {
                role: profile?.role ?? null,
                hasVerifiedFactor: Boolean(factors?.totp?.some((f) => f.status === 'verified')),
                currentLevel: aal,
                nextLevel: null
            };
            const mfa = evaluateMfa(state);
            if (mfa === 'challenge') return redirect(request, '/login/mfa', { next: path });
            if (mfa === 'enroll') return redirect(request, '/portal/security', { enroll: '1' });
            response.cookies.set(MFA_OK, aal, { ...cookieOpts, maxAge: MFA_OK_TTL_S });
        }
    }

    return finish(response, csp);
}

function finish(response: NextResponse, csp: string) {
    response.headers.set('Content-Security-Policy', csp);
    return response;
}

function redirect(request: NextRequest, to: string, params: Record<string, string | undefined> = {}) {
    const url = request.nextUrl.clone();
    url.pathname = to;
    url.search = '';
    for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
    return NextResponse.redirect(url);
}

function numberCookie(request: NextRequest, name: string): number | null {
    const raw = request.cookies.get(name)?.value;
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) ? n : null;
}

/** Nonce-based CSP. Inline scripts Next emits carry the nonce; nothing else may run. */
export function buildCsp(nonce: string): string {
    const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    return [
        `default-src 'self'`,
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
        `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
        `font-src 'self' https://fonts.gstatic.com data:`,
        `img-src 'self' data: blob:`,
        `connect-src 'self' ${supabase} wss://${supabase.replace(/^https?:\/\//, '')}`,
        `frame-src https://checkout.stripe.com https://js.stripe.com`,
        `form-action 'self'`,
        `frame-ancestors 'none'`,
        `base-uri 'self'`,
        `object-src 'none'`,
        `upgrade-insecure-requests`
    ].join('; ');
}
