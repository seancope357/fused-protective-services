import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getJob, getSite, listShifts, listInvoicesForJob, getReviewByJob } from '@/lib/domain/queries';
import { PageHead, Badge, Money } from '@/components/ui';
import { DataTable, type Column } from '@/components/data-table';
import { fmtDateOnly, fmtDateTime, fmtTime } from '@/lib/format';
import { divisionByQuoteValue, site as company } from '@/lib/shared';

export const dynamic = 'force-dynamic';

type Shift = Awaited<ReturnType<typeof listShifts>>[number];
type JobInvoice = Awaited<ReturnType<typeof listInvoicesForJob>>[number];

const shiftColumns: Column<Shift>[] = [
    { key: 'start', header: 'Start', primary: true, cell: (s) => <span className="mono small">{fmtDateTime(s.starts_at)}</span> },
    { key: 'end', header: 'End', cell: (s) => <span className="mono small">{fmtTime(s.ends_at)}</span> },
    { key: 'officers', header: 'Officers', num: true, cell: (s) => <span>{s.officers_required}</span> }
];

const invoiceColumns: Column<JobInvoice>[] = [
    { key: 'number', header: 'Invoice', primary: true, cell: (i) => <Link href={`/client/invoices/${i.id}`} className="mono">{i.invoice_number}</Link> },
    { key: 'total', header: 'Total', num: true, cell: (i) => <Money cents={i.total_cents} /> },
    { key: 'status', header: 'Status', cell: (i) => <Badge status={i.status} /> }
];

export default async function ClientJobPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const job = await getJob(id);
    if (!job) notFound();
    const [site, shifts, invoices, review] = await Promise.all([getSite(job.site_id), listShifts(id), listInvoicesForJob(id), getReviewByJob(id)]);
    const billed = invoices.filter((i) => i.status !== 'draft');
    /* Once a detail is done, the one thing we ask of the client is a review. */
    const reviewPending = review && review.status !== 'submitted';
    return (
        <>
            <PageHead
                eyebrow={`Detail ${job.job_number}`}
                title={job.title}
                primary={reviewPending ? <Link href={`/review/${review.token}`} className="btn btn--gold">Leave a review</Link> : undefined}
            >
                <Badge status={job.status} /> · {divisionByQuoteValue(job.division_quote_value)?.heading ?? job.division_quote_value}
            </PageHead>
            <div className="grid grid--2 align-start">
                <section className="card card--gold">
                    <h2 className="mb-4">Pre-detail brief</h2>
                    <dl className="kv">
                        <dt>When</dt><dd>{fmtDateTime(job.starts_at)} – {fmtTime(job.ends_at)}{job.recurrence_rule ? `\nRecurring until ${fmtDateOnly(job.recurrence_until)}` : ''}</dd>
                        <dt>Where</dt><dd>{site ? [site.name, site.address_line1, site.city && `${site.city}, ${site.state} ${site.postal_code ?? ''}`].filter(Boolean).join('\n') : 'Per your proposal'}</dd>
                        <dt>Arrival</dt><dd>{job.arrival_window ?? 'Officers arrive 30 minutes before start'}</dd>
                        <dt>On-site contact</dt><dd>{[job.onsite_contact_name, job.onsite_contact_phone].filter(Boolean).join(' · ') || site?.onsite_contact_name || '—'}</dd>
                        <dt>What to prepare</dt><dd>{job.client_prep_notes ?? 'Nothing further is needed from you before arrival.'}</dd>
                        <dt>Dispatch</dt><dd><a href={`tel:${company.phone.e164}`}>{company.phone.display}</a> (24/7)</dd>
                    </dl>
                    {job.completion_summary ? <><h3 className="mt-6 mb-2">After-action summary</h3><p>{job.completion_summary}</p></> : null}
                </section>
                <div className="stack">
                    <section className="card">
                        <h2 className="mb-4">Shifts</h2>
                        {shifts.length ? <DataTable caption="Shifts" columns={shiftColumns} rows={shifts} rowKey={(s) => s.id} flush /> : <p className="small muted">Schedule to follow.</p>}
                    </section>
                    <section className="card">
                        <h2 className="mb-4">Invoices</h2>
                        {billed.length ? <DataTable caption="Invoices for this detail" columns={invoiceColumns} rows={billed} rowKey={(i) => i.id} flush /> : <p className="small muted">No invoices yet.</p>}
                    </section>
                    {review ? (
                        <section className="card">
                            <h2 className="mb-2">Your review</h2>
                            {review.status === 'submitted' ? (
                                <p><span role="img" aria-label={`${review.rating ?? 0} out of 5 stars`}>{'★'.repeat(review.rating ?? 0)}</span> — thank you.</p>
                            ) : (
                                <p>How did we do? It takes a minute, and it helps us look after you. <Link href={`/review/${review.token}`}>Leave a review</Link></p>
                            )}
                        </section>
                    ) : null}
                </div>
            </div>
        </>
    );
}
