import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getJob, getClient, getSite, listShifts, listInvoicesForJob, listClients, listAllSites, getReviewByJob } from '@/lib/domain/queries';
import { PageHead, Badge, Money, Field, Empty, Disclosure } from '@/components/ui';
import { DataTable, type Column } from '@/components/data-table';
import { StatusFromSearch, type SearchStatus } from '@/components/status-from-search';
import { JobFields, describeRecurrence } from '@/components/job-form';
import { updateJob, saveShift, deleteShift, confirmJob, setJobStatus } from '@/lib/actions/jobs';
import { generateInvoiceFromJob } from '@/lib/actions/invoices';
import { fmtDateTime, fmtTime, titleCase } from '@/lib/format';
import { armedLevels } from '@/lib/shared';
import { isoToLocal } from '@/lib/actions/util';
import { lineCents } from '@/lib/money';
import { timelineFor } from '@/lib/domain/timeline';
import { Timeline } from '@/components/timeline';

export const dynamic = 'force-dynamic';

type ShiftRow = Awaited<ReturnType<typeof listShifts>>[number];
type InvoiceRow = Awaited<ReturnType<typeof listInvoicesForJob>>[number];

const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;

export default async function JobPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchStatus> }) {
    const { id } = await params;
    const job = await getJob(id);
    if (!job) notFound();
    const [client, site, shifts, invoices, clients, sites, review] = await Promise.all([
        getClient(job.client_id), getSite(job.site_id), listShifts(id), listInvoicesForJob(id), listClients(), listAllSites(), getReviewByJob(id)
    ]);
    const billable = shifts.filter((s) => s.status !== 'cancelled');
    /* A standing detail can carry dozens of shifts; on a phone that is a scroll of
       cards. Lead with the next few that have not ended; the rest sit collapsed. */
    const NEXT_SHIFTS = 6;
    const nowMs = Date.now();
    const notEnded = shifts.filter((s) => s.status !== 'cancelled' && new Date(s.ends_at).getTime() >= nowMs);
    const nextShifts = (notEnded.length ? notEnded : shifts).slice(0, NEXT_SHIFTS);
    const estimate = billable.reduce((sum, s) => sum + lineCents(s.officers_required, (new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime()) / 3600000, s.bill_rate_cents), 0);
    const hasDeposit = invoices.some((i) => i.kind === 'deposit' && i.status !== 'void');
    // A completed job's next step is its final invoice, unless one already exists.
    const hasFinalInvoice = invoices.some((i) => (i.kind === 'standard' || i.kind === 'balance') && i.status !== 'void');
    const events = await timelineFor({ entityType: 'job', id, related: [...invoices.map((i) => ({ entityType: 'invoice', id: i.id })), ...(review ? [{ entityType: 'review', id: review.id }] : []), ...(job.quote_id ? [{ entityType: 'quote', id: job.quote_id }] : [])] });
    const open = job.status === 'scheduled' || job.status === 'in_progress';
    const repeats = describeRecurrence(job.recurrence_rule, job.recurrence_until);

    /* The job's own on-site contact wins; the site's is the fallback. Taken as a
       pair so a name is never shown beside someone else's number. */
    const contact = job.onsite_contact_name || job.onsite_contact_phone
        ? { name: job.onsite_contact_name, phone: job.onsite_contact_phone }
        : { name: site?.onsite_contact_name ?? null, phone: site?.onsite_contact_phone ?? null };

    const shiftColumns: Column<ShiftRow>[] = [
        // Shifts have no page of their own: the start is the card title, not a link.
        { key: 'start', header: 'Start', primary: true, cell: (s) => <span className="mono">{fmtDateTime(s.starts_at)}</span> },
        { key: 'end', header: 'End', cell: (s) => <span className="mono small">{fmtTime(s.ends_at)}</span> },
        { key: 'officers', header: 'Officers', num: true, cell: (s) => s.officers_required },
        { key: 'level', header: 'Level', cell: (s) => <span className="small">{armedLevels.find((l) => l.id === s.armed_level)?.label ?? s.armed_level}</span> },
        { key: 'rate', header: 'Rate', num: true, hide: 'phone', cell: (s) => <Money cents={s.bill_rate_cents} /> },
        { key: 'status', header: 'Status', cell: (s) => <Badge status={s.status} /> },
        ...(open ? [{
            key: 'actions',
            header: '',
            cell: (s: ShiftRow) => <form action={deleteShift}><input type="hidden" name="job_id" value={id} /><input type="hidden" name="id" value={s.id} /><button className="btn btn--danger btn--sm" type="submit" aria-label={`Remove shift ${fmtDateTime(s.starts_at)}`}>Remove</button></form>
        }] : [])
    ];

    const invoiceColumns: Column<InvoiceRow>[] = [
        { key: 'number', header: 'Number', primary: true, cell: (i) => <Link href={`/portal/invoices/${i.id}`} className="mono">{i.invoice_number}</Link> },
        { key: 'kind', header: 'Kind', cell: (i) => titleCase(i.kind) },
        { key: 'total', header: 'Total', num: true, cell: (i) => <Money cents={i.total_cents} /> },
        { key: 'paid', header: 'Paid', num: true, hide: 'phone', cell: (i) => <Money cents={i.amount_paid_cents} /> },
        { key: 'status', header: 'Status', cell: (i) => <Badge status={i.status} /> }
    ];

    const finalKind = hasDeposit ? 'balance' : 'standard';
    const primary = open ? (
        <form action={confirmJob}><input type="hidden" name="id" value={id} /><button className="btn btn--gold" type="submit">{job.confirmed_at ? 'Resend brief' : 'Confirm & send brief'}</button></form>
    ) : job.status === 'completed' && !hasFinalInvoice ? (
        <form action={generateInvoiceFromJob}><input type="hidden" name="job_id" value={id} /><input type="hidden" name="kind" value={finalKind} /><button className="btn btn--gold" type="submit">{hasDeposit ? 'Generate balance invoice' : 'Generate invoice'}</button></form>
    ) : undefined;

    return (
        <>
            <PageHead eyebrow={`Job ${job.job_number}`} title={job.title}
                primary={primary}
                actions={
                    open ? (
                        <>
                            {job.status === 'scheduled' ? <form action={setJobStatus}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="in_progress" /><button className="btn btn--ghost" type="submit">Start</button></form> : null}
                            <form action={setJobStatus}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="cancelled" /><button className="btn btn--danger" type="submit">Cancel job</button></form>
                        </>
                    ) : undefined
                }>
                <Badge status={job.status} /> · {client ? <Link href={`/portal/clients/${client.id}`}>{client.name}</Link> : '—'} · {fmtDateTime(job.starts_at)} – {fmtTime(job.ends_at)}{repeats ? ` · ${repeats}` : ''}
                {job.confirmed_at ? ` · brief sent ${fmtDateTime(job.confirmed_at)}` : open ? <> · <span className="status-warn">brief not sent yet</span></> : null}
                {job.quote_id ? <> · <Link href={`/portal/quotes/${job.quote_id}`}>from quote</Link></> : null}
            </PageHead>
            <StatusFromSearch params={await searchParams} />

            {/* Order is what someone working the detail needs first: when, where and
                how to get in; then money, wrap-up, editing, and the history last. */}
            <div className="stack mt-4">
                <section className="card">
                    <div className="card__title"><h2>Shifts</h2><span className="small muted">{billable.length} billable · estimate <Money cents={estimate} /></span></div>
                    {shifts.length ? (
                        <>
                            <DataTable caption={nextShifts.length < shifts.length ? 'Next shifts' : 'Shifts'} columns={shiftColumns} rows={nextShifts} rowKey={(s) => s.id} flush />
                            {nextShifts.length < shifts.length ? (
                                <Disclosure summary={`All ${shifts.length} shifts`} className="mt-4">
                                    <DataTable caption="All shifts" columns={shiftColumns} rows={shifts} rowKey={(s) => `all-${s.id}`} flush />
                                </Disclosure>
                            ) : null}
                        </>
                    ) : <Empty>No shifts yet.{open ? ' Add one below.' : ''}</Empty>}
                    {open ? (
                        <Disclosure summary="Add a shift" className="mt-4">
                            <form action={saveShift} className="form-grid mt-2">
                                <input type="hidden" name="job_id" value={id} />
                                <Field id="s_start" label="Starts"><input id="s_start" name="starts_at" type="datetime-local" defaultValue={isoToLocal(job.starts_at)} required /></Field>
                                <Field id="s_end" label="Ends"><input id="s_end" name="ends_at" type="datetime-local" defaultValue={isoToLocal(job.ends_at)} required /></Field>
                                <Field id="s_off" label="Officers"><input id="s_off" name="officers_required" type="number" inputMode="numeric" min={1} defaultValue={shifts[0]?.officers_required ?? 2} enterKeyHint="next" /></Field>
                                <Field id="s_lvl" label="Level"><select id="s_lvl" name="armed_level" defaultValue={shifts[0]?.armed_level ?? 'level-3'}>{armedLevels.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select></Field>
                                <Field id="s_rate" label="Rate $/hr"><input id="s_rate" name="bill_rate" type="number" inputMode="decimal" step={0.01} defaultValue={((shifts[0]?.bill_rate_cents ?? armedLevels[1].rateCents!) / 100).toFixed(2)} enterKeyHint="done" /></Field>
                                <div className="row span-2"><button className="btn btn--ghost" type="submit">Add shift</button></div>
                            </form>
                        </Disclosure>
                    ) : null}
                </section>

                <section className="card">
                    <h2 className="mb-2">On site</h2>
                    <dl className="kv">
                        {site ? (
                            <>
                                <dt>Site</dt><dd>{site.name}</dd>
                                <dt>Address</dt><dd>{[site.address_line1, site.address_line2, site.city && `${site.city}, ${site.state} ${site.postal_code ?? ''}`].filter(Boolean).join('\n') || '—'}</dd>
                            </>
                        ) : <><dt>Site</dt><dd>No site set</dd></>}
                        <dt>Arrival</dt><dd>{job.arrival_window ?? '—'}</dd>
                        <dt>Contact</dt><dd>{contact.name ?? '—'}{contact.phone ? <> · <a href={telHref(contact.phone)}>{contact.phone}</a></> : null}</dd>
                        {site ? (
                            <>
                                <dt>Access</dt><dd>{site.access_notes ?? '—'}</dd>
                                <dt>Parking</dt><dd>{site.parking_notes ?? '—'}</dd>
                                <dt>Gear</dt><dd>{site.gear_notes ?? '—'}</dd>
                            </>
                        ) : null}
                        {job.post_orders ? <><dt>Post orders</dt><dd>{job.post_orders}</dd></> : null}
                    </dl>
                </section>

                <section className="card">
                    <div className="card__title"><h2>Invoices</h2></div>
                    {invoices.length ? (
                        <DataTable caption="Invoices for this job" columns={invoiceColumns} rows={invoices} rowKey={(i) => i.id} flush />
                    ) : <p className="small muted">No invoices yet.</p>}
                    <div className="row mt-4">
                        {job.deposit_pct > 0 && !hasDeposit ? <form action={generateInvoiceFromJob}><input type="hidden" name="job_id" value={id} /><input type="hidden" name="kind" value="deposit" /><button className="btn btn--ghost" type="submit">Generate deposit invoice ({job.deposit_pct}%)</button></form> : null}
                        <form action={generateInvoiceFromJob}><input type="hidden" name="job_id" value={id} /><input type="hidden" name="kind" value={finalKind} /><button className="btn btn--ghost" type="submit">{hasDeposit ? 'Generate balance invoice' : 'Generate invoice from shifts'}</button></form>
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
                    <section className="card"><h2 className="mb-2">Review</h2><p>{review.status === 'submitted' ? `${review.rating}/5 — ${review.body ?? 'no comment'}${review.permission_to_publish ? ' (OK to publish)' : ''}` : `Requested ${fmtDateTime(review.requested_at)}; not yet submitted.`}</p></section>
                ) : null}

                <Disclosure summary="Edit job details & brief" className="card">
                    <form action={updateJob} className="stack mt-2">
                        <input type="hidden" name="id" value={id} />
                        <JobFields job={job} clients={clients} sites={sites} />
                        <div className="row"><button className="btn btn--gold" type="submit">Save job</button></div>
                    </form>
                </Disclosure>

                <Timeline events={events} />
            </div>
        </>
    );
}
