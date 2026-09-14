import { PageHead } from '@/components/ui';
import { StatusFromSearch, type SearchStatus } from '@/components/status-from-search';
import { ClientFields } from '@/components/client-form';
import { createClient } from '@/lib/actions/clients';

export default async function NewClientPage({ searchParams }: { searchParams: Promise<SearchStatus> }) {
    return (
        <>
            {/* Submit lives in the page's action bar on phone and tablet, via the form attribute. */}
            <PageHead eyebrow="Accounts" title="New client" primary={<button type="submit" form="new-client" className="btn btn--gold">Create client</button>}>
                A company or person you work for. You can add their sites once the client is saved.
            </PageHead>
            <StatusFromSearch params={await searchParams} />
            <form id="new-client" action={createClient} className="card stack mt-4">
                <ClientFields />
                <div className="row"><button className="btn btn--gold" type="submit">Create client</button></div>
            </form>
        </>
    );
}
