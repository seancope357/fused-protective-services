import Link from 'next/link';
import { requireClient } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHead, Badge, Money, Empty, Stat } from '@/components/ui';
import { DataTable, type Column } from '@/components/data-table';
import { fmtDateTime, fmtDateOnly } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { site } from '@/lib/shared';
import type { Invoice, Job, Proposal } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

const proposalColumns: Column<Proposal>[] = [
    { key: 'title', header: 'Proposal', primary: true, cell: (p) => <Link href={`/client/proposals/${p.id}`}>{p.title}</Link> },
    { key: 'sent', header: 'Sent', cell: (p) => <span className="small">{fmtDateTime(p.sent_at)}</span> },
    { key: 'status', header: 'Status', hide: 'phone', cell: (p) => <Badge status={p.status} /> }
];

const jobColumns: Column<Job>[] = [
    { key: 'title', header: 'Detail', primary: true, cell: (j) => <Link href={`/client/jobs/${j.id}`}>{j.title}</Link> },
    { key: 'when', header: 'Starts', cell: (j) => <span className="small">{fmtDateTime(j.starts_at)}</span> }
];

/* The pay button stays a gold button on every width: on a phone card it sits
   above the stretched card link, so a tap on it is a tap on "View & pay". */
const invoiceColumns: Column<Invoice>[] = [
    { key: 'number', header: 'Invoice', primary: true, cell: (i) => <Link href={`/client/invoices/${i.id}`} className="mono">{i.invoice_number}</Link> },
    { key: 'due', header: 'Due', cell: (i) => <span>{fmtDateOnly(i.due_date)}</span> },
    { key: 'balance', header: 'Balance', num: true, cell: (i) => <Money cents={i.total_cents - i.amount_paid_cents} /> },
    { key: 'status', header: 'Status', cell: (i) => <Badge status={i.status} /> },
    {
        key: 'pay',
        header: '',
        cell: (i) => (
            <Link href={`/client/invoices/${i.id}`} className="btn btn--gold btn--sm">
                View &amp; pay<span className="visually-hidden"> invoice {i.invoice_number}</span>
            </Link>
        )
    }
];

export default async function ClientHome() {
    const session = await requireClient();
    const supabase = await createSupabaseServerClient();
    const [{ data: client }, { data: proposals }, { data: jobs }, { data: invoices }] = await Promise.all([
        supabase.from('clients').select('name').eq('id', session.clientId).maybeSingle(),
        supabase.from('proposals').select('*').eq('status', 'sent').order('sent_at', { ascending: false }),
        supabase.from('jobs').select('*').in('status', ['scheduled', 'in_progress']).gte('ends_at', new Date().toISOString()).order('starts_at').limit(5),
        supabase.from('invoices').select('*').in('status', ['sent', 'partially_paid', 'overdue']).order('due_date')
    ]);
    const awaiting = (proposals ?? []) as Proposal[];
    const upcoming = (jobs ?? []) as Job[];
    const open = (invoices ?? []) as Invoice[];
    const due = open.reduce((s, i) => s + (i.total_cents - i.amount_paid_cents), 0);
    return (
        <>
            <PageHead eyebrow={client?.name ?? 'Client'} title="Your protection, in one place">
                Proposals to review, upcoming details and their briefs, and invoices. Dispatch is always at <a href={`tel:${site.phone.e164}`}>{site.phone.display}</a>.
            </PageHead>
            <div className="grid grid--3 mb-4">
                <Stat label="Proposals awaiting you" value={awaiting.length} gold={awaiting.length > 0} />
                <Stat label="Upcoming details" value={upcoming.length} hint={upcoming[0] ? `Next: ${fmtDateTime(upcoming[0].starts_at)}` : undefined} />
                <Stat label="Balance due" value={formatMoney(due)} hint={open.length ? `${open.length} open invoice${open.length === 1 ? '' : 's'}` : 'All settled'} />
            </div>
            <div className="grid grid--2">
                <section className="card">
                    <div className="card__title"><h2>Proposals</h2><Link href="/client/proposals" className="small">See all<span className="visually-hidden"> proposals</span></Link></div>
                    {awaiting.length ? <DataTable caption="Proposals awaiting you" columns={proposalColumns} rows={awaiting} rowKey={(p) => p.id} flush /> : <Empty>Nothing awaiting your review.</Empty>}
                </section>
                <section className="card">
                    <div className="card__title"><h2>Upcoming details</h2><Link href="/client/jobs" className="small">See all<span className="visually-hidden"> details</span></Link></div>
                    {upcoming.length ? <DataTable caption="Upcoming details" columns={jobColumns} rows={upcoming} rowKey={(j) => j.id} flush /> : <Empty>No details scheduled.</Empty>}
                </section>
                <section className="card span-all">
                    <div className="card__title"><h2>Open invoices</h2><Link href="/client/invoices" className="small">See all<span className="visually-hidden"> invoices</span></Link></div>
                    {open.length ? <DataTable caption="Open invoices" columns={invoiceColumns} rows={open} rowKey={(i) => i.id} flush /> : <Empty>Nothing due. Thank you.</Empty>}
                </section>
            </div>
        </>
    );
}
