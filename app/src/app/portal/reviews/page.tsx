import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHead, Badge, Empty } from '@/components/ui';
import { StatusFromSearch, type SearchStatus } from '@/components/status-from-search';
import { publishReview } from '@/lib/actions/reviews';
import { fmtDateTime } from '@/lib/format';
import type { Review } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<SearchStatus> }) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.from('reviews').select('*, jobs(title, job_number), clients(name)').order('requested_at', { ascending: false }).limit(200);
    const reviews = (data ?? []) as (Review & { jobs: { title: string; job_number: string } | null; clients: { name: string } | null })[];
    const published = reviews.filter((r) => r.published_at);
    const exportSnippet = published.map((r) => `    { author: ${JSON.stringify(r.author_name || r.clients?.name || 'Client')}, company: ${JSON.stringify(r.clients?.name ?? '')}, rating: ${r.rating}, text: ${JSON.stringify(r.body ?? '')}, date: ${JSON.stringify((r.submitted_at ?? '').slice(0, 10))} }`).join(',\n');
    return (
        <>
            <PageHead eyebrow="Reputation" title="Reviews">Requested a day after each completed job. Only reviews the client allowed can be published, and only published ones may back the site's rating.</PageHead>
            <StatusFromSearch params={await searchParams} />
            {reviews.length ? (
                <div className="card table-wrap mt-4">
                    <table>
                        <thead><tr><th>Job</th><th>Client</th><th>Rating</th><th>Review</th><th>Status</th><th /></tr></thead>
                        <tbody>{reviews.map((r) => <tr key={r.id}><td><Link href={`/portal/jobs/${r.job_id}`}>{r.jobs?.title ?? r.job_id}</Link></td><td>{r.clients?.name}</td><td>{r.rating ? `${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}` : '—'}</td><td className="small">{r.body ?? (r.status === 'requested' ? `requested ${fmtDateTime(r.requested_at)}` : '—')}{r.author_name ? <div className="muted">— {r.author_name}</div> : null}</td><td><Badge status={r.published_at ? 'paid' : r.status}>{r.published_at ? 'published' : r.status}</Badge>{r.status === 'submitted' ? <div className="small muted">{r.permission_to_publish ? 'may publish' : 'private'}</div> : null}</td><td>{r.status === 'submitted' && r.permission_to_publish ? <form action={publishReview}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="publish" value={r.published_at ? '0' : '1'} /><button className="btn btn--ghost btn--sm" type="submit">{r.published_at ? 'Unpublish' : 'Publish'}</button></form> : null}</td></tr>)}</tbody>
                    </table>
                </div>
            ) : <Empty>No reviews yet. They are requested automatically 24 hours after a job is completed.</Empty>}
            {published.length ? (
                <section className="card mt-4"><h2 className="mb-2">Export for the website</h2><p className="small">Paste into <span className="mono">src/data/reviews.mjs</span>, rebuild, and the schema.org rating appears with these {published.length} reviews behind it.</p><pre className="mono small mt-4" style={{ whiteSpace: 'pre-wrap' }}>{`export const reviews = [\n${exportSnippet}\n];`}</pre></section>
            ) : null}
        </>
    );
}
