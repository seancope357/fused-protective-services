import { listClients, listAllSites } from '@/lib/domain/queries';
import { PageHead } from '@/components/ui';
import { StatusFromSearch, type SearchStatus } from '@/components/status-from-search';
import { QuoteFields } from '@/components/quote-form';
import { createQuote } from '@/lib/actions/quotes';

export const dynamic = 'force-dynamic';

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<SearchStatus & { client?: string }> }) {
    const params = await searchParams;
    const clients = await listClients();
    const sites = await listAllSites();
    const client = clients.find((c) => c.id === params.client);
    return (
        <>
            {/* The form is long, so its submit lives in the page head: pinned
                above the tab bar on a phone, reachable without scrolling. The
                in-form button stays for anyone who has just reached the end. */}
            <PageHead eyebrow="Sales" title="New quote" primary={<button type="submit" form="quote-new" className="btn btn--gold">Create draft quote</button>}>
                The total is worked out when you save: officers × hours × hourly rate, plus tax.
            </PageHead>
            <StatusFromSearch params={params} />
            <form id="quote-new" action={createQuote} className="card stack mt-4">
                <QuoteFields clients={clients} sites={sites} clientId={params.client} defaultTaxRate={client?.tax_exempt ? 0 : client?.default_tax_rate_pct} />
                <div className="row"><button className="btn btn--gold" type="submit">Create draft quote</button></div>
            </form>
        </>
    );
}
