import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getJob, getSite, listShifts, listInvoicesForJob, getReviewByJob } from '@/lib/domain/queries';
import { PageHead, Badge, Money } from '@/components/ui';
import { fmtDateTime, fmtTime } from '@/lib/format';
import { divisionByQuoteValue, site as company } from '@/lib/shared';

export const dynamic = 'force-dynamic';

export default async function ClientJobPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const job = await getJob(id);
    if (!job) notFound();
    const [site, shifts, invoices, review] = await Promise.all([getSite(job.site_id), listShifts(id), listInvoicesForJob(id), getReviewByJob(id)]);
    return (
        <>
            <PageHead eyebrow={`Detail ${job.job_number}`} title={job.title}><Badge status={job.status} /> · {divisionByQuoteValue(job.division_quote_value)?.heading ?? job.division_quote_value}</PageHead>
            <div className="grid grid--2" style={{ alignItems: 'start' }}>
                <section className="card card--gold">
                    <h2 className="mb-4">Pre-detail brief</h2>
                    <dl className="kv">
                        <dt>When</dt><dd>{fmtDateTime(job.starts_at)} – {fmtTime(job.ends_at)}{job.recurrence_rule ? `\nRecurring until ${job.recurrence_until}` : ''}</dd>
                        <dt>Where</dt><dd>{site ? [site.name, site.address_line1, site.city && `${site.city}, ${site.state} ${site.postal_code ?? ''}`].filter(Boolean).join('\n') : 'Per your proposal'}</dd>
                        <dt>Arrival</dt><dd>{job.arrival_window ?? 'Officers arrive 30 minutes before start'}</dd>
                        <dt>On-site contact</dt><dd>{[job.onsite_contact_name, job.onsite_contact_phone].filter(Boolean).join(' · ') || site?.onsite_contact_name || '—'}</dd>
                        <dt>What to prepare</dt><dd>{job.client_prep_notes ?? 'Nothing further is needed from you before arrival.'}</dd>
                        <dt>Dispatch</dt><dd>{company.phone.display} (24/7)</dd>
                    </dl>
                    {job.completion_summary ? <><h3 className="mt-6 mb-2">After-action summary</h3><p>{job.completion_summary}</p></> : null}
                </section>
                <div className="stack">
                    <section className="card"><h2 className="mb-4">Shifts</h2>{shifts.length ? <div className="table-wrap"><table><thead><tr><th>Start</th><th>End</th><th>Officers</th></tr></thead><tbody>{shifts.map((s) => <tr key={s.id}><td className="mono small">{fmtDateTime(s.starts_at)}</td><td className="mono small">{fmtTime(s.ends_at)}</td><td>{s.officers_required}</td></tr>)}</tbody></table></div> : <p className="small muted">Schedule to follow.</p>}</section>
                    <section className="card"><h2 className="mb-4">Invoices</h2>{invoices.filter((i) => i.status !== 'draft').length ? invoices.filter((i) => i.status !== 'draft').map((i) => <p key={i.id}><Link href={`/client/invoices/${i.id}`} className="mono">{i.invoice_number}</Link> · <Money cents={i.total_cents} /> · <Badge status={i.status} /></p>) : <p className="small muted">No invoices yet.</p>}</section>
                    {review ? <section className="card"><h2 className="mb-2">Your review</h2>{review.status === 'submitted' ? <p>{'★'.repeat(review.rating ?? 0)} — thank you.</p> : <p><Link href={`/review/${review.token}`} className="btn btn--gold btn--sm">Leave a review</Link></p>}</section> : null}
                </div>
            </div>
        </>
    );
}
