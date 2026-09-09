import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHead, Badge, Empty } from '@/components/ui';
import { fmtDateTime } from '@/lib/format';
import type { NotificationRow } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(300);
    const rows = (data ?? []) as NotificationRow[];
    return (
        <>
            <PageHead eyebrow="Audit" title="Message log">Every email and text the platform attempted, with the outcome. "Did the client get the brief?" is answered here.</PageHead>
            {rows.length ? (
                <div className="card table-wrap mt-4">
                    <table>
                        <thead><tr><th>When</th><th>Trigger</th><th>Channel</th><th>To</th><th>Subject</th><th>Outcome</th></tr></thead>
                        <tbody>{rows.map((n) => <tr key={n.id}><td className="mono small">{fmtDateTime(n.created_at)}</td><td className="mono small">{n.trigger}</td><td>{n.channel}</td><td className="small">{n.recipient} <span className="muted">({n.recipient_role})</span></td><td className="small">{n.subject ?? '—'}</td><td><Badge status={n.status === 'sent' ? 'paid' : n.status === 'failed' ? 'failed' : 'draft'}>{n.status}</Badge>{n.error ? <div className="small muted">{n.error}</div> : null}</td></tr>)}</tbody>
                    </table>
                </div>
            ) : <Empty>Nothing sent yet.</Empty>}
        </>
    );
}
