import Link from 'next/link';
import { listClients } from '@/lib/domain/queries';
import { PageHead, Empty, Badge } from '@/components/ui';
import { DataTable, type Column } from '@/components/data-table';
import { StatusFromSearch, type SearchStatus } from '@/components/status-from-search';
import { netTermById } from '@/lib/shared';
import { titleCase } from '@/lib/format';

export const dynamic = 'force-dynamic';

type ClientRow = Awaited<ReturnType<typeof listClients>>[number];

const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;

/* On a phone the card is the name, who to ask for and a number to call; the
   phone link sits above the card link so it dials rather than opening the client. */
const columns: Column<ClientRow>[] = [
    {
        key: 'name',
        header: 'Name',
        primary: true,
        cell: (c) => (
            <>
                <Link href={`/portal/clients/${c.id}`}>{c.name}</Link>
                <div className="small muted">{titleCase(c.kind)}</div>
            </>
        )
    },
    { key: 'contact', header: 'Contact', cell: (c) => c.billing_contact_name ?? '—' },
    { key: 'email', header: 'Email', hide: 'phone', cell: (c) => <span className="small wrap-anywhere">{c.billing_email ?? '—'}</span> },
    { key: 'phone', header: 'Phone', cell: (c) => c.billing_phone ? <a href={telHref(c.billing_phone)} className="small">{c.billing_phone}</a> : <span className="small">—</span> },
    { key: 'terms', header: 'Terms', hide: 'tablet', cell: (c) => <span className="small">{netTermById(c.default_net_term_id).label}</span> },
    { key: 'sms', header: 'Text reminders', hide: 'phone', cell: (c) => c.sms_consent && !c.sms_opted_out_at ? <Badge tone="good">Agreed</Badge> : <Badge>No</Badge> }
];

export default async function ClientsPage({ searchParams }: { searchParams: Promise<SearchStatus> }) {
    const clients = await listClients();
    return (
        <>
            <PageHead eyebrow="Accounts" title="Clients & sites" primary={<Link href="/portal/clients/new" className="btn btn--gold">New client</Link>}>
                Each client can have several sites. Add a venue once and reuse it for every job there.
            </PageHead>
            <StatusFromSearch params={await searchParams} />
            {clients.length ? (
                <DataTable caption="Clients" columns={columns} rows={clients} rowKey={(c) => c.id} />
            ) : <Empty>No clients yet. Converting a lead creates one.</Empty>}
        </>
    );
}
