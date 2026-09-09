'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendEmail, publicSender } from '@/lib/transports';
import { logNotification } from '@/lib/notifications/log';
import { appUrl, site, netTermById } from '@/lib/shared';
import { done, str, optStr, bool } from './util';

const clientSchema = z.object({
    kind: z.enum(['company', 'individual']),
    name: z.string().min(1).max(200),
    billing_contact_name: z.string().max(200).nullable(),
    billing_email: z.email().nullable(),
    billing_phone: z.string().max(40).nullable(),
    billing_address_line1: z.string().max(200).nullable(),
    billing_address_line2: z.string().max(200).nullable(),
    billing_city: z.string().max(100).nullable(),
    billing_state: z.string().max(2).nullable(),
    billing_postal_code: z.string().max(12).nullable(),
    default_net_term_id: z.string(),
    default_tax_rate_pct: z.number().min(0).max(100),
    tax_jurisdiction: z.string().max(120).nullable(),
    tax_exempt: z.boolean(),
    sms_consent: z.boolean(),
    notes: z.string().max(4000).nullable()
});

function readClient(fd: FormData) {
    return clientSchema.safeParse({
        kind: str(fd, 'kind') || 'company',
        name: str(fd, 'name', 200),
        billing_contact_name: optStr(fd, 'billing_contact_name', 200),
        billing_email: optStr(fd, 'billing_email', 254)?.toLowerCase() ?? null,
        billing_phone: optStr(fd, 'billing_phone', 40),
        billing_address_line1: optStr(fd, 'billing_address_line1', 200),
        billing_address_line2: optStr(fd, 'billing_address_line2', 200),
        billing_city: optStr(fd, 'billing_city', 100),
        billing_state: optStr(fd, 'billing_state', 2)?.toUpperCase() ?? 'TX',
        billing_postal_code: optStr(fd, 'billing_postal_code', 12),
        default_net_term_id: netTermById(str(fd, 'default_net_term_id')).id,
        default_tax_rate_pct: Number.parseFloat(str(fd, 'default_tax_rate_pct')) || 0,
        tax_jurisdiction: optStr(fd, 'tax_jurisdiction', 120),
        tax_exempt: bool(fd, 'tax_exempt'),
        sms_consent: bool(fd, 'sms_consent'),
        notes: optStr(fd, 'notes', 4000)
    });
}

export async function createClient(formData: FormData): Promise<void> {
    await requireStaff();
    const parsed = readClient(formData);
    if (!parsed.success) done('/portal/clients/new', 'Check the form: a name is required and the email must be valid.', 'bad');
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from('clients').insert({ ...parsed.data, sms_consent_at: parsed.data.sms_consent ? new Date().toISOString() : null }).select('id').single();
    if (error || !data) done('/portal/clients/new', `Could not save: ${error?.message}`, 'bad');
    redirect(`/portal/clients/${data.id}?msg=${encodeURIComponent('Client created.')}&tone=good`);
}

export async function updateClient(formData: FormData): Promise<void> {
    await requireStaff();
    const id = str(formData, 'id');
    const parsed = readClient(formData);
    if (!parsed.success) done(`/portal/clients/${id}`, 'Check the form: a name is required and the email must be valid.', 'bad');
    const supabase = await createSupabaseServerClient();
    const { data: before } = await supabase.from('clients').select('sms_consent').eq('id', id).maybeSingle();
    const consentChanged = before && before.sms_consent !== parsed.data.sms_consent;
    const { error } = await supabase.from('clients').update({
        ...parsed.data,
        ...(consentChanged ? { sms_consent_at: parsed.data.sms_consent ? new Date().toISOString() : null } : {})
    }).eq('id', id);
    if (error) done(`/portal/clients/${id}`, `Could not save: ${error.message}`, 'bad');
    done(`/portal/clients/${id}`, 'Client saved.');
}

export async function saveSite(formData: FormData): Promise<void> {
    await requireStaff();
    const clientId = str(formData, 'client_id');
    const id = optStr(formData, 'id');
    const name = str(formData, 'name', 200);
    if (!name) done(`/portal/clients/${clientId}`, 'A site needs a name.', 'bad');
    const taxRate = optStr(formData, 'tax_rate_pct');
    const row = {
        client_id: clientId,
        name,
        address_line1: optStr(formData, 'address_line1', 200),
        address_line2: optStr(formData, 'address_line2', 200),
        city: optStr(formData, 'city', 100),
        state: optStr(formData, 'state', 2)?.toUpperCase() ?? 'TX',
        postal_code: optStr(formData, 'postal_code', 12),
        onsite_contact_name: optStr(formData, 'onsite_contact_name', 200),
        onsite_contact_phone: optStr(formData, 'onsite_contact_phone', 40),
        access_notes: optStr(formData, 'access_notes', 4000),
        parking_notes: optStr(formData, 'parking_notes', 2000),
        gear_notes: optStr(formData, 'gear_notes', 2000),
        tax_rate_pct: taxRate ? Number.parseFloat(taxRate) : null
    };
    const supabase = await createSupabaseServerClient();
    const { error } = id ? await supabase.from('sites').update(row).eq('id', id) : await supabase.from('sites').insert(row);
    if (error) done(`/portal/clients/${clientId}`, `Could not save site: ${error.message}`, 'bad');
    done(`/portal/clients/${clientId}`, id ? 'Site saved.' : 'Site added.');
}

/**
 * Gives a client's billing contact portal access: creates (or finds) the auth
 * user scoped to this client and emails a first sign-in link through our
 * verified sender.
 */
export async function invitePortalUser(formData: FormData): Promise<void> {
    await requireStaff();
    const clientId = str(formData, 'client_id');
    const supabase = await createSupabaseServerClient();
    const { data: client } = await supabase.from('clients').select('*').eq('id', clientId).maybeSingle();
    if (!client) done('/portal/clients', 'Client not found.', 'bad');
    const email = (client.billing_email || '').toLowerCase();
    if (!email) done(`/portal/clients/${clientId}`, 'Add a billing email before inviting.', 'bad');
    const from = publicSender();
    if (!from) done(`/portal/clients/${clientId}`, 'DISPATCH_ALERT_FROM is not a verified sender; the invitation cannot be emailed yet.', 'bad');

    const admin = supabaseAdmin();
    const { data: existing } = await admin.from('profiles').select('id, role, client_id').eq('email', email).maybeSingle();
    if (existing && existing.role !== 'client') done(`/portal/clients/${clientId}`, 'That email belongs to a staff account.', 'bad');
    if (!existing) {
        const { error } = await admin.auth.admin.createUser({
            email,
            email_confirm: true,
            user_metadata: { role: 'client', client_id: clientId, full_name: client.billing_contact_name || client.name }
        });
        if (error) done(`/portal/clients/${clientId}`, `Could not create the portal user: ${error.message}`, 'bad');
    } else if (existing.client_id !== clientId) {
        await admin.from('profiles').update({ client_id: clientId }).eq('id', existing.id);
    }

    const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    if (linkError || !link?.properties?.hashed_token) done(`/portal/clients/${clientId}`, `Could not mint a sign-in link: ${linkError?.message}`, 'bad');
    const url = `${appUrl()}/auth/confirm?token_hash=${encodeURIComponent(link.properties.hashed_token)}&type=magiclink&next=/client`;
    const subject = `Your ${site.name} client portal`;
    const text = `${client.billing_contact_name || client.name},\n\nYour ${site.name} client portal is ready: proposals, detail briefs, invoices and payment in one place.\n\nSign in: ${url}\n\nThe link works once and expires in one hour. Request a fresh one any time at ${appUrl()}/login.\n\n${site.phone.display} · ${site.email}`;
    const result = await sendEmail({ from, to: email, subject, text, html: `<pre style="font-family:Outfit,system-ui,sans-serif;white-space:pre-wrap">${text.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]!)}</pre>` });
    await logNotification({ trigger: 'portal_invite', channel: 'email', recipient: email, recipientRole: 'client', entityType: 'client', entityId: clientId, subject, result });
    if (!result.ok) done(`/portal/clients/${clientId}`, 'The portal user exists but the invitation email failed to send. Check the notification log.', 'warn');
    done(`/portal/clients/${clientId}`, `Invitation sent to ${email}.`);
}
