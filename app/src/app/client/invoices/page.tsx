import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHead, Badge, Money, Empty } from '@/components/ui';
import { fmtDateOnly } from '@/lib/format';
import type { Invoice } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

export default async function ClientInvoices() {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.from('invoices').select('*').order('issue_date', { ascending: false });
    const invoices = (data ?? []) as Invoice[];
    return (
        <>
            <PageHead eyebrow="Billing" title="Invoices">Pay by card or bank transfer. Receipts are emailed automatically.</PageHead>
            {invoices.length ? <div className="card table-wrap"><table><thead><tr><th>Invoice</th><th>Issued</th><th>Due</th><th className="num">Total</th><th className="num">Balance</th><th>Status</th><th /></tr></thead><tbody>{invoices.map((i) => <tr key={i.id}><td className="mono">{i.invoice_number}</td><td className="small">{fmtDateOnly(i.issue_date)}</td><td className="small">{fmtDateOnly(i.due_date)}</td><td className="num"><Money cents={i.total_cents} /></td><td className="num"><Money cents={i.total_cents - i.amount_paid_cents} /></td><td><Badge status={i.status} /></td><td><Link href={`/client/invoices/${i.id}`} className="btn btn--ghost btn--sm">{i.total_cents - i.amount_paid_cents > 0 && i.status !== 'void' ? 'View & pay' : 'View'}</Link></td></tr>)}</tbody></table></div> : <Empty>No invoices yet.</Empty>}
        </>
    );
}
