import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getQuote, getProposalByQuote, getClient, listClients, listSites } from '@/lib/domain/queries';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHead, Badge, Money, Field } from '@/components/ui';
import { StatusFromSearch, type SearchStatus } from '@/components/status-from-search';
import { QuoteFields } from '@/components/quote-form';
import { updateQuote, saveProposal, sendProposal, setQuoteStatus } from '@/lib/actions/quotes';
import { fmtDateTime } from '@/lib/format';
import { invoiceDefaults } from '@/lib/shared';
import { ProposalPaper } from '@/components/proposal-paper';
import { timelineFor } from '@/lib/domain/timeline';
import { Timeline } from '@/components/timeline';

export const dynamic = 'force-dynamic';

export default async function QuotePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchStatus> }) {
    const { id } = await params;
    const quote = await getQuote(id);
    if (!quote) notFound();
    const [proposal, client, clients, sites] = await Promise.all([getProposalByQuote(id), getClient(quote.client_id), listClients(), listSites(quote.client_id)]);
    const supabase = await createSupabaseServerClient();
    const { data: job } = await supabase.from('jobs').select('id, job_number').eq('quote_id', id).maybeSingle();
    const editable = quote.status === 'draft';
    const events = await timelineFor({ entityType: 'quote', id, related: [...(proposal ? [{ entityType: 'proposal', id: proposal.id }] : []), ...(quote.source_quote_id ? [{ entityType: 'client_quote', id: quote.source_quote_id }] : [])] });

    return (
        <>
            <PageHead eyebrow={`Quote ${quote.quote_number}`} title={client?.name ?? 'Quote'}
                actions={
                    <>
                        {job ? <Link className="btn btn--gold" href={`/portal/jobs/${job.id}`}>Job {job.job_number}</Link> : null}
                        {proposal && (quote.status === 'draft' || quote.status === 'sent') ? (
                            <form action={sendProposal}><input type="hidden" name="quote_id" value={id} /><button className="btn btn--gold" type="submit">{quote.status === 'sent' ? 'Resend proposal' : 'Send proposal'}</button></form>
                        ) : null}
                        {quote.status === 'sent' ? (
                            <form action={setQuoteStatus}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="declined" /><button className="btn btn--danger" type="submit">Mark declined</button></form>
                        ) : null}
                    </>
                }>
                <Badge status={quote.status} /> · <Money cents={quote.total_cents} /> · {quote.sent_at ? `sent ${fmtDateTime(quote.sent_at)}` : `created ${fmtDateTime(quote.created_at)}`}
                {proposal?.accepted_at ? ` · accepted by ${proposal.accepted_name} on ${fmtDateTime(proposal.accepted_at)} from ${proposal.accepted_ip}` : ''}
            </PageHead>
            <StatusFromSearch params={await searchParams} />

            <div className="stack mt-4">
                <details className="card" open={editable}>
                    <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Quote details {editable ? '' : '(locked — sent quotes are not edited; mark declined and create a new one to revise)'}</summary>
                    <form action={updateQuote} className="stack mt-4">
                        <input type="hidden" name="id" value={id} />
                        <fieldset disabled={!editable} style={{ border: 0 }}>
                            <QuoteFields quote={quote} clients={clients} sites={sites} />
                        </fieldset>
                        <dl className="kv">
                            <dt>Subtotal</dt><dd><Money cents={quote.subtotal_cents} /></dd>
                            <dt>Tax ({quote.tax_rate_pct}%)</dt><dd><Money cents={quote.tax_cents} /></dd>
                            <dt>Total</dt><dd><strong><Money cents={quote.total_cents} /></strong></dd>
                        </dl>
                        {editable ? <div className="row"><button className="btn btn--gold" type="submit">Save quote</button></div> : null}
                    </form>
                </details>

                <section className="card" aria-labelledby="h-proposal">
                    <h2 id="h-proposal" className="mb-4">Proposal (what the client sees)</h2>
                    {editable || quote.status === 'sent' ? (
                        <form action={saveProposal} className="stack">
                            <input type="hidden" name="quote_id" value={id} />
                            <Field id="title" label="Title"><input id="title" name="title" defaultValue={proposal?.title ?? `Security detail proposal — ${quote.quote_number}`} /></Field>
                            <Field id="scope" label="Scope of services" hint="Leave blank to generate from the quote."><textarea id="scope" name="scope" rows={6} defaultValue={proposal?.scope ?? ''} /></Field>
                            <Field id="exclusions" label="Exclusions"><textarea id="exclusions" name="exclusions" rows={3} defaultValue={proposal?.exclusions ?? ''} /></Field>
                            <Field id="terms" label="Terms"><textarea id="terms" name="terms" rows={4} defaultValue={proposal?.terms ?? invoiceDefaults.terms} /></Field>
                            <div className="row"><button className="btn btn--ghost" type="submit">{proposal ? 'Save proposal' : 'Build proposal'}</button></div>
                        </form>
                    ) : null}
                    {proposal ? (
                        <div className="mt-6">
                            <ProposalPaper proposal={proposal} quote={quote} client={client} />
                        </div>
                    ) : null}
                </section>
                <Timeline events={events} />
            </div>
        </>
    );
}
