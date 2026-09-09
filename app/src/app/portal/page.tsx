import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHead, Stat, Badge, Money, Empty } from '@/components/ui';
import { fmtDateTime, fmtDateOnly, daysBetween, todayYmd } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { divisionByQuoteValue, site } from '@/lib/shared';
import type { Invoice, Job, Lead } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
    const supabase = await createSupabaseServerClient();
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 86400000).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const today = todayYmd();

    const [{ data: leads }, { data: jobs }, { data: unpaid }, { data: paidThisMonth }] = await Promise.all([
        supabase.from('client_quotes').select('*').eq('status', 'new').order('created_at', { ascending: false }).limit(10),
        supabase.from('jobs').select('*').in('status', ['scheduled', 'in_progress']).lte('starts_at', in7).order('starts_at').limit(15),
        supabase.from('invoices').select('*').in('status', ['sent', 'partially_paid', 'overdue']).order('due_date'),
        supabase.from('payments').select('amount_cents').eq('status', 'succeeded').gte('received_at', monthStart)
    ]);

    const openInvoices = (unpaid ?? []) as Invoice[];
    const outstanding = openInvoices.reduce((s, i) => s + (i.total_cents - i.amount_paid_cents), 0);
    const overdueCount = openInvoices.filter((i) => daysBetween(i.due_date, today) >= 1).length;
    const revenue = (paidThisMonth ?? []).reduce((s, p) => s + p.amount_cents, 0);

    return (
        <>
            <PageHead eyebrow="Command" title="What needs you today">
                {site.phone.placeholder ? <span className="placeholder-flag">Placeholder phone still on the site — see Settings</span> : null}
            </PageHead>

            <div className="grid grid--4 mb-4">
                <Stat label="New leads" value={(leads ?? []).length} hint="Awaiting first response" gold={(leads ?? []).length > 0} />
                <Stat label="Jobs next 7 days" value={(jobs ?? []).length} hint={jobs?.[0] ? `Next: ${fmtDateTime((jobs[0] as Job).starts_at)}` : 'Nothing scheduled'} />
                <Stat label="Outstanding" value={formatMoney(outstanding)} hint={`${openInvoices.length} open · ${overdueCount} overdue`} />
                <Stat label="Collected this month" value={formatMoney(revenue)} hint="Succeeded payments" gold />
            </div>

            <div className="grid grid--2">
                <section className="card" aria-labelledby="h-leads">
                    <div className="card__title"><h2 id="h-leads">Leads needing a response</h2><Link href="/portal/leads" className="small">All leads →</Link></div>
                    {leads && leads.length ? (
                        <div className="table-wrap"><table>
                            <thead><tr><th>Received</th><th>Contact</th><th>Division</th><th>Priority</th></tr></thead>
                            <tbody>
                                {(leads as Lead[]).map((l) => (
                                    <tr key={l.id} className="is-link">
                                        <td className="mono small">{fmtDateTime(l.created_at)}</td>
                                        <td><Link href={`/portal/leads/${l.id}`}>{l.full_name}</Link>{l.company ? <div className="small muted">{l.company}</div> : null}</td>
                                        <td className="small">{divisionByQuoteValue(l.service_division)?.heading ?? l.service_division}</td>
                                        <td><Badge status={l.priority} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table></div>
                    ) : <Empty>Inbox clear. Every lead has been answered.</Empty>}
                </section>

                <section className="card" aria-labelledby="h-jobs">
                    <div className="card__title"><h2 id="h-jobs">Jobs in the next 7 days</h2><Link href="/portal/jobs/calendar" className="small">Calendar →</Link></div>
                    {jobs && jobs.length ? (
                        <div className="table-wrap"><table>
                            <thead><tr><th>Starts</th><th>Job</th><th>Status</th></tr></thead>
                            <tbody>
                                {(jobs as Job[]).map((j) => (
                                    <tr key={j.id}>
                                        <td className="mono small">{fmtDateTime(j.starts_at)}</td>
                                        <td><Link href={`/portal/jobs/${j.id}`}>{j.title}</Link><div className="small muted">{j.job_number}</div></td>
                                        <td><Badge status={j.status} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table></div>
                    ) : <Empty>No details scheduled this week.</Empty>}
                </section>

                <section className="card" aria-labelledby="h-inv" style={{ gridColumn: '1 / -1' }}>
                    <div className="card__title"><h2 id="h-inv">Unpaid invoices</h2><Link href="/portal/invoices" className="small">All invoices →</Link></div>
                    {openInvoices.length ? (
                        <div className="table-wrap"><table>
                            <thead><tr><th>Invoice</th><th>Client</th><th>Due</th><th>Age</th><th className="num">Balance</th><th>Status</th></tr></thead>
                            <tbody>
                                {openInvoices.map((i) => {
                                    const age = daysBetween(i.due_date, today);
                                    return (
                                        <tr key={i.id}>
                                            <td><Link href={`/portal/invoices/${i.id}`} className="mono">{i.invoice_number}</Link></td>
                                            <td>{i.client_company || i.client_name}</td>
                                            <td className="small">{fmtDateOnly(i.due_date)}</td>
                                            <td className="small">{age > 0 ? <span style={{ color: '#fca5a5' }}>{age}d overdue</span> : `due in ${-age}d`}</td>
                                            <td className="num"><Money cents={i.total_cents - i.amount_paid_cents} /></td>
                                            <td><Badge status={i.status} /></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table></div>
                    ) : <Empty>Nothing outstanding.</Empty>}
                </section>
            </div>
        </>
    );
}
