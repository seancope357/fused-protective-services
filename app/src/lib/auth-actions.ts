'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendEmail, publicSender } from '@/lib/transports';
import { appUrl, site } from '@/lib/shared';
import { logNotification } from '@/lib/notifications/log';
import { loginAllowed } from '@/lib/security/login-gate';
import { requestIp } from '@/lib/http';

export type AuthState = { error?: string; message?: string };

const safeNext = (value: unknown): string => {
    const s = typeof value === 'string' ? value : '';
    return s.startsWith('/') && !s.startsWith('//') ? s : '/';
};

/** Owner and staff: email + password. */
export async function signInWithPassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
    const parsed = z.object({ email: z.email(), password: z.string().min(1) }).safeParse({
        email: formData.get('email'),
        password: formData.get('password')
    });
    if (!parsed.success) return { error: 'Enter your email and password.' };
    if (!(await loginAllowed(await requestIp(), parsed.data.email))) {
        return { error: 'Too many sign-in attempts. Wait 15 minutes and try again.' };
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) return { error: 'That email and password do not match.' };
    /* Staff with an authenticator go to the challenge; the proxy enforces the
       rest, this only makes the first hop direct. */
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const next = safeNext(formData.get('next'));
    if (factors?.totp?.some((f) => f.status === 'verified')) redirect(`/login/mfa?next=${encodeURIComponent(next)}`);
    redirect(next);
}

/**
 * Clients and officers: a magic link, minted server-side and sent through our
 * own verified sender so the email is branded and deliverable to anyone. The
 * response never reveals whether the address has an account.
 */
export async function requestMagicLink(_prev: AuthState, formData: FormData): Promise<AuthState> {
    const parsed = z.object({ email: z.email() }).safeParse({ email: String(formData.get('email') || '').trim().toLowerCase() });
    const generic = { message: 'If that address has portal access, a sign-in link is on its way. It expires in one hour.' };
    if (!parsed.success) return { error: 'Enter a valid email address.' };
    if (!(await loginAllowed(await requestIp(), parsed.data.email))) return { error: 'Too many requests. Wait 15 minutes and try again.' };

    const from = publicSender();
    if (!from) {
        console.error('[auth] DISPATCH_ALERT_FROM is not a verified sender; magic links cannot be delivered.');
        return { error: 'Sign-in email is not configured yet. Please contact dispatch.' };
    }

    const admin = supabaseAdmin();
    /* Any profile may sign in by link — staff included, so the owner can get in
       from a phone without a password. Unknown addresses get the same reply. */
    const { data: profile } = await admin.from('profiles').select('id, role').eq('email', parsed.data.email).maybeSingle();
    if (!profile) return generic;

    const next = safeNext(formData.get('next'));
    const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: parsed.data.email });
    if (error || !data?.properties?.hashed_token) {
        console.error('[auth] generateLink failed:', error);
        return generic;
    }

    const link = `${appUrl()}/auth/confirm?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=magiclink&next=${encodeURIComponent(next)}`;
    const subject = `Your ${site.shortName} portal sign-in link`;
    const text = `Use this link to sign in to the ${site.name} portal:\n\n${link}\n\nIt expires in one hour and works once. If you did not request it, ignore this email.\n\n${site.phone.display} · ${site.email}`;
    const html = `<div style="font-family:Outfit,system-ui,sans-serif;background:#090a09;color:#f5f5f4;padding:32px 16px"><div style="max-width:520px;margin:0 auto;background:#111211;border:1px solid rgba(186,152,87,0.35);border-radius:14px;padding:28px"><p style="margin:0 0 6px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#c6a25c;font-weight:800">${site.name}</p><h1 style="margin:0 0 14px;font-size:20px;color:#fff">Sign in to your portal</h1><p style="margin:0 0 20px;color:#a8a29e;font-size:15px;line-height:1.6">This link expires in one hour and works once.</p><p style="margin:0 0 20px"><a href="${link}" style="display:inline-block;background:#c6a25c;color:#050504;font-weight:800;padding:12px 22px;border-radius:8px;text-decoration:none">Open the portal</a></p><p style="margin:0;font-size:12px;color:#78716c">If you did not request this, ignore this email.</p></div></div>`;

    const result = await sendEmail({ from, to: parsed.data.email, subject, text, html });
    await logNotification({
        trigger: 'auth_magic_link',
        channel: 'email',
        recipient: parsed.data.email,
        recipientRole: profile.role === 'officer' ? 'officer' : profile.role === 'client' ? 'client' : 'owner',
        subject,
        result
    });
    if (!result.ok) return { error: 'We could not send the sign-in email right now. Please try again or call dispatch.' };
    return generic;
}

export async function signOut(): Promise<void> {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    redirect('/login');
}
