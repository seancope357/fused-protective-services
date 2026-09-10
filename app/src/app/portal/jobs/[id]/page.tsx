import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getJob, getClient, getSite, listShifts, listInvoicesForJob, listClients, listSites, getReviewByJob } from '@/lib/domain/queries';
import { PageHead, Badge, Money, Field, Empty } from '@/components/ui';
import { StatusFromSearch, type SearchStatus } from '@/components/status-from-search';
import { JobFields } from '@/components/job-form';
import { updateJob, saveShift, deleteShift, confirmJob, setJobStatus } from '@/lib/actions/jobs';
import { generateInvoiceFromJob } from '@/lib/actions/invoices';
import { fmtDateTime, fmtTime } from '@/lib/format';
import { armedLevels } from '@/lib/shared';
import { isoToLocal } from '@/lib/actions/util';
import { lineCents } from '@/lib/money';
import { timelineFor } from '@/lib/domain/timeline';
import { Timeline } from '@/components/timeline';

export const dynamic = 'force-dynamic';

export default async function JobPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchStatus> }) {
    const { id } = await params;
    const job = await getJob(id);
    if (!job) notFound();
    const [client, site, shifts, invoices, clients, sites, review] = await Promise.all([
        getClient(job.client_id), getSite(job.site_id), listShifts(id), listInvoicesForJob(id), listClients(), listSites(job.client_id), getReviewByJob(id)
    ]);
    const billable = shifts.filter((s) => s.status !== 'cancelled');
    const estimate = billable.reduce((sum, s) => sum + lineCents(s.officers_required, (new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime()) / 3600000, s.bill_rate_cents), 0);
    const hasDeposit = invoices.some((i) => i.kind === 'deposit' && i.status !== 'void');
    const events = await timelineFor({ entityType: 'job', id, related: [...invoices.map((i) => ({ entityType: 'invoice', id: i.id })), ...(review ? [{ entityType: 'review', id: review.id }] : []), ...(job.quote_id ? [{ entityType: 'quote', id: job.quote_id }] : [])] });
    const open = job.status === 'scheduled' || job.status === 'in_progress';

    return (
        <>
            <PageHead eyebrow={`Job ${job.job_number}`} title={job.title}
                actions={
                    <>
                        {open ? <form action={confirmJob}><input type="hidden" name="id" value={id} /><button className="btn btn--gold" type="submit">{job.confirmed_at ? 'Resend brief' : 'Confirm & send brief'}</button></form> : null}
                        {job.status === 'scheduled' ? <form action={setJobStatus}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="in_progress" /><button className="btn btn--ghost" type="submit">Start</button></form> : null}
                        {open ? <form action={setJobStatus}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="cancelled" /><button className="btn btn--danger" type="submit">Cancel job</button></form> : null}
                    </>
                }>
                <Badge status={job.status} /> · {client ? <Link href={`/portal/clients/${client.id}`}>{client.name}</Link> : '—'} · {fmtDateTime(job.starts_at)} – {fmtTime(job.ends_at)}{job.recurrence_rule ? ` · recurs ${job.recurrence_rule} until ${job.recurrence_until}` : ''}
                {job.confirmed_at ? ` · brief sent ${fmtDateTime(job.confirmed_at)}` : ''}{job.quote_id ? <> · <Link href={`/portal/quotes/${job.quote_id}`}>from quote</Link></> : ''}
            </PageHead>
            <StatusFromSearch params={await searchParams} />

            <div className="stack mt-4">
                <section className="card">
                    <div className="card__title"><h2>Shifts</h2><span className="small muted">{billable.length} billable · estimate <Money cents={estimate} /></span></div>
                    {shifts.length ? (
                        <div className="table-wrap"><table>
                            <thead><tr><th>Start</th><th>End</th><th>Officers</th><th>Level</th><th className="num">Rate</th><th>Status</th><th /></tr></thead>
                            <tbody>
                                {shifts.map((s) => (
                                    <tr key={s.id}>
                                        <td className="mono small">{fmtDateTime(s.starts_at)}</td>
                                        <td className="mono small">{fmtTime(s.ends_at)}</td>
                                        <td>{s.officers_required}</td>
                                        <td className="small">{armedLevels.find((l) => l.id === s.armed_level)?.label ?? s.armed_level}</td>
                                        <td className="num"><Money cents={s.bill_rate_cents} /></td>
                                        <td><Badge status={s.status} /></td>
                                        <td>{open ? <form action={deleteShift}><input type="hidden" name="job_id" value={id} /><input type="hidden" name="id" value={s.id} /><button className="btn btn--danger btn--sm" type="submit" aria-label={`Remove shift ${fmtDateTime(s.starts_at)}`}>Remove</button></form> : null}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table></div>
                    ) : <Empty>No shifts. Add one below.</Empty>}
                    {open ? (
                        <details className="mt-4"><summary style={{ cursor: 'pointer' }}>Add a shift</summary>
                            <form action={saveShift} className="form-grid mt-4">
                                <input type="hidden" name="job_id" value={id} />
                                <Field id="s_start" label="Starts"><input id="s_start" name="starts_at" type="datetime-local" defaultValue={isoToLocal(job.starts_at)} required /></Field>
                                <Field id="s_end" label="Ends"><input id="s_end" name="ends_at" type="datetime-local" defaultValue={isoToLocal(job.ends_at)} required /></Field>
                                <Field id="s_off" label="Officers"><input id="s_off" name="officers_required" type="number" min={1} defaultValue={shifts[0]?.officers_required ?? 2} /></Field>
                                <Field id="s_lvl" label="Level"><select id="s_lvl" name="armed_level" defaultValue={shifts[0]?.armed_level ?? 'level-3'}>{armedLevels.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select></Field>
                                <Field id="s_rate" label="Rate $/hr"><input id="s_rate" name="bill_rate" type="number" step={0.01} defaultValue={((shifts[0]?.bill_rate_cents ?? armedLevels[1].rateCents!) / 100).toFixed(2)} /></Field>
                                <div className="row" style={{ alignItems: 'flex-end' }}><button className="btn btn--ghost" type="submit">Add shift</button></div>
                            </form>
                        </details>
                    ) : null}
                </section>

                <section className="card">
                    <div className="card__title"><h2>Invoices</h2></div>
                    {invoices.length ? (
                        <div className="table-wrap"><table>
                            <thead><tr><th>Number</th><th>Kind</th><th className="num">Total</th><th className="num">Paid</th><th>Status</th></tr></thead>
                            <tbody>{invoices.map((i) => <tr key={i.id}><td><Link href={`/portal/invoices/${i.id}`} className="mono">{i.invoice_number}</Link></td><td>{i.kind}</td><td className="num"><Money cents={i.total_cents} /></td><td className="num"><Money cents={i.amount_paid_cents} /></td><td><Badge status={i.status} /></td></tr>)}</tbody>
                        </table></div>
                    ) : <p className="small muted">No invoices yet.</p>}
                    <div className="row mt-4">
                        {job.deposit_pct > 0 && !hasDeposit ? <form action={generateInvoiceFromJob}><input type="hidden" name="job_id" value={id} /><input type="hidden" name="kind" value="deposit" /><button className="btn btn--gold" type="submit">Generate deposit invoice ({job.deposit_pct}%)</button></form> : null}
                        <form action={generateInvoiceFromJob}><input type="hidden" name="job_id" value={id} /><input type="hidden" name="kind" value={hasDeposit ? 'balance' : 'standard'} /><button className="btn btn--ghost" type="submit">{hasDeposit ? 'Generate balance invoice' : 'Generate invoice from shifts'}</button></form>
                    </div>
                </section>

                {open ? (
                    <section className="card">
                        <h2 className="mb-4">Complete the job</h2>
                        <form action={setJobStatus} className="stack">
                            <input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="completed" />
                            <Field id="completion_summary" label="Summary for the client (optional)"><textarea id="completion_summary" name="completion_summary" rows={3} placeholder="Two Level III officers on post 8pm–2am. No incidents. Cash drop escorted at 1:50am." /></Field>
                            <div className="row"><button className="btn btn--gold" type="submit">Mark completed & email summary</button></div>
                        </form>
                    </section>
                ) : review ? (
                    <section className="card"><h2 className="mb-2">Review</h2><p>{review.status === 'submitted' ? `${review.rating}/5 — ${review.body ?? 'no comment'}${review.permission_to_publish ? ' (may publish)' : ''}` : `Requested ${fmtDateTime(review.requested_at)}; not yet submitted.`}</p></section>
                ) : null}

                <details className="card"><summary style={{ cursor: 'pointer', fontWeight: 700 }}>Edit job details & brief</summary>
                    <form action={updateJob} className="stack mt-4">
                        <input type="hidden" name="id" value={id} />
                        <JobFields job={job} clients={clients} sites={sites} />
                        <div className="row"><button className="btn btn--gold" type="submit">Save job</button></div>
                    </form>
                </details>
                <Timeline events={events} />
                {site ? <section className="card"><h2 className="mb-2">Site</h2><dl className="kv"><dt>Name</dt><dd>{site.name}</dd><dt>Address</dt><dd>{[site.address_line1, site.address_line2, site.city && `${site.city}, ${site.state} ${site.postal_code ?? ''}`].filter(Boolean).join('\n')}</dd><dt>Access</dt><dd>{site.access_notes ?? '—'}</dd><dt>Parking</dt><dd>{site.parking_notes ?? '—'}</dd><dt>Gear</dt><dd>{site.gear_notes ?? '—'}</dd></dl></section> : null}
            </div>
        </>
    );
}
