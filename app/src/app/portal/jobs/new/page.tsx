import { listClients, listAllSites } from '@/lib/domain/queries';
import { PageHead } from '@/components/ui';
import { StatusFromSearch, type SearchStatus } from '@/components/status-from-search';
import { JobFields } from '@/components/job-form';
import { createJob } from '@/lib/actions/jobs';

export const dynamic = 'force-dynamic';

export default async function NewJobPage({ searchParams }: { searchParams: Promise<SearchStatus & { client?: string }> }) {
    const params = await searchParams;
    const clients = await listClients();
    const sites = await listAllSites();
    return (
        <>
            {/* The form is long, so its submit is the page's primary action: pinned
                under the thumb on phone and tablet, via the form attribute. */}
            <PageHead eyebrow="Operations" title="New job" primary={<button type="submit" form="new-job" className="btn btn--gold">Create job</button>}>
                For work that did not come through a proposal. Shifts are made from the first shift&apos;s times, repeated on the days you choose.
            </PageHead>
            <StatusFromSearch params={params} />
            <form id="new-job" action={createJob} className="card stack mt-4">
                <JobFields clients={clients} sites={sites} clientId={params.client} />
                <div className="row"><button className="btn btn--gold" type="submit">Create job</button></div>
            </form>
        </>
    );
}
