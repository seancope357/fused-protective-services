import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHead, Badge, Empty } from '@/components/ui';
import { fmtDateTime } from '@/lib/format';
import type { Proposal } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

export default async function ClientProposals() {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.from('proposals').select('*').order('sent_at', { ascending: false });
    const proposals = (data ?? []) as Proposal[];
    return (
        <>
            <PageHead eyebrow="Documents" title="Proposals" />
            {proposals.length ? <div className="card table-wrap"><table><thead><tr><th>Proposal</th><th>Sent</th><th>Status</th></tr></thead><tbody>{proposals.map((p) => <tr key={p.id}><td><Link href={`/client/proposals/${p.id}`}>{p.title}</Link></td><td className="small">{fmtDateTime(p.sent_at)}</td><td><Badge status={p.status} /></td></tr>)}</tbody></table></div> : <Empty>No proposals yet.</Empty>}
        </>
    );
}
