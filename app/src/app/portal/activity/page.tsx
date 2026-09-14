import Link from 'next/link';
import { recentActivity, entityHref } from '@/lib/domain/timeline';
import { PageHead, Empty } from '@/components/ui';
import { DataTable, type Column } from '@/components/data-table';
import { fmtDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

type Activity = Awaited<ReturnType<typeof recentActivity>>[number];

/* The summary is the card title and carries the link to the record, so the
   whole card opens it on a phone. Rows whose record has no page (an entity
   entityHref does not know) stay plain text. */
const columns: Column<Activity>[] = [
    { key: 'when', header: 'When', cell: (e) => <span className="mono small">{fmtDateTime(e.at)}</span> },
    { key: 'who', header: 'Who', cell: (e) => <span className="small">{e.actor}</span> },
    {
        key: 'what',
        header: 'What',
        primary: true,
        cell: (e) => {
            const href = entityHref(e.entityType, e.recordId, e.parentId);
            return <span className="wrap-anywhere">{href ? <Link href={href}>{e.summary}</Link> : e.summary}</span>;
        }
    },
    { key: 'record', header: 'Record', hide: 'phone', cell: (e) => <span className="small">{e.entityType.replace(/_/g, ' ')}</span> }
];

export default async function ActivityPage() {
    const events = await recentActivity();
    return (
        <>
            <PageHead eyebrow="Audit" title="Activity">Every change to clients, quotes, jobs, shifts, invoices, payments, reviews and settings, and who made it. Emails and texts are in the message log.</PageHead>
            {events.length ? (
                <DataTable caption="Activity" columns={columns} rows={events} rowKey={(e) => e.id} />
            ) : <Empty>No activity recorded yet.</Empty>}
        </>
    );
}
