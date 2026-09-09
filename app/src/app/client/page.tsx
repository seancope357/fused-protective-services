import Link from 'next/link';
import { requireClient } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHead, Badge, Money, Empty, Stat } from '@/components/ui';
import { fmtDateTime, fmtDateOnly } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { site } from '@/lib/shared';
import type { Invoice, Job, Proposal } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

export default async function ClientHome() {
    const session = await requireClient();
    const supabase = await createSupabaseServerClient();
    const [{ data: client }, { data: proposals }, { data: jobs }, { data: invoices }] = await Promise.all([
        supabase.from('clients').select('name').eq('id', session.clientId).maybeSingle(),
        supabase.from('proposals').select('*').eq('status', 'sent').order('sent_at', { ascending: false }),
        supabase.from('jobs').select('*').in('status', ['scheduled', 'in_progress']).gte('ends_at', new Date().toISOString()).order('starts_at').limit(5),
        supabase.from('invoices').select('*').in('status', ['sent', 'partially_paid', 'overdue']).order('due_date')
    ]);
    const open = (invoices ?? []) as Invoice[];
    const due = open.reduce((s, i) => s + (i.total_cents - i.amount_paid_cents), 0);
    return (
        <>
            <PageHead eyebrow={client?.name ?? 'Client'} title="Your protection, in one place">Proposals to review, upcoming details and their briefs, and invoices. Dispatch is always at {site.phone.display}.</PageHead>
            <div className="grid grid--3 mb-4">
                <Stat label="Proposals awaiting you" value={(proposals ?? []).length} gold={(proposals ?? []).length > 0} />
                <Stat label="Upcoming details" value={(jobs ?? []).length} hint={jobs?.[0] ? `Next: ${fmtDateTime((jobs[0] as Job).starts_at)}` : undefined} />
                <Stat label="Balance due" value={formatMoney(due)} hint={open.length ? `${open.length} open invoice${open.length === 1 ? '' : 's'}` : 'All settled'} />
            </div>
            <div className="grid grid--2">
                <section className="card"><div className="card__title"><h2>Proposals</h2><Link href="/client/proposals" className="small">All →</Link></div>
                    {proposals && proposals.length ? (proposals as Proposal[]).map((p) => <p key={p.id} className="mt-2"><Link href={`/client/proposals/${p.id}`}>{p.title}</Link> <Badge status={p.status} /></p>) : <Empty>Nothing awaiting your review.</Empty>}
                </section>
                <section className="card"><div className="card__title"><h2>Upcoming details</h2><Link href="/client/jobs" className="small">All →</Link></div>
                    {jobs && jobs.length ? (jobs as Job[]).map((j) => <p key={j.id} className="mt-2"><Link href={`/client/jobs/${j.id}`}>{j.title}</Link><br /><span className="small muted">{fmtDateTime(j.starts_at)}</span></p>) : <Empty>No details scheduled.</Empty>}
                </section>
                <section className="card" style={{ gridColumn: '1 / -1' }}><div className="card__title"><h2>Open invoices</h2><Link href="/client/invoices" className="small">All →</Link></div>
                    {open.length ? <div className="table-wrap"><table><thead><tr><th>Invoice</th><th>Due</th><th className="num">Balance</th><th>Status</th><th /></tr></thead><tbody>{open.map((i) => <tr key={i.id}><td className="mono">{i.invoice_number}</td><td>{fmtDateOnly(i.due_date)}</td><td className="num"><Money cents={i.total_cents - i.amount_paid_cents} /></td><td><Badge status={i.status} /></td><td><Link href={`/client/invoices/${i.id}`} className="btn btn--gold btn--sm">View & pay</Link></td></tr>)}</tbody></table></div> : <Empty>Nothing due. Thank you.</Empty>}
                </section>
            </div>
        </>
    );
}
