import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHead, Badge, Empty, LinkButton } from '@/components/ui';
import { StatusFromSearch, type SearchStatus } from '@/components/status-from-search';
import { fmtDateTime } from '@/lib/format';
import { divisionByQuoteValue } from '@/lib/shared';
import type { Job } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

export default async function JobsPage({ searchParams }: { searchParams: Promise<SearchStatus & { show?: string }> }) {
    const params = await searchParams;
    const supabase = await createSupabaseServerClient();
    let query = supabase.from('jobs').select('*, clients(name)').order('starts_at', { ascending: params.show !== 'past' }).limit(200);
    query = params.show === 'past' ? query.in('status', ['completed', 'cancelled']) : query.in('status', ['scheduled', 'in_progress']);
    const { data } = await query;
    const jobs = (data ?? []) as (Job & { clients: { name: string } | null })[];
    return (
        <>
            <PageHead eyebrow="Operations" title="Jobs" actions={<><LinkButton href="/portal/jobs/calendar">Calendar</LinkButton><LinkButton href="/portal/jobs/new" variant="gold">New job</LinkButton></>}>
                An accepted proposal becomes a job automatically. Standing details carry a recurrence.
            </PageHead>
            <StatusFromSearch params={params} />
            <nav className="row mb-4 mt-4" aria-label="Filter"><Link href="/portal/jobs" className={`btn btn--sm ${params.show !== 'past' ? 'btn--gold' : 'btn--ghost'}`}>Upcoming</Link><Link href="/portal/jobs?show=past" className={`btn btn--sm ${params.show === 'past' ? 'btn--gold' : 'btn--ghost'}`}>Past</Link></nav>
            {jobs.length ? (
                <div className="card table-wrap">
                    <table>
                        <thead><tr><th>Starts</th><th>Job</th><th>Client</th><th>Division</th><th>Status</th><th>Brief</th></tr></thead>
                        <tbody>
                            {jobs.map((j) => (
                                <tr key={j.id} className="is-link">
                                    <td className="mono small">{fmtDateTime(j.starts_at)}</td>
                                    <td><Link href={`/portal/jobs/${j.id}`}>{j.title}</Link><div className="small muted">{j.job_number}</div></td>
                                    <td>{j.clients?.name ?? '—'}</td>
                                    <td className="small">{divisionByQuoteValue(j.division_quote_value)?.heading ?? j.division_quote_value}</td>
                                    <td><Badge status={j.status} /></td>
                                    <td className="small">{j.confirmed_at ? `sent ${fmtDateTime(j.confirmed_at)}` : <span style={{ color: '#fcd34d' }}>not sent</span>}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : <Empty>No {params.show === 'past' ? 'past' : 'upcoming'} jobs.</Empty>}
        </>
    );
}
