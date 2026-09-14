import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHead, Badge, Empty } from '@/components/ui';
import { DataTable, type Column } from '@/components/data-table';
import { fmtDateTime } from '@/lib/format';
import type { Job } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

const columns: Column<Job>[] = [
    { key: 'title', header: 'Detail', primary: true, cell: (j) => <Link href={`/client/jobs/${j.id}`}>{j.title}</Link> },
    { key: 'when', header: 'When', cell: (j) => <span className="small">{fmtDateTime(j.starts_at)}</span> },
    { key: 'status', header: 'Status', cell: (j) => <Badge status={j.status} /> }
];

export default async function ClientJobs() {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.from('jobs').select('*').order('starts_at', { ascending: false });
    const jobs = (data ?? []) as Job[];
    const now = Date.now();
    const upcoming = jobs.filter((j) => new Date(j.ends_at).getTime() >= now && j.status !== 'cancelled').reverse();
    const past = jobs.filter((j) => new Date(j.ends_at).getTime() < now || j.status === 'cancelled');
    return (
        <>
            <PageHead eyebrow="Operations" title="Your details">Open a detail for its brief: when and where, arrival, your on-site contact and anything to prepare.</PageHead>
            <section aria-labelledby="upcoming-h">
                <h2 id="upcoming-h" className="mb-2">Upcoming</h2>
                {upcoming.length ? <DataTable caption="Upcoming details" columns={columns} rows={upcoming} rowKey={(j) => j.id} /> : <Empty>Nothing scheduled right now.</Empty>}
            </section>
            <section aria-labelledby="past-h" className="mt-6">
                <h2 id="past-h" className="mb-2">Past</h2>
                {past.length ? <DataTable caption="Past details" columns={columns} rows={past} rowKey={(j) => j.id} /> : <Empty>No past details yet.</Empty>}
            </section>
        </>
    );
}
