import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHead, Badge, Money, Empty, LinkButton, Chips } from '@/components/ui';
import { DataTable, type Column } from '@/components/data-table';
import { StatusFromSearch, type SearchStatus } from '@/components/status-from-search';
import { createBlankInvoice } from '@/lib/actions/invoices';
import { fmtDateOnly, daysBetween, todayYmd } from '@/lib/format';
import type { Invoice } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

const FILTERS = [['', 'All'], ['open', 'Open'], ['paid', 'Paid']] as const;

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<SearchStatus & { show?: string }> }) {
    const params = await searchParams;
    const supabase = await createSupabaseServerClient();
    let query = supabase.from('invoices').select('*').order('created_at', { ascending: false }).limit(300);
    if (params.show === 'open') query = query.in('status', ['sent', 'partially_paid', 'overdue']);
    if (params.show === 'paid') query = query.eq('status', 'paid');
    const { data } = await query;
    const invoices = (data ?? []) as Invoice[];
    const today = todayYmd();
    const balance = (i: Invoice) => i.total_cents - i.amount_paid_cents;

    /* On a phone the card answers "who owes what": number, client, due (with
       the late marker), balance, status. Issue date and total wait for a wider
       screen; the balance is the number that matters. */
    const columns: Column<Invoice>[] = [
        {
            key: 'number',
            header: 'Number',
            primary: true,
            cell: (i) => (
                <>
                    <Link href={`/portal/invoices/${i.id}`} className="mono">{i.invoice_number}</Link>
                    {i.kind !== 'standard' ? <span className="small muted"> · {i.kind}</span> : null}
                </>
            )
        },
        { key: 'client', header: 'Client', cell: (i) => <span className="wrap-anywhere">{i.client_company || i.client_name}</span> },
        { key: 'issued', header: 'Issued', hide: 'tablet', cell: (i) => <span className="small">{fmtDateOnly(i.issue_date)}</span> },
        {
            key: 'due',
            header: 'Due',
            cell: (i) => {
                const age = daysBetween(i.due_date, today);
                return (
                    <span className="small">
                        {fmtDateOnly(i.due_date)}
                        {balance(i) > 0 && age > 0 && i.status !== 'draft' ? <span className="status-bad"> · {age}d late</span> : null}
                    </span>
                );
            }
        },
        { key: 'total', header: 'Total', num: true, hide: 'phone', cell: (i) => <Money cents={i.total_cents} /> },
        { key: 'balance', header: 'Balance', num: true, cell: (i) => <Money cents={balance(i)} /> },
        { key: 'status', header: 'Status', cell: (i) => <Badge status={i.status} /> }
    ];

    return (
        <>
            {/* No pinned primary. Most invoices are generated from a job's page,
                and a blank invoice takes the next number the moment it is
                created — not a button to leave under the thumb on a list Cameron
                mostly opens to check who has paid. */}
            <PageHead
                eyebrow="Billing"
                title="Invoices"
                actions={
                    <>
                        <LinkButton href="/portal/invoices/import">Import old invoices</LinkButton>
                        <form action={createBlankInvoice}><button className="btn btn--ghost" type="submit">Blank invoice</button></form>
                    </>
                }
            >
                Invoice numbers are assigned automatically. Payments update on their own when a client pays.
            </PageHead>
            <StatusFromSearch params={params} />
            <Chips
                label="Filter invoices"
                items={FILTERS.map(([value, label]) => ({
                    href: `/portal/invoices${value ? `?show=${value}` : ''}`,
                    label,
                    active: (params.show ?? '') === value
                }))}
            />
            {invoices.length ? (
                <DataTable caption="Invoices" columns={columns} rows={invoices} rowKey={(i) => i.id} />
            ) : (
                <Empty>
                    {params.show === 'open' || params.show === 'paid'
                        ? `No ${params.show} invoices.`
                        : 'No invoices yet. Create one from a job’s page, or import invoices from the old invoice tool.'}
                </Empty>
            )}
        </>
    );
}
