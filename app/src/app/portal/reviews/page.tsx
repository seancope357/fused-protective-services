import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHead, Badge, Empty, Disclosure } from '@/components/ui';
import { DataTable, type Column } from '@/components/data-table';
import { StatusFromSearch, type SearchStatus } from '@/components/status-from-search';
import { publishReview } from '@/lib/actions/reviews';
import { fmtDateTime } from '@/lib/format';
import type { Review } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

type Row = Review & { jobs: { title: string; job_number: string } | null; clients: { name: string } | null };

const reviewText = (r: Row) => (
    <>
        {r.body ?? (r.status === 'requested' ? `requested ${fmtDateTime(r.requested_at)}` : '—')}
        {r.author_name ? <div className="muted">— {r.author_name}</div> : null}
    </>
);

/* The job is the card title and opens the job. The review is prose, so its
   column is `wide`: left-aligned across the card on a phone. */
const columns: Column<Row>[] = [
    {
        key: 'job',
        header: 'Job',
        primary: true,
        cell: (r) => (
            <Link href={`/portal/jobs/${r.job_id}`}>{r.jobs?.title ?? r.job_id}</Link>
        )
    },
    { key: 'client', header: 'Client', cell: (r) => r.clients?.name ?? '—' },
    {
        key: 'rating',
        header: 'Rating',
        cell: (r) => (r.rating ? <span role="img" aria-label={`${r.rating} out of 5`}>{`${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}`}</span> : '—')
    },
    { key: 'review', header: 'Review', wide: true, cell: (r) => <div className="small wrap-anywhere">{reviewText(r)}</div> },
    {
        key: 'status',
        header: 'Status',
        cell: (r) => (
            <div>
                <Badge status={r.published_at ? 'paid' : r.status}>{r.published_at ? 'published' : r.status}</Badge>
                {r.status === 'submitted' ? <div className="small muted">{r.permission_to_publish ? 'may publish' : 'private'}</div> : null}
            </div>
        )
    },
    {
        key: 'actions',
        header: '',
        cell: (r) =>
            r.status === 'submitted' && r.permission_to_publish ? (
                <form action={publishReview}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="publish" value={r.published_at ? '0' : '1'} />
                    <button className="btn btn--ghost btn--sm" type="submit">{r.published_at ? 'Unpublish' : 'Publish'}</button>
                </form>
            ) : null
    }
];

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<SearchStatus> }) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.from('reviews').select('*, jobs(title, job_number), clients(name)').order('requested_at', { ascending: false }).limit(200);
    const reviews = (data ?? []) as Row[];
    const published = reviews.filter((r) => r.published_at);
    const exportSnippet = published.map((r) => `    { author: ${JSON.stringify(r.author_name || r.clients?.name || 'Client')}, company: ${JSON.stringify(r.clients?.name ?? '')}, rating: ${r.rating}, text: ${JSON.stringify(r.body ?? '')}, date: ${JSON.stringify((r.submitted_at ?? '').slice(0, 10))} }`).join(',\n');
    return (
        <>
            <PageHead eyebrow="Reputation" title="Reviews">
                Clients are asked for a review a day after each completed job. You can publish a review only when the client gave permission, and only published reviews count toward the rating on the website.
            </PageHead>
            <StatusFromSearch params={await searchParams} />
            {reviews.length ? (
                <DataTable caption="Reviews" columns={columns} rows={reviews} rowKey={(r) => r.id} />
            ) : <Empty>No reviews yet. Clients are asked automatically 24 hours after a job is completed.</Empty>}
            {published.length ? (
                /* The site reads reviews from a source file, so publishing to the
                   website is a code change Sean makes. Cameron's part is to send
                   this; the repo detail stays inside the collapsed disclosure. */
                <section className="card mt-4">
                    <Disclosure summary="For Sean: website snippet">
                        <p className="small">Send this to Sean to publish these reviews on the website.</p>
                        <p className="small muted mt-2">Technical detail: paste into <span className="mono">src/data/reviews.mjs</span> and rebuild; the schema.org rating then appears with these {published.length} reviews behind it.</p>
                        <pre className="mono small mt-4 wrap-anywhere pre-wrap">{`export const reviews = [\n${exportSnippet}\n];`}</pre>
                    </Disclosure>
                </section>
            ) : null}
        </>
    );
}
