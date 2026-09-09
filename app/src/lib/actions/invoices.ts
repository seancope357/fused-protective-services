'use server';

import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { dispatch } from '@/lib/notifications';
import { appUrl, invoiceDefaults, invoiceNumbering, netTermById } from '@/lib/shared';
import { formatMoney, parseFloatSafe, type LineItem } from '@/lib/money';
import { linesFromShifts, settleLines, depositLine, balanceLines, parseLegacyRecord } from '@/lib/domain/invoicing';
import { addDaysYmd, todayYmd } from '@/lib/format';
import { done, str, optStr } from './util';
import type { Client, Invoice, Job, Shift } from '@/lib/db/types';

async function mintNumber(): Promise<string> {
    const { data, error } = await supabaseAdmin().rpc('next_invoice_number', { p_prefix: invoiceNumbering.prefix, p_pad: invoiceNumbering.pad });
    if (error || !data) throw new Error(`next_invoice_number: ${error?.message}`);
    return data as string;
}

function billTo(client: Client | null, fallback?: { name?: string; email?: string | null }) {
    const address = client
        ? [client.billing_address_line1, client.billing_address_line2, [client.billing_city, client.billing_state, client.billing_postal_code].filter(Boolean).join(' ')].filter(Boolean).join('\n')
        : null;
    return {
        client_name: client?.billing_contact_name || client?.name || fallback?.name || 'Client',
        client_company: client?.kind === 'company' ? client.name : null,
        client_email: client?.billing_email ?? fallback?.email ?? null,
        client_phone: client?.billing_phone ?? null,
        client_address: address || null
    };
}

/** Generates a draft invoice (standard, deposit or balance) from a job's shifts. */
export async function generateInvoiceFromJob(formData: FormData): Promise<void> {
    const session = await requireStaff();
    const jobId = str(formData, 'job_id');
    const kind = (str(formData, 'kind') || 'standard') as Invoice['kind'];
    const supabase = await createSupabaseServerClient();
    const [{ data: job }, { data: shifts }] = await Promise.all([
        supabase.from('jobs').select('*').eq('id', jobId).maybeSingle(),
        supabase.from('shifts').select('*').eq('job_id', jobId)
    ]);
    if (!job) done('/portal/jobs', 'Job not found.', 'bad');
    const { data: client } = await supabase.from('clients').select('*').eq('id', job.client_id).maybeSingle();
    const { data: site } = job.site_id ? await supabase.from('sites').select('tax_rate_pct').eq('id', job.site_id).maybeSingle() : { data: null };
    const taxRate = site?.tax_rate_pct ?? client?.default_tax_rate_pct ?? 0;
    const taxExempt = Boolean(client?.tax_exempt);

    const fullLines = linesFromShifts((shifts ?? []) as Shift[]);
    const full = settleLines(fullLines, taxRate, taxExempt);
    let lines: LineItem[];
    if (kind === 'deposit') {
        if (!(job.deposit_pct > 0)) done(`/portal/jobs/${jobId}`, 'Set a deposit percentage on the job first.', 'bad');
        lines = [depositLine(job.title, full.totals.total_cents, job.deposit_pct)];
    } else if (kind === 'balance') {
        const { data: deposit } = job.deposit_invoice_id ? await supabase.from('invoices').select('total_cents, status').eq('id', job.deposit_invoice_id).maybeSingle() : { data: null };
        lines = balanceLines(fullLines, deposit && deposit.status !== 'void' ? deposit.total_cents : 0, taxExempt ? 0 : taxRate);
    } else {
        lines = fullLines;
    }
    // Deposit lines already carry tax in the full total; tax the deposit at 0 to avoid double-taxing.
    const settled = settleLines(lines, kind === 'deposit' ? 0 : taxRate, taxExempt);
    if (settled.totals.total_cents <= 0 && kind !== 'balance') done(`/portal/jobs/${jobId}`, 'Nothing to invoice: the job has no billable shifts.', 'warn');

    const term = netTermById(client?.default_net_term_id);
    const issue = todayYmd();
    const number = await mintNumber();
    const { data: invoice, error } = await supabase.from('invoices').insert({
        invoice_number: number,
        client_id: job.client_id,
        job_id: jobId,
        kind,
        ...billTo(client as Client | null),
        issue_date: issue,
        due_date: addDaysYmd(issue, term.days),
        payment_terms: term.label,
        net_term_id: term.id,
        line_items: settled.lines,
        ...settled.totals,
        status: 'draft',
        notes: invoiceDefaults.notes,
        terms: invoiceDefaults.terms,
        created_by: session.userId
    }).select('id').single();
    if (error || !invoice) done(`/portal/jobs/${jobId}`, `Could not create invoice: ${error?.message}`, 'bad');
    if (kind === 'deposit') await supabase.from('jobs').update({ deposit_invoice_id: invoice.id }).eq('id', jobId);
    redirect(`/portal/invoices/${invoice.id}?msg=${encodeURIComponent(`${kind === 'standard' ? 'Invoice' : `${kind[0].toUpperCase()}${kind.slice(1)} invoice`} ${number} drafted from the job. Review the lines, then send.`)}&tone=good`);
}

export async function createBlankInvoice(formData: FormData): Promise<void> {
    const session = await requireStaff();
    const clientId = optStr(formData, 'client_id');
    const supabase = await createSupabaseServerClient();
    const { data: client } = clientId ? await supabase.from('clients').select('*').eq('id', clientId).maybeSingle() : { data: null };
    const term = netTermById(client?.default_net_term_id);
    const issue = todayYmd();
    const number = await mintNumber();
    const { data: invoice, error } = await supabase.from('invoices').insert({
        invoice_number: number,
        client_id: clientId,
        ...billTo(client as Client | null, { name: str(formData, 'client_name', 200) || undefined }),
        issue_date: issue,
        due_date: addDaysYmd(issue, term.days),
        payment_terms: term.label,
        net_term_id: term.id,
        line_items: [],
        subtotal_cents: 0, tax_rate_pct: client?.tax_exempt ? 0 : (client?.default_tax_rate_pct ?? 0), tax_cents: 0, total_cents: 0,
        status: 'draft',
        notes: invoiceDefaults.notes,
        terms: invoiceDefaults.terms,
        created_by: session.userId
    }).select('id').single();
    if (error || !invoice) done('/portal/invoices', `Could not create invoice: ${error?.message}`, 'bad');
    redirect(`/portal/invoices/${invoice.id}?msg=${encodeURIComponent(`Invoice ${number} created.`)}&tone=good`);
}

/** Saves edited lines and header fields on a draft invoice. */
export async function updateInvoice(formData: FormData): Promise<void> {
    await requireStaff();
    const id = str(formData, 'id');
    const supabase = await createSupabaseServerClient();
    const { data: current } = await supabase.from('invoices').select('status, client_id').eq('id', id).maybeSingle();
    if (!current) done('/portal/invoices', 'Invoice not found.', 'bad');
    if (current.status !== 'draft') done(`/portal/invoices/${id}`, 'Only drafts can be edited. Void it and issue a new one to change a sent invoice.', 'warn');

    const descs = formData.getAll('line_desc').map(String);
    const lines = descs.map((description, i) => ({
        description: description.trim().slice(0, 300) || 'Service',
        officers: parseFloatSafe(formData.getAll('line_officers')[i], 1),
        hours: parseFloatSafe(formData.getAll('line_hours')[i], 0),
        rate_cents: Math.round(parseFloatSafe(formData.getAll('line_rate')[i], 0) * 100),
        shift_id: String(formData.getAll('line_shift')[i] ?? '') || null
    })).filter((l) => l.description && (l.hours !== 0 || l.rate_cents !== 0));
    const settled = settleLines(lines, parseFloatSafe(formData.get('tax_rate_pct'), 0));
    const term = netTermById(str(formData, 'net_term_id'));
    const issue = str(formData, 'issue_date', 10) || todayYmd();
    const { error } = await supabase.from('invoices').update({
        client_name: str(formData, 'client_name', 200) || 'Client',
        client_company: optStr(formData, 'client_company', 200),
        client_email: optStr(formData, 'client_email', 254),
        client_phone: optStr(formData, 'client_phone', 40),
        client_address: optStr(formData, 'client_address', 500),
        issue_date: issue,
        due_date: str(formData, 'due_date', 10) || addDaysYmd(issue, term.days),
        payment_terms: term.label,
        net_term_id: term.id,
        line_items: settled.lines,
        ...settled.totals,
        notes: optStr(formData, 'notes', 2000),
        terms: optStr(formData, 'terms', 4000)
    }).eq('id', id);
    if (error) done(`/portal/invoices/${id}`, `Could not save: ${error.message}`, 'bad');
    done(`/portal/invoices/${id}`, `Saved — total ${formatMoney(settled.totals.total_cents)}.`);
}

/** Marks sent and emails the pay link. Re-sendable for reminders. */
export async function sendInvoice(formData: FormData): Promise<void> {
    await requireStaff();
    const id = str(formData, 'id');
    const supabase = await createSupabaseServerClient();
    const { data: invoice } = await supabase.from('invoices').select('*').eq('id', id).maybeSingle();
    if (!invoice) done('/portal/invoices', 'Invoice not found.', 'bad');
    if (['paid', 'void'].includes(invoice.status)) done(`/portal/invoices/${id}`, `This invoice is ${invoice.status}.`, 'warn');
    if (invoice.total_cents <= 0) done(`/portal/invoices/${id}`, 'Add at least one line before sending.', 'bad');
    if (!invoice.client_email) done(`/portal/invoices/${id}`, 'The invoice has no client email.', 'bad');
    const { data: client } = invoice.client_id ? await supabase.from('clients').select('*').eq('id', invoice.client_id).maybeSingle() : { data: null };
    if (invoice.status === 'draft') await supabase.from('invoices').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', id);
    const ctxClient = (client as Client | null) ?? ({ billing_email: invoice.client_email, billing_contact_name: invoice.client_name, name: invoice.client_company || invoice.client_name } as Client);
    const summary = await dispatch('invoice_sent', { client: ctxClient, invoice: { ...(invoice as Invoice), status: invoice.status === 'draft' ? 'sent' : invoice.status }, link: `${appUrl()}/pay/${invoice.pay_token}` }, { entityType: 'invoice', entityId: id });
    done(`/portal/invoices/${id}`, summary.sent ? `Invoice emailed to ${invoice.client_email} with a pay link.` : 'Invoice marked sent, but the email did not go out (check the notification log and sender configuration).', summary.sent ? 'good' : 'warn');
}

export async function voidInvoice(formData: FormData): Promise<void> {
    await requireStaff();
    const id = str(formData, 'id');
    const supabase = await createSupabaseServerClient();
    const { data: invoice } = await supabase.from('invoices').select('status, amount_paid_cents').eq('id', id).maybeSingle();
    if (!invoice) done('/portal/invoices', 'Invoice not found.', 'bad');
    if (invoice.amount_paid_cents > 0) done(`/portal/invoices/${id}`, 'A partially or fully paid invoice cannot be voided. Refund in Stripe first.', 'bad');
    await supabase.from('invoices').update({ status: 'void', voided_at: new Date().toISOString() }).eq('id', id);
    done(`/portal/invoices/${id}`, 'Invoice voided.');
}

/** Records a payment received outside Stripe (check, cash, wire). */
export async function recordManualPayment(formData: FormData): Promise<void> {
    await requireStaff();
    const id = str(formData, 'id');
    const amount = Math.round(parseFloatSafe(formData.get('amount'), 0) * 100);
    const method = str(formData, 'method', 40) || 'check';
    if (amount <= 0) done(`/portal/invoices/${id}`, 'Enter an amount.', 'bad');
    const admin = supabaseAdmin();
    const { data, error } = await admin.rpc('apply_stripe_payment_event', {
        p_event_id: `manual_${id}_${Date.now()}`,
        p_event_type: 'manual_payment',
        p_invoice_id: id,
        p_payment_intent_id: null,
        p_checkout_session_id: null,
        p_charge_id: null,
        p_amount_cents: amount,
        p_method: method,
        p_status: 'succeeded',
        p_failure_message: null,
        p_raw: { recorded_by: 'staff', note: optStr(formData, 'note', 500) }
    });
    if (error || !data?.applied) done(`/portal/invoices/${id}`, `Could not record payment: ${error?.message ?? data?.reason}`, 'bad');
    const { data: invoice } = await admin.from('invoices').select('*').eq('id', id).single();
    const { data: payment } = await admin.from('payments').select('*').eq('invoice_id', id).order('received_at', { ascending: false }).limit(1).single();
    const { data: client } = invoice.client_id ? await admin.from('clients').select('*').eq('id', invoice.client_id).maybeSingle() : { data: null };
    await dispatch('payment_receipt', { client: client as Client | null, invoice: invoice as Invoice, payment, link: `${appUrl()}/pay/${invoice.pay_token}` }, { entityType: 'invoice', entityId: id, idempotent: true, dedupeSuffix: payment.id });
    done(`/portal/invoices/${id}`, `Recorded ${formatMoney(amount)} by ${method}. Invoice is now ${String(data.invoice_status).replace('_', ' ')}.`);
}

/** Imports the JSON exported by the old browser invoice tool. Numbers are kept; the sequence is bumped past them. */
export async function importLegacyInvoices(formData: FormData): Promise<void> {
    const session = await requireStaff();
    let parsed: unknown;
    try {
        parsed = JSON.parse(str(formData, 'payload', 2_000_000));
    } catch {
        done('/portal/invoices/import', 'That is not valid JSON. Paste the export exactly as the old /invoice page produced it.', 'bad');
    }
    const records = Array.isArray(parsed) ? parsed : (parsed as { invoices?: unknown[] })?.invoices;
    if (!Array.isArray(records) || records.length === 0) done('/portal/invoices/import', 'No invoices found in that export.', 'bad');

    const admin = supabaseAdmin();
    const imported: string[] = [];
    const skipped: string[] = [];
    const failed: string[] = [];
    for (const raw of records) {
        let rec;
        try {
            rec = parseLegacyRecord(raw);
        } catch (err) {
            failed.push((err as Error).message);
            continue;
        }
        const { data: exists } = await admin.from('invoices').select('id').eq('invoice_number', rec.invoice_number).maybeSingle();
        if (exists) { skipped.push(rec.invoice_number); continue; }
        const { error } = await admin.from('invoices').insert({
            invoice_number: rec.invoice_number,
            kind: 'standard',
            client_name: rec.client_name,
            client_company: rec.client_company,
            client_email: rec.client_email,
            client_phone: rec.client_phone,
            client_address: rec.client_address,
            issue_date: rec.issue_date,
            due_date: rec.due_date,
            payment_terms: netTermById(rec.net_term_id).label,
            net_term_id: rec.net_term_id,
            line_items: rec.line_items,
            ...rec.totals,
            amount_paid_cents: rec.status === 'paid' ? rec.totals.total_cents : 0,
            paid_at: rec.status === 'paid' ? rec.issue_date : null,
            status: rec.status,
            sent_at: rec.status !== 'draft' ? rec.issue_date : null,
            notes: rec.notes,
            terms: rec.terms,
            legacy_source: rec.legacy_source,
            created_by: session.userId
        });
        if (error) { failed.push(`${rec.invoice_number}: ${error.message}`); continue; }
        await admin.rpc('reserve_invoice_sequence', { p_number: rec.invoice_number });
        imported.push(rec.invoice_number);
    }
    const summary = `Imported ${imported.length}${skipped.length ? `, skipped ${skipped.length} already present` : ''}${failed.length ? `, failed ${failed.length}: ${failed.join('; ')}` : ''}.`;
    done('/portal/invoices', summary, failed.length ? 'warn' : 'good');
}
