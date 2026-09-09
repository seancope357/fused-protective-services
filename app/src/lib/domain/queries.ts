import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Client, Invoice, Job, Lead, Payment, Proposal, Quote, Review, Shift, Site } from '@/lib/db/types';

/* Session-bound reads. RLS decides what comes back; these helpers only shape
   the queries. Every function returns null rather than throwing on a miss. */

export async function db() {
    return createSupabaseServerClient();
}

export async function getLead(id: string): Promise<Lead | null> {
    const { data } = await (await db()).from('client_quotes').select('*').eq('id', id).maybeSingle();
    return (data as Lead) ?? null;
}

export async function getClient(id: string): Promise<Client | null> {
    const { data } = await (await db()).from('clients').select('*').eq('id', id).maybeSingle();
    return (data as Client) ?? null;
}

export async function listClients(): Promise<Client[]> {
    const { data } = await (await db()).from('clients').select('*').order('name');
    return (data as Client[]) ?? [];
}

export async function listSites(clientId: string): Promise<Site[]> {
    const { data } = await (await db()).from('sites').select('*').eq('client_id', clientId).order('name');
    return (data as Site[]) ?? [];
}

export async function getSite(id: string | null): Promise<Site | null> {
    if (!id) return null;
    const { data } = await (await db()).from('sites').select('*').eq('id', id).maybeSingle();
    return (data as Site) ?? null;
}

export async function getQuote(id: string): Promise<Quote | null> {
    const { data } = await (await db()).from('quotes').select('*').eq('id', id).maybeSingle();
    return (data as Quote) ?? null;
}

export async function getProposalByQuote(quoteId: string): Promise<Proposal | null> {
    const { data } = await (await db()).from('proposals').select('*').eq('quote_id', quoteId).maybeSingle();
    return (data as Proposal) ?? null;
}

export async function getProposal(id: string): Promise<Proposal | null> {
    const { data } = await (await db()).from('proposals').select('*').eq('id', id).maybeSingle();
    return (data as Proposal) ?? null;
}

export async function getJob(id: string): Promise<Job | null> {
    const { data } = await (await db()).from('jobs').select('*').eq('id', id).maybeSingle();
    return (data as Job) ?? null;
}

export async function listShifts(jobId: string): Promise<Shift[]> {
    const { data } = await (await db()).from('shifts').select('*').eq('job_id', jobId).order('starts_at');
    return (data as Shift[]) ?? [];
}

export async function getInvoice(id: string): Promise<Invoice | null> {
    const { data } = await (await db()).from('invoices').select('*').eq('id', id).maybeSingle();
    return (data as Invoice) ?? null;
}

export async function listPayments(invoiceId: string): Promise<Payment[]> {
    const { data } = await (await db()).from('payments').select('*').eq('invoice_id', invoiceId).order('received_at', { ascending: false });
    return (data as Payment[]) ?? [];
}

export async function listInvoicesForJob(jobId: string): Promise<Invoice[]> {
    const { data } = await (await db()).from('invoices').select('*').eq('job_id', jobId).order('created_at');
    return (data as Invoice[]) ?? [];
}

export async function getReviewByJob(jobId: string): Promise<Review | null> {
    const { data } = await (await db()).from('reviews').select('*').eq('job_id', jobId).maybeSingle();
    return (data as Review) ?? null;
}

export async function getSettings(): Promise<Record<string, unknown>> {
    const { data } = await (await db()).from('settings').select('key, value');
    return Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
}
