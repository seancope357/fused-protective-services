import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHead, Badge, Empty } from '@/components/ui';
import { fmtDateTime } from '@/lib/format';
import type { Job } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

export default async function ClientJobs() {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.from('jobs').select('*').order('starts_at', { ascending: false });
    const jobs = (data ?? []) as Job[];
    const now = Date.now();
    const upcoming = jobs.filter((j) => new Date(j.ends_at).getTime() >= now && j.status !== 'cancelled').reverse();
    const past = jobs.filter((j) => new Date(j.ends_at).getTime() < now || j.status === 'cancelled');
    const Table = ({ rows }: { rows: Job[] }) => rows.length ? <div className="card table-wrap"><table><thead><tr><th>Detail</th><th>When</th><th>Status</th></tr></thead><tbody>{rows.map((j) => <tr key={j.id}><td><Link href={`/client/jobs/${j.id}`}>{j.title}</Link></td><td className="small">{fmtDateTime(j.starts_at)}</td><td><Badge status={j.status} /></td></tr>)}</tbody></table></div> : <Empty>None.</Empty>;
    return (
        <>
            <PageHead eyebrow="Operations" title="Your details" />
            <h2 className="mb-2">Upcoming</h2><Table rows={upcoming} />
            <h2 className="mb-2 mt-6">Past</h2><Table rows={past} />
        </>
    );
}
