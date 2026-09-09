'use server';

import { requireStaff } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { done, str } from './util';

const KEYS = ['owner_name', 'owner_email', 'owner_phone', 'default_tax_rate_pct', 'default_net_term_id', 'default_deposit_pct', 'brief_arrival_window', 'proposal_terms'] as const;

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
    await requireStaff();
    const password = str(formData, 'password', 200);
    const confirm = str(formData, 'confirm', 200);
    if (password.length < 12) done('/portal/settings', 'Use at least 12 characters.', 'bad');
    if (password !== confirm) done('/portal/settings', 'The two passwords do not match.', 'bad');
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) done('/portal/settings', `Could not change the password: ${error.message}`, 'bad');
    done('/portal/settings', 'Password changed.');
}

/** Creates a staff account (email + password) — owner only. */
export async function createStaffUser(formData: FormData): Promise<void> {
    const session = await requireStaff();
    if (session.role !== 'owner') done('/portal/settings', 'Only the owner can add staff.', 'bad');
    const email = str(formData, 'email', 254).toLowerCase();
    const password = str(formData, 'password', 200);
    const fullName = str(formData, 'full_name', 200);
    const role = str(formData, 'role') === 'owner' ? 'owner' : 'staff';
    if (!email || password.length < 12) done('/portal/settings', 'Email and a password of at least 12 characters are required.', 'bad');
    const { supabaseAdmin } = await import('@/lib/supabase/admin');
    const { error } = await supabaseAdmin().auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { role, full_name: fullName } });
    if (error) done('/portal/settings', `Could not create the account: ${error.message}`, 'bad');
    done('/portal/settings', `${role === 'owner' ? 'Owner' : 'Staff'} account created for ${email}.`);
}
