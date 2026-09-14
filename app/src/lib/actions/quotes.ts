'use server';

import { redirect } from 'next/navigation';
import { requireStaff, requireClient } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { dispatch } from '@/lib/notifications';
import { appUrl, armedLevels, divisionByQuoteValue, invoiceDefaults, site } from '@/lib/shared';
import { computeTotals, lineCents, parseFloatSafe, parseIntSafe, formatMoney } from '@/lib/money';
import { requestIp, requestUserAgent } from '@/lib/http';
import { occurrences } from '@/lib/domain/schedule';
import { done, str, optStr, localToIso } from './util';
import { fmtDateTime } from '@/lib/format';
import type { Client, Proposal, Quote } from '@/lib/db/types';

function readQuote(fd: FormData) {
    const armed = str(fd, 'armed_level');
    const level = armedLevels.find((l) => l.id === armed) ?? armedLevels[1];
    const officers = Math.max(1, parseIntSafe(fd.get('officer_count'), 1));
    const hours = Math.max(0.5, parseFloatSafe(fd.get('hours'), 8));
    const rateCents = Math.round(parseFloatSafe(fd.get('bill_rate'), level.rateCents ? level.rateCents / 100 : 0) * 100);
    const taxRate = parseFloatSafe(fd.get('tax_rate_pct'), 0);
    const totals = computeTotals([{ amount_cents: lineCents(officers, hours, rateCents) }], taxRate);
    const division = divisionByQuoteValue(str(fd, 'division_quote_value'));
    return {
        client_id: str(fd, 'client_id'),
        site_id: optStr(fd, 'site_id'),
        division_quote_value: division?.quoteValue ?? str(fd, 'division_quote_value'),
        armed_level: level.id,
        officer_count: officers,
        hours,
        bill_rate_cents: rateCents,
        subtotal_cents: totals.subtotal_cents,
        tax_rate_pct: totals.tax_rate_pct,
        tax_cents: totals.tax_cents,
        total_cents: totals.total_cents,
        deposit_pct: Math.min(100, Math.max(0, parseFloatSafe(fd.get('deposit_pct'), 0))),
        starts_at: localToIso(str(fd, 'starts_at')),
        ends_at: localToIso(str(fd, 'ends_at')),
        valid_until: optStr(fd, 'valid_until', 10),
        notes: optStr(fd, 'notes', 4000)
    };
}

export async function createQuote(formData: FormData): Promise<void> {
    const session = await requireStaff();
    const row = readQuote(formData);
    if (!row.client_id) done('/portal/quotes/new', 'Choose a client first.', 'bad');
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from('quotes').insert({ ...row, created_by: session.userId }).select('id').single();
    if (error || !data) done('/portal/quotes/new', `Could not create quote: ${error?.message}`, 'bad');
    redirect(`/portal/quotes/${data.id}?msg=${encodeURIComponent('Quote created. Build the proposal below.')}&tone=good`);
}

export async function updateQuote(formData: FormData): Promise<void> {
    await requireStaff();
    const id = str(formData, 'id');
    const row = readQuote(formData);
    const supabase = await createSupabaseServerClient();
    const { data: current } = await supabase.from('quotes').select('status').eq('id', id).maybeSingle();
    if (!current || current.status !== 'draft') done(`/portal/quotes/${id}`, 'Only draft quotes can be edited. To revise it, mark it declined and start a new quote.', 'warn');
    const { error } = await supabase.from('quotes').update(row).eq('id', id);
    if (error) done(`/portal/quotes/${id}`, `Could not save: ${error.message}`, 'bad');
    done(`/portal/quotes/${id}`, `Quote saved — total ${formatMoney(row.total_cents)}.`);
}

const defaultScope = (q: Quote) => {
    const division = divisionByQuoteValue(q.division_quote_value);
    const level = armedLevels.find((l) => l.id === q.armed_level)?.label ?? q.armed_level;
    return `${site.name} will provide ${q.officer_count} ${level} officer${q.officer_count === 1 ? '' : 's'} for ${q.hours} hours of ${division?.heading ?? q.division_quote_value}.${q.starts_at ? ` Coverage begins ${fmtDateTime(q.starts_at)}${q.ends_at ? ` and ends ${fmtDateTime(q.ends_at)}` : ''}.` : ''} Officers arrive 30 minutes before the start time for loadout inspection and radio check. Post orders are agreed with the client before the first shift.`;
};

const defaultExclusions = 'Travel outside the Austin and San Antonio metro areas, overnight lodging, and additional officers or hours requested on site are billed at the contracted rate. Vehicle patrol units and K9 units are not included unless listed above.';

/** Creates or updates the client-facing document for a quote. */
export async function saveProposal(formData: FormData): Promise<void> {
    await requireStaff();
    const quoteId = str(formData, 'quote_id');
    const supabase = await createSupabaseServerClient();
    const { data: quote } = await supabase.from('quotes').select('*').eq('id', quoteId).maybeSingle();
    if (!quote) done('/portal/quotes', 'Quote not found.', 'bad');
    const row = {
        quote_id: quoteId,
        client_id: quote.client_id,
        title: str(formData, 'title', 200) || `Security detail proposal — ${quote.quote_number}`,
        scope: str(formData, 'scope', 8000) || defaultScope(quote as Quote),
        exclusions: optStr(formData, 'exclusions', 4000) ?? defaultExclusions,
        terms: str(formData, 'terms', 8000) || invoiceDefaults.terms
    };
    const { error } = await supabase.from('proposals').upsert(row, { onConflict: 'quote_id' });
    if (error) done(`/portal/quotes/${quoteId}`, `Could not save proposal: ${error.message}`, 'bad');
    done(`/portal/quotes/${quoteId}`, 'Proposal saved.');
}

/** Freezes the proposal, marks quote + proposal sent, emails the client a portal link. */
export async function sendProposal(formData: FormData): Promise<void> {
    await requireStaff();
    const quoteId = str(formData, 'quote_id');
    const supabase = await createSupabaseServerClient();
    const [{ data: quote }, { data: proposal }] = await Promise.all([
        supabase.from('quotes').select('*').eq('id', quoteId).maybeSingle(),
        supabase.from('proposals').select('*').eq('quote_id', quoteId).maybeSingle()
    ]);
    if (!quote || !proposal) done(`/portal/quotes/${quoteId}`, 'Save the proposal before sending it.', 'bad');
    if (quote.status !== 'draft' && quote.status !== 'sent') done(`/portal/quotes/${quoteId}`, `This quote is ${quote.status}.`, 'warn');
    const { data: client } = await supabase.from('clients').select('*').eq('id', quote.client_id).maybeSingle();
    if (!client?.billing_email) done(`/portal/quotes/${quoteId}`, 'The client has no billing email. Add one on the client record first.', 'bad');

    const now = new Date().toISOString();
    const snapshot = { quote, proposal: { title: proposal.title, scope: proposal.scope, exclusions: proposal.exclusions, terms: proposal.terms }, client: { name: client.name, contact: client.billing_contact_name, email: client.billing_email }, sent_at: now };
    await supabase.from('proposals').update({ status: 'sent', sent_at: now, snapshot }).eq('id', proposal.id);
    await supabase.from('quotes').update({ status: 'sent', sent_at: now }).eq('id', quoteId);
    if (quote.source_quote_id) await supabaseAdmin().from('client_quotes').update({ status: 'proposal_sent' }).eq('id', quote.source_quote_id);

    const summary = await dispatch('proposal_sent', { client: client as Client, quote: quote as Quote, proposal: proposal as Proposal, link: `${appUrl()}/client/proposals/${proposal.id}` }, { entityType: 'proposal', entityId: proposal.id });
    if (summary.sent === 0) done(`/portal/quotes/${quoteId}`, "Proposal marked sent, but the email didn't go out. Email may not be set up yet — the message log shows why.", 'warn');
    done(`/portal/quotes/${quoteId}`, `Proposal sent to ${client.billing_email}.`);
}

export async function setQuoteStatus(formData: FormData): Promise<void> {
    await requireStaff();
    const id = str(formData, 'id');
    const status = str(formData, 'status');
    if (!['declined', 'expired', 'draft'].includes(status)) done(`/portal/quotes/${id}`, 'Not a valid transition.', 'bad');
    const supabase = await createSupabaseServerClient();
    await supabase.from('quotes').update({ status, decided_at: status === 'draft' ? null : new Date().toISOString() }).eq('id', id);
    await supabase.from('proposals').update({ status }).eq('quote_id', id);
    done(`/portal/quotes/${id}`, `Quote marked ${status}.`);
}

/**
 * Client-side acceptance. Legally meaningful: typed name, timestamp, IP and
 * user agent recorded; the RLS policy only lets the owning client move a sent
 * proposal to accepted. A job is created and both parties get a copy.
 */
export async function acceptProposal(formData: FormData): Promise<void> {
    const session = await requireClient();
    const proposalId = str(formData, 'proposal_id');
    const name = str(formData, 'accepted_name', 200);
    const agreed = formData.get('agree') === 'on';
    if (!name || !agreed) done(`/client/proposals/${proposalId}`, 'Type your full name and tick the agreement box to accept.', 'bad');

    const supabase = await createSupabaseServerClient();
    const { data: proposal } = await supabase.from('proposals').select('*').eq('id', proposalId).maybeSingle();
    if (!proposal || proposal.status !== 'sent') done(`/client/proposals/${proposalId}`, 'This proposal is no longer open for acceptance.', 'warn');
    const [ip, ua] = await Promise.all([requestIp(), requestUserAgent()]);
    const acceptedAt = new Date().toISOString();
    const { error, data: updated } = await supabase.from('proposals')
        .update({ status: 'accepted', accepted_at: acceptedAt, accepted_name: name, accepted_ip: ip, accepted_user_agent: ua })
        .eq('id', proposalId).eq('client_id', session.clientId).eq('status', 'sent').select('id').maybeSingle();
    if (error || !updated) done(`/client/proposals/${proposalId}`, 'Acceptance was not recorded. Please try again or call dispatch.', 'bad');

    const admin = supabaseAdmin();
    const { data: quote } = await admin.from('quotes').update({ status: 'accepted', decided_at: acceptedAt }).eq('id', proposal.quote_id).select('*').single();
    if (quote?.source_quote_id) await admin.from('client_quotes').update({ status: 'dispatched' }).eq('id', quote.source_quote_id);
    const jobId = quote ? await createJobFromQuote(quote as Quote) : null;
    const { data: client } = await admin.from('clients').select('*').eq('id', session.clientId).maybeSingle();
    const accepted = { ...(proposal as Proposal), status: 'accepted' as const, accepted_at: acceptedAt, accepted_name: name, accepted_ip: ip };
    const base = appUrl();
    await dispatch('proposal_accepted', { client: client as Client, quote: quote as Quote, proposal: accepted, link: jobId ? `${base}/portal/jobs/${jobId}` : `${base}/portal/quotes/${proposal.quote_id}` }, { entityType: 'proposal', entityId: proposalId, idempotent: true });
    await dispatch('proposal_accepted_copy', { client: client as Client, quote: quote as Quote, proposal: accepted, link: `${base}/client/proposals/${proposalId}` }, { entityType: 'proposal', entityId: proposalId, idempotent: true });
    done(`/client/proposals/${proposalId}`, 'Accepted. A copy has been emailed to you and dispatch has been notified.');
}

export async function declineProposal(formData: FormData): Promise<void> {
    const session = await requireClient();
    const proposalId = str(formData, 'proposal_id');
    const reason = optStr(formData, 'reason', 1000);
    const supabase = await createSupabaseServerClient();
    const { data: updated } = await supabase.from('proposals')
        .update({ status: 'declined', declined_at: new Date().toISOString(), declined_reason: reason })
        .eq('id', proposalId).eq('client_id', session.clientId).eq('status', 'sent').select('quote_id').maybeSingle();
    if (!updated) done(`/client/proposals/${proposalId}`, 'This proposal is no longer open.', 'warn');
    await supabaseAdmin().from('quotes').update({ status: 'declined', decided_at: new Date().toISOString() }).eq('id', updated.quote_id);
    done(`/client/proposals/${proposalId}`, 'Declined. Dispatch will follow up if you would like a revised proposal.');
}

/** Materialises a job (and its shifts) from an accepted quote. Service role: runs inside client acceptance. */
export async function createJobFromQuote(quote: Quote): Promise<string | null> {
    const admin = supabaseAdmin();
    const { data: existing } = await admin.from('jobs').select('id').eq('quote_id', quote.id).maybeSingle();
    if (existing) return existing.id;
    const division = divisionByQuoteValue(quote.division_quote_value);
    const starts = quote.starts_at ?? new Date(Date.now() + 7 * 86400000).toISOString();
    const ends = quote.ends_at ?? new Date(new Date(starts).getTime() + quote.hours * 3600000).toISOString();
    const { data: job, error } = await admin.from('jobs').insert({
        client_id: quote.client_id,
        site_id: quote.site_id,
        quote_id: quote.id,
        division_quote_value: quote.division_quote_value,
        title: `${division?.heading ?? quote.division_quote_value} — ${quote.quote_number}`,
        starts_at: starts,
        ends_at: ends,
        arrival_window: 'Officers arrive 30 minutes before start',
        deposit_pct: quote.deposit_pct,
        status: 'scheduled'
    }).select('id').single();
    if (error || !job) {
        console.error('[jobs] create from quote failed:', error?.message);
        return null;
    }
    const shifts = occurrences(starts, ends, null, null).map((o) => ({
        job_id: job.id,
        starts_at: o.starts_at,
        ends_at: o.ends_at,
        officers_required: quote.officer_count,
        armed_level: quote.armed_level,
        bill_rate_cents: quote.bill_rate_cents
    }));
    await admin.from('shifts').insert(shifts);
    return job.id;
}
