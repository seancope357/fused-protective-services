import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHead, Stat, Badge, Money, Empty } from '@/components/ui';
import { DataTable, type Column } from '@/components/data-table';
import { fmtDateTime, fmtDateOnly, daysBetween, todayYmd } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import { divisionByQuoteValue, site } from '@/lib/shared';
import { gettingStartedFacts, listLeads } from '@/lib/domain/queries';
import { allDone, gettingStartedSteps } from '@/lib/domain/getting-started';
import type { Invoice, Job } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

type Lead = Awaited<ReturnType<typeof listLeads>>[number];

/* On a phone each card is titled by the thing Cameron taps: the person, the
   job, the invoice. Supporting columns that repeat what the title or another
   cell already says wait for a wider screen. */
const leadColumns: Column<Lead>[] = [
    { key: 'received', header: 'Received', cell: (l) => <span className="mono small">{fmtDateTime(l.created_at)}</span> },
    {
        key: 'contact',
        header: 'Contact',
        primary: true,
        cell: (l) => (
            <>
                <Link href={`/portal/leads/${l.id}`}>{l.full_name}</Link>
                {l.company ? <div className="small muted">{l.company}</div> : null}
            </>
        )
    },
    { key: 'division', header: 'Division', hide: 'phone', cell: (l) => <span className="small">{divisionByQuoteValue(l.service_division)?.heading ?? l.service_division}</span> },
    { key: 'priority', header: 'Priority', cell: (l) => <Badge status={l.priority} /> }
];

const jobColumns: Column<Job>[] = [
    { key: 'starts', header: 'Starts', cell: (j) => <span className="mono small">{fmtDateTime(j.starts_at)}</span> },
    {
        key: 'job',
        header: 'Job',
        primary: true,
        cell: (j) => (
            <>
                <Link href={`/portal/jobs/${j.id}`}>{j.title}</Link>
                <div className="small muted">{j.job_number}</div>
            </>
        )
    },
    { key: 'status', header: 'Status', cell: (j) => <Badge status={j.status} /> }
];

function invoiceColumns(today: string): Column<Invoice>[] {
    return [
        { key: 'invoice', header: 'Invoice', primary: true, cell: (i) => <Link href={`/portal/invoices/${i.id}`} className="mono">{i.invoice_number}</Link> },
        { key: 'client', header: 'Client', cell: (i) => <span className="wrap-anywhere">{i.client_company || i.client_name}</span> },
        { key: 'due', header: 'Due', hide: 'phone', cell: (i) => <span className="small">{fmtDateOnly(i.due_date)}</span> },
        {
            key: 'age',
            header: 'Age',
            cell: (i) => {
                const age = daysBetween(i.due_date, today);
                return <span className="small">{age > 0 ? <span className="status-bad">{age}d overdue</span> : `due in ${-age}d`}</span>;
            }
        },
        { key: 'balance', header: 'Balance', num: true, cell: (i) => <Money cents={i.total_cents - i.amount_paid_cents} /> },
        { key: 'status', header: 'Status', cell: (i) => <Badge status={i.status} /> }
    ];
}

export default async function Dashboard() {
    const supabase = await createSupabaseServerClient();
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 86400000).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const today = todayYmd();

    /* Leads are production-only here (SPEC-002): a preview submission is not a
       lead, and "New leads" is the number the owner acts on. */
    const [leads, { data: jobs }, { data: unpaid }, { data: paidThisMonth }, facts] = await Promise.all([
        listLeads({ stage: 'new', limit: 10 }),
        supabase.from('jobs').select('*').in('status', ['scheduled', 'in_progress']).lte('starts_at', in7).order('starts_at').limit(15),
        supabase.from('invoices').select('*').in('status', ['sent', 'partially_paid', 'overdue']).order('due_date'),
        supabase.from('payments').select('amount_cents').eq('status', 'succeeded').gte('received_at', monthStart),
        gettingStartedFacts()
    ]);

    const openInvoices = (unpaid ?? []) as Invoice[];
    const upcoming = (jobs ?? []) as Job[];
    const outstanding = openInvoices.reduce((s, i) => s + (i.total_cents - i.amount_paid_cents), 0);
    const overdueCount = openInvoices.filter((i) => daysBetween(i.due_date, today) >= 1).length;
    const revenue = (paidThisMonth ?? []).reduce((s, p) => s + p.amount_cents, 0);

    /* An empty Today is four zeros and no next move (SPEC-012). Until the
       business has done each thing once, the first card says what to do and
       links to where it is done; the next step is the one gold button. */
    const steps = gettingStartedSteps(facts);
    const nextStep = steps.find((s) => !s.done);
    const doneCount = steps.filter((s) => s.done).length;

    return (
        <>
            <PageHead eyebrow="Command" title="What needs you today">
                {site.phone.placeholder ? <span className="placeholder-flag">Placeholder phone still on the site — see Settings</span> : null}
            </PageHead>

            {allDone(steps) ? null : (
                <section className="card card--gold stack mb-4" aria-labelledby="h-start">
                    <div className="card__title">
                        <h2 id="h-start">Getting started</h2>
                        <span className="small muted">{doneCount} of {steps.length} done</span>
                    </div>
                    <ol className="stack list-plain">
                        {steps.map((step, index) => (
                            <li key={step.id}>
                                {step.done ? (
                                    <span className="small muted">
                                        <span className="status-good" aria-hidden="true">✓</span> {step.label}
                                        <span className="visually-hidden"> — done</span>
                                    </span>
                                ) : (
                                    <Link
                                        href={step.href}
                                        className={`btn ${step === nextStep ? 'btn--gold' : 'btn--ghost'}`}
                                        aria-current={step === nextStep ? 'step' : undefined}
                                    >
                                        {index + 1}. {step.label}
                                    </Link>
                                )}
                            </li>
                        ))}
                    </ol>
                </section>
            )}

            <div className="grid grid--4 mb-4">
                <Stat label="New leads" value={leads.length} hint="Awaiting first response" gold={leads.length > 0} />
                <Stat label="Jobs next 7 days" value={upcoming.length} hint={upcoming[0] ? `Next: ${fmtDateTime(upcoming[0].starts_at)}` : 'Nothing scheduled'} />
                <Stat label="Outstanding" value={formatMoney(outstanding)} hint={`${openInvoices.length} open · ${overdueCount} overdue`} />
                <Stat label="Collected this month" value={formatMoney(revenue)} hint="Succeeded payments" gold />
            </div>

            <div className="grid grid--2">
                <section className="card" aria-labelledby="h-leads">
                    <div className="card__title"><h2 id="h-leads">Leads needing a response</h2><Link href="/portal/leads" className="small">All leads →</Link></div>
                    {leads.length ? (
                        <DataTable caption="Leads needing a response" columns={leadColumns} rows={leads} rowKey={(l) => l.id} flush />
                    ) : <Empty>Inbox clear. Every lead has been answered.</Empty>}
                </section>

                <section className="card" aria-labelledby="h-jobs">
                    <div className="card__title"><h2 id="h-jobs">Jobs in the next 7 days</h2><Link href="/portal/jobs/calendar" className="small">Calendar →</Link></div>
                    {upcoming.length ? (
                        <DataTable caption="Jobs in the next 7 days" columns={jobColumns} rows={upcoming} rowKey={(j) => j.id} flush />
                    ) : <Empty>No details scheduled this week.</Empty>}
                </section>

                <section className="card span-all" aria-labelledby="h-inv">
                    <div className="card__title"><h2 id="h-inv">Unpaid invoices</h2><Link href="/portal/invoices" className="small">All invoices →</Link></div>
                    {openInvoices.length ? (
                        <DataTable caption="Unpaid invoices" columns={invoiceColumns(today)} rows={openInvoices} rowKey={(i) => i.id} flush />
                    ) : <Empty>Nothing outstanding.</Empty>}
                </section>
            </div>
        </>
    );
}
