'use server';

import { requireStaff } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { divisionByQuoteValue, tiers, taxDefaults, armedPreferences } from '@/lib/shared';
import { computeTotals, lineCents } from '@/lib/money';
import { done, str } from './util';
import type { Lead, LeadStatus } from '@/lib/db/types';
import { redirect } from 'next/navigation';

const STATUSES: LeadStatus[] = ['new', 'contacted', 'audit_scheduled', 'proposal_sent', 'dispatched', 'closed_won', 'closed_lost'];

export async function updateLeadStatus(formData: FormData): Promise<void> {
    await requireStaff();
    const id = str(formData, 'id');
    const status = str(formData, 'status') as LeadStatus;
    if (!STATUSES.includes(status)) done(`/portal/leads/${id}`, 'Unknown status.', 'bad');
    const supabase = await createSupabaseServerClient();
    const patch: Record<string, unknown> = { status };
    if (status !== 'new') patch.first_response_at = new Date().toISOString();
    const { error } = await supabase.from('client_quotes').update(patch).eq('id', id);
    if (error) done(`/portal/leads/${id}`, `Could not update: ${error.message}`, 'bad');
    done(`/portal/leads/${id}`, `Lead marked ${status.replace('_', ' ')}.`);
}

/** Guess the armed level and rate from what the visitor asked for. */
function inferTier(lead: Lead) {
    const pref = lead.armed_preference;
    if (pref === armedPreferences.unarmed) return tiers.find((t) => t.id === 'level-2')!;
    if (/level iv|ppo|executive/i.test(lead.service_division)) return tiers.find((t) => t.id === 'level-4')!;
    return tiers.find((t) => t.id === 'level-3')!;
}

/**
 * One click: find or create the client from the lead's contact details,
 * open a draft quote pre-filled from the request, and mark the lead contacted.
 */
export async function convertLeadToQuote(formData: FormData): Promise<void> {
    const session = await requireStaff();
    const id = str(formData, 'id');
    const supabase = await createSupabaseServerClient();
    const { data: lead } = await supabase.from('client_quotes').select('*').eq('id', id).maybeSingle();
    if (!lead) done('/portal/leads', 'Lead not found.', 'bad');

    let clientId = lead.client_id as string | null;
    if (!clientId) {
        const email = (lead.email || '').toLowerCase();
        const { data: existing } = email ? await supabase.from('clients').select('id').ilike('billing_email', email).maybeSingle() : { data: null };
        if (existing) clientId = existing.id;
        else {
            const { data: created, error } = await supabase.from('clients').insert({
                kind: lead.company ? 'company' : 'individual',
                name: lead.company || lead.full_name,
                billing_contact_name: lead.full_name,
                billing_email: lead.email || null,
                billing_phone: lead.phone || null,
                source_quote_id: lead.id,
                sms_consent: Boolean(lead.sms_consent),
                sms_consent_at: lead.sms_consent_at
            }).select('id').single();
            if (error || !created) done(`/portal/leads/${id}`, `Could not create client: ${error?.message}`, 'bad');
            clientId = created.id;
        }
        await supabase.from('client_quotes').update({ client_id: clientId }).eq('id', id);
    }

    const division = divisionByQuoteValue(lead.service_division);
    const tier = inferTier(lead as Lead);
    const officers = 2;
    const hours = 8;
    const rateCents = Math.round(tier.rate * 100);
    const totals = computeTotals([{ amount_cents: lineCents(officers, hours, rateCents) }], taxDefaults.defaultRatePct);
    const { data: quote, error } = await supabase.from('quotes').insert({
        client_id: clientId,
        source_quote_id: lead.id,
        division_quote_value: division?.quoteValue ?? lead.service_division,
        armed_level: tier.id,
        officer_count: officers,
        hours,
        bill_rate_cents: rateCents,
        subtotal_cents: totals.subtotal_cents,
        tax_rate_pct: totals.tax_rate_pct,
        tax_cents: totals.tax_cents,
        total_cents: totals.total_cents,
        valid_until: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
        notes: [`From lead ${lead.ref_code}.`, `Location: ${lead.deployment_location}`, `Schedule: ${lead.schedule}`, lead.notes ? `Notes: ${lead.notes}` : ''].filter(Boolean).join('\n'),
        created_by: session.userId
    }).select('id').single();
    if (error || !quote) done(`/portal/leads/${id}`, `Could not create quote: ${error?.message}`, 'bad');

    await supabase.from('client_quotes').update({ status: 'contacted', first_response_at: lead.first_response_at ?? new Date().toISOString() }).eq('id', id);
    redirect(`/portal/quotes/${quote.id}?msg=${encodeURIComponent('Draft quote created from the lead. Check officers, hours and rate, then build the proposal.')}&tone=good`);
}

/** Marks a lead responded-to without changing the pipeline stage. */
export async function markLeadResponded(formData: FormData): Promise<void> {
    await requireStaff();
    const id = str(formData, 'id');
    await supabaseAdmin().from('client_quotes').update({ first_response_at: new Date().toISOString(), status: 'contacted' }).eq('id', id).eq('status', 'new');
    done(`/portal/leads/${id}`, 'Marked as responded.');
}
