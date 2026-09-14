import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHead, Badge, Empty } from '@/components/ui';
import { DataTable, type Column } from '@/components/data-table';
import { fmtDateTime } from '@/lib/format';
import type { Proposal } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

const columns: Column<Proposal>[] = [
    { key: 'title', header: 'Proposal', primary: true, cell: (p) => <Link href={`/client/proposals/${p.id}`}>{p.title}</Link> },
    { key: 'sent', header: 'Sent', cell: (p) => <span className="small">{fmtDateTime(p.sent_at)}</span> },
    { key: 'status', header: 'Status', cell: (p) => <Badge status={p.status} /> }
];

export default async function ClientProposals() {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.from('proposals').select('*').order('sent_at', { ascending: false });
    const proposals = (data ?? []) as Proposal[];
    return (
        <>
            <PageHead eyebrow="Documents" title="Proposals">Open a proposal to read the scope and terms, then accept it right on the page.</PageHead>
            {proposals.length ? <DataTable caption="Proposals" columns={columns} rows={proposals} rowKey={(p) => p.id} /> : <Empty>No proposals yet.</Empty>}
        </>
    );
}
