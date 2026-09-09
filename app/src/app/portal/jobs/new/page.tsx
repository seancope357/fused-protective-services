import { listClients, listSites } from '@/lib/domain/queries';
import { PageHead } from '@/components/ui';
import { StatusFromSearch, type SearchStatus } from '@/components/status-from-search';
import { JobFields } from '@/components/job-form';
import { createJob } from '@/lib/actions/jobs';

export const dynamic = 'force-dynamic';

export default async function NewJobPage({ searchParams }: { searchParams: Promise<SearchStatus & { client?: string }> }) {
    const params = await searchParams;
    const clients = await listClients();
    const sites = params.client ? await listSites(params.client) : [];
    return (
        <>
            <PageHead eyebrow="Operations" title="New job">For work that did not come through a proposal. Shifts are generated from the first window and the recurrence.</PageHead>
            <StatusFromSearch params={params} />
            <form action={createJob} className="card stack mt-4">
                <JobFields clients={clients} sites={sites} clientId={params.client} />
                <div className="row"><button className="btn btn--gold" type="submit">Create job</button></div>
            </form>
        </>
    );
}
