import { notFound } from 'next/navigation';
import { requireClient } from '@/lib/auth';
import { getProposal, getQuote, getClient } from '@/lib/domain/queries';
import { PageHead, Field } from '@/components/ui';
import { StatusFromSearch, type SearchStatus } from '@/components/status-from-search';
import { ProposalPaper } from '@/components/proposal-paper';
import { acceptProposal, declineProposal } from '@/lib/actions/quotes';
import { PrintButton } from '@/components/print-button';

export const dynamic = 'force-dynamic';

export default async function ClientProposalPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchStatus> }) {
    const session = await requireClient();
    const { id } = await params;
    const proposal = await getProposal(id);
    if (!proposal) notFound();
    const [quote, client] = await Promise.all([getQuote(proposal.quote_id), getClient(session.clientId)]);
    if (!quote) notFound();

    const signature = proposal.status === 'sent' ? (
        <form action={acceptProposal} className="stack no-print" aria-labelledby="accept-h">
            <input type="hidden" name="proposal_id" value={proposal.id} />
            <h3 id="accept-h">Accept this proposal</h3>
            <p className="small">Typing your name below and submitting is a binding electronic signature. We record the time and the network address it came from, and email you a copy.</p>
            <Field id="accepted_name" label="Your full name"><input id="accepted_name" name="accepted_name" required autoComplete="name" /></Field>
            <div className="field field--check"><input id="agree" name="agree" type="checkbox" required /><label htmlFor="agree">I am authorised to accept on behalf of {client?.name ?? 'my organisation'} and agree to the scope, exclusions and terms above.</label></div>
            <div className="row"><button className="btn btn--gold" type="submit">Accept proposal</button></div>
        </form>
    ) : null;

    return (
        <>
            <PageHead eyebrow="Proposal" title={proposal.title} actions={<PrintButton />} />
            <StatusFromSearch params={await searchParams} />
            <div className="mt-4"><ProposalPaper proposal={proposal} quote={quote} client={client} signature={signature} /></div>
            {proposal.status === 'sent' ? (
                <details className="card mt-4 no-print"><summary style={{ cursor: 'pointer' }}>Decline instead</summary>
                    <form action={declineProposal} className="stack mt-4">
                        <input type="hidden" name="proposal_id" value={proposal.id} />
                        <Field id="reason" label="Anything we should know? (optional)"><textarea id="reason" name="reason" rows={3} /></Field>
                        <div className="row"><button className="btn btn--danger" type="submit">Decline proposal</button></div>
                    </form>
                </details>
            ) : null}
        </>
    );
}
