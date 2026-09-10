import Link from 'next/link';
import { recentActivity, entityHref } from '@/lib/domain/timeline';
import { PageHead, Empty } from '@/components/ui';
import { fmtDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function ActivityPage() {
    const events = await recentActivity();
    return (
        <>
            <PageHead eyebrow="Audit" title="Activity">Every change to clients, quotes, jobs, shifts, invoices, payments, reviews and settings, with who made it. Messages are in the message log.</PageHead>
            {events.length ? (
                <div className="card table-wrap mt-4">
                    <table>
                        <thead><tr><th>When</th><th>Who</th><th>What</th><th>Record</th></tr></thead>
                        <tbody>{events.map((e) => { const href = entityHref(e.entityType, e.recordId); return <tr key={e.id}><td className="mono small">{fmtDateTime(e.at)}</td><td className="small">{e.actor}</td><td>{e.summary}</td><td className="small">{href ? <Link href={href}>{e.entityType}</Link> : e.entityType}</td></tr>; })}</tbody>
                    </table>
                </div>
            ) : <Empty>No activity recorded yet.</Empty>}
        </>
    );
}
