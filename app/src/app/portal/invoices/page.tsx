import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHead, Badge, Money, Empty, LinkButton } from '@/components/ui';
import { StatusFromSearch, type SearchStatus } from '@/components/status-from-search';
import { createBlankInvoice } from '@/lib/actions/invoices';
import { fmtDateOnly, daysBetween, todayYmd } from '@/lib/format';
import type { Invoice } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<SearchStatus & { show?: string }> }) {
    const params = await searchParams;
    const supabase = await createSupabaseServerClient();
    let query = supabase.from('invoices').select('*').order('created_at', { ascending: false }).limit(300);
    if (params.show === 'open') query = query.in('status', ['sent', 'partially_paid', 'overdue']);
    if (params.show === 'paid') query = query.eq('status', 'paid');
    const { data } = await query;
    const invoices = (data ?? []) as Invoice[];
    const today = todayYmd();
    return (
        <>
            <PageHead eyebrow="Billing" title="Invoices" actions={<><LinkButton href="/portal/invoices/import">Import legacy</LinkButton><form action={createBlankInvoice}><button className="btn btn--gold" type="submit">Blank invoice</button></form></>}>
                Numbers are minted by the database. Payment status comes from Stripe's webhook, never the browser.
            </PageHead>
            <StatusFromSearch params={params} />
            <nav className="row mb-4 mt-4" aria-label="Filter">
                {[['', 'All'], ['open', 'Open'], ['paid', 'Paid']].map(([v, l]) => <Link key={v} href={`/portal/invoices${v ? `?show=${v}` : ''}`} className={`btn btn--sm ${(params.show ?? '') === v ? 'btn--gold' : 'btn--ghost'}`}>{l}</Link>)}
            </nav>
            {invoices.length ? (
                <div className="card table-wrap">
                    <table>
                        <thead><tr><th>Number</th><th>Client</th><th>Issued</th><th>Due</th><th className="num">Total</th><th className="num">Balance</th><th>Status</th></tr></thead>
                        <tbody>
                            {invoices.map((i) => {
                                const age = daysBetween(i.due_date, today);
                                const bal = i.total_cents - i.amount_paid_cents;
                                return (
                                    <tr key={i.id} className="is-link">
                                        <td><Link href={`/portal/invoices/${i.id}`} className="mono">{i.invoice_number}</Link>{i.kind !== 'standard' ? <span className="small muted"> · {i.kind}</span> : null}</td>
                                        <td>{i.client_company || i.client_name}</td>
                                        <td className="small">{fmtDateOnly(i.issue_date)}</td>
                                        <td className="small">{fmtDateOnly(i.due_date)}{bal > 0 && age > 0 && i.status !== 'draft' ? <span style={{ color: '#fca5a5' }}> · {age}d late</span> : null}</td>
                                        <td className="num"><Money cents={i.total_cents} /></td>
                                        <td className="num"><Money cents={bal} /></td>
                                        <td><Badge status={i.status} /></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : <Empty>No invoices yet. Generate one from a job, or import the old browser records.</Empty>}
        </>
    );
}
