import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHead, Badge, Empty, LinkButton, Chips } from '@/components/ui';
import { DataTable, type Column } from '@/components/data-table';
import { StatusFromSearch, type SearchStatus } from '@/components/status-from-search';
import { fmtDateTime } from '@/lib/format';
import { divisionByQuoteValue } from '@/lib/shared';
import type { Job } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

type JobRow = Job & { clients: { name: string } | null };

/* On a phone the job title is the card; start, client, status and whether the
   brief went out are what an operator checks before a shift. Division waits
   for a desktop. */
const columns: Column<JobRow>[] = [
    { key: 'starts', header: 'Starts', cell: (j) => <span className="mono small">{fmtDateTime(j.starts_at)}</span> },
    {
        key: 'job',
        header: 'Job',
        primary: true,
        cell: (j) => (
            <>
                <Link href={`/portal/jobs/${j.id}`}>{j.title}</Link>
                <div className="small muted">{j.job_number}</div>
            </>
        )
    },
    { key: 'client', header: 'Client', cell: (j) => j.clients?.name ?? '—' },
    { key: 'division', header: 'Division', hide: 'tablet', cell: (j) => <span className="small">{divisionByQuoteValue(j.division_quote_value)?.heading ?? j.division_quote_value}</span> },
    { key: 'status', header: 'Status', cell: (j) => <Badge status={j.status} /> },
    { key: 'brief', header: 'Brief', cell: (j) => <span className="small">{j.confirmed_at ? `Sent ${fmtDateTime(j.confirmed_at)}` : <span className="status-warn">Not sent</span>}</span> }
];

export default async function JobsPage({ searchParams }: { searchParams: Promise<SearchStatus & { show?: string }> }) {
    const params = await searchParams;
    const past = params.show === 'past';
    const supabase = await createSupabaseServerClient();
    let query = supabase.from('jobs').select('*, clients(name)').order('starts_at', { ascending: !past }).limit(200);
    query = past ? query.in('status', ['completed', 'cancelled']) : query.in('status', ['scheduled', 'in_progress']);
    const { data } = await query;
    const jobs = (data ?? []) as JobRow[];
    return (
        <>
            <PageHead
                eyebrow="Operations"
                title="Jobs"
                actions={<LinkButton href="/portal/jobs/calendar">Calendar</LinkButton>}
                primary={<Link href="/portal/jobs/new" className="btn btn--gold">New job</Link>}
            >
                Jobs from accepted proposals appear here on their own. A weekly detail is one job with a shift on every date it runs.
            </PageHead>
            <StatusFromSearch params={params} />
            <Chips
                label="Filter jobs"
                items={[
                    { href: '/portal/jobs', label: 'Upcoming', active: !past },
                    { href: '/portal/jobs?show=past', label: 'Past', active: past }
                ]}
            />
            {jobs.length ? (
                <DataTable caption={past ? 'Past jobs' : 'Upcoming jobs'} columns={columns} rows={jobs} rowKey={(j) => j.id} />
            ) : <Empty>No {past ? 'past' : 'upcoming'} jobs.</Empty>}
        </>
    );
}
