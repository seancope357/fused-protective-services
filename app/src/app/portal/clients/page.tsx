import Link from 'next/link';
import { listClients } from '@/lib/domain/queries';
import { PageHead, Empty, LinkButton, Badge } from '@/components/ui';
import { StatusFromSearch, type SearchStatus } from '@/components/status-from-search';

export const dynamic = 'force-dynamic';

export default async function ClientsPage({ searchParams }: { searchParams: Promise<SearchStatus> }) {
    const clients = await listClients();
    return (
        <>
            <PageHead eyebrow="Accounts" title="Clients & sites" actions={<LinkButton href="/portal/clients/new" variant="gold">New client</LinkButton>}>A venue you guard weekly is one site, forever.</PageHead>
            <StatusFromSearch params={await searchParams} />
            {clients.length ? (
                <div className="card table-wrap mt-4">
                    <table>
                        <thead><tr><th>Name</th><th>Contact</th><th>Email</th><th>Phone</th><th>Terms</th><th>SMS</th></tr></thead>
                        <tbody>{clients.map((c) => <tr key={c.id} className="is-link"><td><Link href={`/portal/clients/${c.id}`}>{c.name}</Link><div className="small muted">{c.kind}</div></td><td>{c.billing_contact_name ?? '—'}</td><td className="small">{c.billing_email ?? '—'}</td><td className="small">{c.billing_phone ?? '—'}</td><td className="small">{c.default_net_term_id}</td><td>{c.sms_consent && !c.sms_opted_out_at ? <Badge tone="good">consented</Badge> : <Badge>no</Badge>}</td></tr>)}</tbody>
                    </table>
                </div>
            ) : <Empty>No clients yet. Converting a lead creates one.</Empty>}
        </>
    );
}
