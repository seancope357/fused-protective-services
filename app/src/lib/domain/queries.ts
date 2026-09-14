import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Candidate, Client, Invoice, Job, Lead, Payment, Proposal, Quote, Review, Shift, Site } from '@/lib/db/types';

/* Session-bound reads. RLS decides what comes back; these helpers only shape
   the queries. Every function returns null rather than throwing on a miss. */

export async function db() {
    return createSupabaseServerClient();
}

/* ---------- Leads, and the source_env scope every lead read inherits ----------

   `/api/intake` stamps each public submission with the deployment that made it
   (SPEC-002). Preview and local rows are real rows — they are how intake gets
   tested — but they are not leads, so nothing that counts, lists or chases a
   lead may see them unless a human asked for them explicitly. One scope type,
   one helper, used by the inbox, the dashboard and the nav counts alike. */

export type SourceEnvScope = 'production' | 'all';

/** Parses the `?env=` search param. Anything but an explicit `all` is production. */
export const sourceEnvScope = (value: string | null | undefined): SourceEnvScope =>
    value === 'all' ? 'all' : 'production';

export async function listLeads(
    { stage, scope = 'production', limit = 200 }: { stage?: string | null; scope?: SourceEnvScope; limit?: number } = {}
): Promise<Lead[]> {
    let query = (await db()).from('client_quotes').select('*');
    if (stage) query = query.eq('status', stage);
    if (scope === 'production') query = query.eq('source_env', 'production');
    const { data } = await query.order('created_at', { ascending: false }).limit(limit);
    return (data as Lead[]) ?? [];
}

/** Count for the nav badge. Production-only by default, or the badge counts test rows. */
export async function countLeads(
    { stage, scope = 'production' }: { stage?: string | null; scope?: SourceEnvScope } = {}
): Promise<number> {
    let query = (await db()).from('client_quotes').select('id', { count: 'exact', head: true });
    if (stage) query = query.eq('status', stage);
    if (scope === 'production') query = query.eq('source_env', 'production');
    const { count } = await query;
    return count ?? 0;
}

export async function getLead(id: string): Promise<Lead | null> {
    const { data } = await (await db()).from('client_quotes').select('*').eq('id', id).maybeSingle();
    return (data as Lead) ?? null;
}

/* ---------- Candidates, scoped exactly as leads are ----------

   `/careers` posts through the same `/api/intake` as the quote form, so a
   candidate row carries the same `source_env` stamp (SPEC-002) and inherits the
   same rule: an application filled in on a preview URL is a real row and a test
   artefact, never something that may appear in the recruiting pipeline Cameron
   works. Same scope type, same helper, same default as the Leads inbox — the
   list, the detail page and the nav badge all come through here so there is one
   place where that can be got wrong. */

export async function listCandidates(
    { stage, licenseLevel, positionId, scope = 'production', limit = 200 }:
        { stage?: string | null; licenseLevel?: string | null; positionId?: string | null; scope?: SourceEnvScope; limit?: number } = {}
): Promise<Candidate[]> {
    let query = (await db()).from('candidate_applications').select('*');
    if (stage) query = query.eq('vetting_stage', stage);
    if (licenseLevel) query = query.eq('license_level', licenseLevel);
    if (positionId) query = query.eq('position_id', positionId);
    if (scope === 'production') query = query.eq('source_env', 'production');
    const { data } = await query.order('created_at', { ascending: false }).limit(limit);
    return (data as Candidate[]) ?? [];
}

/** Count for the nav badge. Production-only by default, or the badge counts test rows. */
export async function countCandidates(
    { stage, scope = 'production' }: { stage?: string | null; scope?: SourceEnvScope } = {}
): Promise<number> {
    let query = (await db()).from('candidate_applications').select('id', { count: 'exact', head: true });
    if (stage) query = query.eq('vetting_stage', stage);
    if (scope === 'production') query = query.eq('source_env', 'production');
    const { count } = await query;
    return count ?? 0;
}

export async function getCandidate(id: string): Promise<Candidate | null> {
    const { data } = await (await db()).from('candidate_applications').select('*').eq('id', id).maybeSingle();
    return (data as Candidate) ?? null;
}

/** Staff who can be assigned a candidate. RLS already limits this to staff readers. */
export async function listStaffProfiles(): Promise<{ id: string; full_name: string | null; email: string | null }[]> {
    const { data } = await (await db()).from('profiles').select('id, full_name, email').in('role', ['owner', 'staff']).order('full_name');
    return data ?? [];
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

/* ---------- Getting started (SPEC-012 §4) ----------

   Head counts only: the checklist needs "has this ever happened", never the
   rows. Alerts count as set only when the owner has saved both an email and a
   phone in Settings — the environment fallbacks were set up by Sean at install
   and prove nothing about where Cameron wants to be woken up. "Sent" means past
   draft; a voided invoice is excluded because a draft can be voided unsent.
   Clients, quotes, jobs and invoices carry no source_env (only intake tables
   do, SPEC-002), so no production scope applies here. */
export async function gettingStartedFacts(): Promise<import('@/lib/domain/getting-started').StartFacts> {
    const supabase = await db();
    const head = { count: 'exact', head: true } as const;
    const [{ data: owner }, clients, quotes, jobs, invoices] = await Promise.all([
        supabase.from('settings').select('key, value').in('key', ['owner_email', 'owner_phone']),
        supabase.from('clients').select('id', head),
        supabase.from('quotes').select('id', head).in('status', ['sent', 'accepted', 'declined', 'expired']),
        supabase.from('jobs').select('id', head),
        supabase.from('invoices').select('id', head).in('status', ['sent', 'partially_paid', 'paid', 'overdue'])
    ]);
    const has = (key: string) => Boolean(String(owner?.find((r) => r.key === key)?.value ?? '').trim());
    return {
        alertsSet: has('owner_email') && has('owner_phone'),
        clients: clients.count ?? 0,
        quotesSent: quotes.count ?? 0,
        jobs: jobs.count ?? 0,
        invoicesSent: invoices.count ?? 0
    };
}
