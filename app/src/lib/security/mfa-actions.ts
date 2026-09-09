'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth';
import { done, str } from '@/lib/actions/util';

export type MfaState = { error?: string; message?: string; qr?: string; secret?: string; factorId?: string };

const safeNext = (value: unknown): string => {
    const s = typeof value === 'string' ? value : '';
    return s.startsWith('/') && !s.startsWith('//') ? s : '/';
};

async function clearMfaCookie() {
    (await cookies()).delete('fps_mfa_ok');
}

/** Step 2 of sign-in: verify a TOTP code against the user's verified factor. */
export async function verifyMfaChallenge(_prev: MfaState, formData: FormData): Promise<MfaState> {
    const code = str(formData, 'code', 10).replace(/\s+/g, '');
    if (!/^\d{6}$/.test(code)) return { error: 'Enter the 6-digit code from your authenticator app.' };
    const supabase = await createSupabaseServerClient();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const factor = factors?.totp?.find((f) => f.status === 'verified');
    if (!factor) return { error: 'No authenticator is enrolled on this account.' };
    const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId: factor.id });
    if (cErr || !challenge) return { error: 'Could not start the verification. Try again.' };
    const { error } = await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.id, code });
    if (error) return { error: 'That code is not valid. Codes change every 30 seconds; try the current one.' };
    await clearMfaCookie();
    redirect(safeNext(formData.get('next')));
}

/** Enrollment step 1: mint a factor and return the QR code for the authenticator app. */
export async function startMfaEnrollment(_prev: MfaState, _formData: FormData): Promise<MfaState> {
    const session = await getSession();
    if (!session) redirect('/login');
    const supabase = await createSupabaseServerClient();
    /* Discard any unverified factors from an abandoned attempt. */
    const { data: factors } = await supabase.auth.mfa.listFactors();
    for (const f of factors?.totp ?? []) if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `FUSED portal — ${session.email}` });
    if (error || !data) return { error: `Could not start enrollment: ${error?.message ?? 'unknown error'}` };
    return { qr: data.totp.qr_code, secret: data.totp.secret, factorId: data.id };
}

/** Enrollment step 2: confirm the first code, which marks the factor verified and lifts the session to aal2. */
export async function confirmMfaEnrollment(_prev: MfaState, formData: FormData): Promise<MfaState> {
    const factorId = str(formData, 'factor_id', 80);
    const code = str(formData, 'code', 10).replace(/\s+/g, '');
    if (!factorId || !/^\d{6}$/.test(code)) return { error: 'Enter the 6-digit code shown in your authenticator app.', factorId };
    const supabase = await createSupabaseServerClient();
    const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId });
    if (cErr || !challenge) return { error: 'Could not verify. Start again.', factorId };
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
    if (error) return { error: 'That code did not match. Check the time on your phone and try the current code.', factorId };
    await clearMfaCookie();
    done('/portal/security', 'Two-factor authentication is on. You will be asked for a code at every sign-in.');
}

/** Removes the factor. Requires a current code so a stolen session cannot switch MFA off. */
export async function disableMfa(_prev: MfaState, formData: FormData): Promise<MfaState> {
    const code = str(formData, 'code', 10).replace(/\s+/g, '');
    const supabase = await createSupabaseServerClient();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const factor = factors?.totp?.find((f) => f.status === 'verified');
    if (!factor) return { error: 'No authenticator is enrolled.' };
    const { data: challenge } = await supabase.auth.mfa.challenge({ factorId: factor.id });
    const { error: vErr } = challenge ? await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.id, code }) : { error: new Error('no challenge') };
    if (vErr) return { error: 'Enter a current code to turn two-factor off.' };
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    if (error) return { error: `Could not remove the authenticator: ${error.message}` };
    await clearMfaCookie();
    done('/portal/security', 'Two-factor authentication is off. You will be asked to enroll again before using the portal.', 'warn');
}
