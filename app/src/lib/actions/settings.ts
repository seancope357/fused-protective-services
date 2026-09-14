'use server';

import { requireStaff } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { newPasswordProblem } from '@/lib/security/policy';
import { done, str } from './util';

const KEYS = ['owner_name', 'owner_email', 'owner_phone', 'default_tax_rate_pct', 'default_net_term_id', 'default_deposit_pct', 'brief_arrival_window', 'proposal_terms'] as const;

/* Passwords are read as typed. `str()` trims, but sign-in does not, so a
   trimmed password with a leading or trailing space could never be used to
   sign in. Capped only so a pasted essay is not sent to the auth server. */
const secret = (fd: FormData, key: string): string => String(fd.get(key) ?? '').slice(0, 200);

/* GoTrue refusals, reworded for the person at the form. The raw message is
   developer phrasing and, for weak_password, lists rule names. */
function passwordError(code: string | undefined, fallback: string): string {
    if (code === 'same_password') return 'Choose a password different from the one you have now.';
    if (code === 'weak_password') return 'That password is too easy to guess. Try a longer one.';
    if (code === 'reauthentication_needed' || code === 'insufficient_aal') return 'For your security, sign out, sign in again, then set your password.';
    return `Could not change the password: ${fallback}`;
}

/** Key/value settings; the notification engine reads owner_email / owner_phone. */
export async function saveSettings(formData: FormData): Promise<void> {
    await requireStaff();
    const supabase = await createSupabaseServerClient();
    const rows = KEYS.map((key) => ({ key, value: str(formData, key, 4000), updated_at: new Date().toISOString() })).filter((r) => r.value !== '');
    const empty = KEYS.filter((key) => str(formData, key) === '');
    if (empty.length) await supabase.from('settings').delete().in('key', empty);
    if (rows.length) {
        const { error } = await supabase.from('settings').upsert(rows, { onConflict: 'key' });
        if (error) done('/portal/settings', `Could not save: ${error.message}`, 'bad');
    }
    done('/portal/settings', 'Settings saved.');
}

/** Lets the signed-in staff member change their own password. */
export async function changeOwnPassword(formData: FormData): Promise<void> {
    const session = await requireStaff();
    const password = secret(formData, 'password');
    const problem = newPasswordProblem(password, secret(formData, 'confirm'));
    if (problem) done('/portal/settings', problem, 'bad');
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) done('/portal/settings', passwordError(error.code, error.message), 'bad');
    /* Changing the password here also satisfies a first-sign-in flag. */
    if (session.mustChangePassword) {
        const { supabaseAdmin } = await import('@/lib/supabase/admin');
        await supabaseAdmin().auth.admin.updateUserById(session.userId, { app_metadata: { must_change_password: false } });
        await supabase.auth.refreshSession();
    }
    done('/portal/settings', 'Password changed.');
}

/**
 * First sign-in on a temporary password (SPEC-012 §4). The portal layout has
 * already sent this user here, after two-factor.
 *
 * Supabase rules that shape this, from the auth server's user update:
 *   - a user with a verified factor must hold an aal2 session to change a
 *     password. The proxy only lets an aal2 staff session into /portal, so it
 *     holds here;
 *   - with `secure_password_change` on, a session older than 24 hours must
 *     reauthenticate first. It is off in supabase/config.toml, and this page is
 *     reached minutes after sign-in, so a nonce is never needed. If a stale
 *     session does hit it, the user is told to sign in again.
 *
 * The flag is cleared with the service role because users cannot write their
 * own app_metadata — which is exactly why the flag lives there.
 */
export async function setInitialPassword(formData: FormData): Promise<void> {
    const session = await requireStaff();
    const password = secret(formData, 'password');
    const problem = newPasswordProblem(password, secret(formData, 'confirm'));
    if (problem) done('/portal/welcome', problem, 'bad');
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) done('/portal/welcome', passwordError(error.code, error.message), 'bad');
    const { supabaseAdmin } = await import('@/lib/supabase/admin');
    const { error: flagError } = await supabaseAdmin().auth.admin.updateUserById(session.userId, { app_metadata: { must_change_password: false } });
    /* The password is already changed. Retrying with a different one is safe
       and will clear the flag; the message says so rather than implying
       nothing happened. */
    if (flagError) done('/portal/welcome', 'Your new password is saved, but the portal could not finish setting up your account. Choose another new password and try once more.', 'bad');
    /* The proxy reads the flag from the session token, which still carries the
       old value. Refresh it; if that fails, a fresh sign-in issues a clean one
       rather than leaving the account bouncing between Today and this page. */
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
        await supabase.auth.signOut();
        done('/login', 'Your password is set. Sign in again with your new password.');
    }
    done('/portal', 'Your password is set. Welcome to the portal.');
}

/** Creates a staff account (email + password) — owner only. The account must
    set its own password after its first two-factor sign-in (SPEC-012 §4). */
export async function createStaffUser(formData: FormData): Promise<void> {
    const session = await requireStaff();
    if (session.role !== 'owner') done('/portal/settings', 'Only the owner can add staff.', 'bad');
    const email = str(formData, 'email', 254).toLowerCase();
    const password = secret(formData, 'password');
    const fullName = str(formData, 'full_name', 200);
    const role = str(formData, 'role') === 'owner' ? 'owner' : 'staff';
    if (!email || newPasswordProblem(password, password)) done('/portal/settings', 'Email and a password of at least 12 characters are required.', 'bad');
    const { supabaseAdmin } = await import('@/lib/supabase/admin');
    const { error } = await supabaseAdmin().auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role, full_name: fullName },
        app_metadata: { must_change_password: true }
    });
    if (error) done('/portal/settings', `Could not create the account: ${error.message}`, 'bad');
    done(
        '/portal/settings',
        `${role === 'owner' ? 'Owner' : 'Staff'} account created for ${email}. Give them the temporary password privately, in person or by phone. The first time they sign in they will set up an authenticator app and choose their own password.`
    );
}
