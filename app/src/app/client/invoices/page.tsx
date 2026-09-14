import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHead, Badge, Money, Empty } from '@/components/ui';
import { DataTable, type Column } from '@/components/data-table';
import { fmtDateOnly } from '@/lib/format';
import type { Invoice } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

const owes = (i: Invoice) => i.total_cents - i.amount_paid_cents > 0 && i.status !== 'void';

/* On a phone the card shows what a client needs to act on — number, due date,
   balance, status — and the issue date and original total wait for a wider
   screen. Anything still owed gets the gold button; the rest a quiet "View". */
const columns: Column<Invoice>[] = [
    { key: 'number', header: 'Invoice', primary: true, cell: (i) => <Link href={`/client/invoices/${i.id}`} className="mono">{i.invoice_number}</Link> },
    { key: 'issued', header: 'Issued', hide: 'phone', cell: (i) => <span className="small">{fmtDateOnly(i.issue_date)}</span> },
    { key: 'due', header: 'Due', cell: (i) => <span className="small">{fmtDateOnly(i.due_date)}</span> },
    { key: 'total', header: 'Total', num: true, hide: 'phone', cell: (i) => <Money cents={i.total_cents} /> },
    { key: 'balance', header: 'Balance', num: true, cell: (i) => <Money cents={i.total_cents - i.amount_paid_cents} /> },
    { key: 'status', header: 'Status', cell: (i) => <Badge status={i.status} /> },
    {
        key: 'open',
        header: '',
        cell: (i) => (
            <Link href={`/client/invoices/${i.id}`} className={`btn ${owes(i) ? 'btn--gold' : 'btn--ghost'} btn--sm`}>
                {owes(i) ? 'View & pay' : 'View'}<span className="visually-hidden"> invoice {i.invoice_number}</span>
            </Link>
        )
    }
];

export default async function ClientInvoices() {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.from('invoices').select('*').order('issue_date', { ascending: false });
    const invoices = (data ?? []) as Invoice[];
    return (
        <>
            <PageHead eyebrow="Billing" title="Invoices">Pay by card or bank transfer. Receipts are emailed automatically.</PageHead>
            {invoices.length ? <DataTable caption="Invoices" columns={columns} rows={invoices} rowKey={(i) => i.id} /> : <Empty>No invoices yet.</Empty>}
        </>
    );
}
