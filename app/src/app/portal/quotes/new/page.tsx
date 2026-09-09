import { listClients, listSites } from '@/lib/domain/queries';
import { PageHead } from '@/components/ui';
import { StatusFromSearch, type SearchStatus } from '@/components/status-from-search';
import { QuoteFields } from '@/components/quote-form';
import { createQuote } from '@/lib/actions/quotes';

export const dynamic = 'force-dynamic';

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<SearchStatus & { client?: string }> }) {
    const params = await searchParams;
    const clients = await listClients();
    const sites = params.client ? await listSites(params.client) : [];
    const client = clients.find((c) => c.id === params.client);
    return (
        <>
            <PageHead eyebrow="Sales" title="New quote">Totals are computed on save: officers × hours × rate, plus tax.</PageHead>
            <StatusFromSearch params={params} />
            <form action={createQuote} className="card stack mt-4">
                <QuoteFields clients={clients} sites={sites} clientId={params.client} defaultTaxRate={client?.tax_exempt ? 0 : client?.default_tax_rate_pct} />
                <div className="row"><button className="btn btn--gold" type="submit">Create draft quote</button></div>
            </form>
        </>
    );
}
