import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHead, Badge, Empty } from '@/components/ui';
import { DataTable, type Column } from '@/components/data-table';
import { fmtDateTime } from '@/lib/format';
import type { NotificationRow } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

/* A message has no page of its own, so the primary cell is plain text: the
   subject, or for a text message (which has none) what kind of message it was.
   Recipients and provider errors are unbroken strings — an address, a JSON
   error — and must break anywhere rather than widen the page. */
const columns: Column<NotificationRow>[] = [
    { key: 'when', header: 'When', cell: (n) => <span className="mono small">{fmtDateTime(n.created_at)}</span> },
    { key: 'trigger', header: 'Trigger', hide: 'phone', cell: (n) => <span className="mono small wrap-anywhere">{n.trigger}</span> },
    { key: 'channel', header: 'Channel', cell: (n) => (n.channel === 'sms' ? 'Text' : 'Email') },
    {
        key: 'to',
        header: 'To',
        cell: (n) => <span className="small wrap-anywhere">{n.recipient} <span className="muted">({n.recipient_role})</span></span>
    },
    {
        key: 'subject',
        header: 'Subject',
        primary: true,
        cell: (n) => <span className="wrap-anywhere">{n.subject ?? <span className="muted">{n.channel === 'sms' ? 'Text message' : 'No subject'}</span>}</span>
    },
    {
        key: 'outcome',
        header: 'Outcome',
        cell: (n) => (
            <div>
                <Badge status={n.status === 'sent' ? 'paid' : n.status === 'failed' ? 'failed' : 'draft'}>{n.status}</Badge>
                {n.error ? <div className="small muted wrap-anywhere">{n.error}</div> : null}
            </div>
        )
    }
];

export default async function NotificationsPage() {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(300);
    const rows = (data ?? []) as NotificationRow[];
    return (
        <>
            <PageHead eyebrow="Audit" title="Message log">Every email and text the portal tried to send, and whether it went out. When a client says they never got something, check here.</PageHead>
            {rows.length ? (
                <DataTable caption="Messages" columns={columns} rows={rows} rowKey={(n) => n.id} />
            ) : <Empty>Nothing sent yet.</Empty>}
        </>
    );
}
