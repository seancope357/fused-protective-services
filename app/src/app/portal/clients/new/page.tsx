import { PageHead } from '@/components/ui';
import { StatusFromSearch, type SearchStatus } from '@/components/status-from-search';
import { ClientFields } from '@/components/client-form';
import { createClient } from '@/lib/actions/clients';

export default async function NewClientPage({ searchParams }: { searchParams: Promise<SearchStatus> }) {
    return (
        <>
            <PageHead eyebrow="Accounts" title="New client" />
            <StatusFromSearch params={await searchParams} />
            <form action={createClient} className="card stack mt-4">
                <ClientFields />
                <div className="row"><button className="btn btn--gold" type="submit">Create client</button></div>
            </form>
        </>
    );
}
