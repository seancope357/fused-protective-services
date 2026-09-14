import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getInvoice, listPayments } from '@/lib/domain/queries';
import { PageHead, Badge, Money, Field, Disclosure } from '@/components/ui';
import { DataTable, type Column } from '@/components/data-table';
import { StatusFromSearch, type SearchStatus } from '@/components/status-from-search';
import { updateInvoice, sendInvoice, voidInvoice, recordManualPayment } from '@/lib/actions/invoices';
import { InvoicePaper } from '@/components/invoice-paper';
import { fmtDateTime } from '@/lib/format';
import { netTerms, appUrl } from '@/lib/shared';
import { qrSvg } from '@/lib/qr';
import { PrintButton } from '@/components/print-button';
import { timelineFor } from '@/lib/domain/timeline';
import { Timeline } from '@/components/timeline';

export const dynamic = 'force-dynamic';

type Payment = Awaited<ReturnType<typeof listPayments>>[number];

/* A payment has no page of its own; the amount is the card title as plain text. */
const paymentColumns: Column<Payment>[] = [
    { key: 'received', header: 'Received', cell: (p) => <span className="mono small">{fmtDateTime(p.received_at)}</span> },
    { key: 'method', header: 'Method', cell: (p) => p.method },
    { key: 'amount', header: 'Amount', num: true, primary: true, cell: (p) => <Money cents={p.amount_cents} /> },
    {
        key: 'status',
        header: 'Status',
        cell: (p) => (
            <div>
                <Badge status={p.status} />
                {p.failure_message ? <div className="small muted wrap-anywhere">{p.failure_message}</div> : null}
            </div>
        )
    }
];

export default async function InvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchStatus> }) {
    const { id } = await params;
    const invoice = await getInvoice(id);
    if (!invoice) notFound();
    const payments = await listPayments(id);
    const editable = invoice.status === 'draft';
    const payUrl = `${appUrl()}/pay/${invoice.pay_token}`;
    const qr = invoice.status !== 'draft' && invoice.status !== 'void' ? await qrSvg(payUrl) : null;
    const events = await timelineFor({ entityType: 'invoice', id, related: payments.map((p) => ({ entityType: 'payment', id: p.id })) });
    const lines = editable && invoice.line_items.length === 0 ? [{ description: '', officers: 1, hours: 8, rate_cents: 6500, amount_cents: 0 }] : invoice.line_items;
    /* The editor always offers one empty line after the real ones. Rows are
       rendered in order, so the form posts line_* values in the same order the
       action pairs them up. */
    const lineRows = [...lines, { description: '', officers: 1, hours: 0, rate_cents: 0, amount_cents: 0 }].map((line, index) => ({ line: line as (typeof lines)[number], index }));
    type LineRow = (typeof lineRows)[number];
    const lineColumns: Column<LineRow>[] = [
        {
            key: 'description',
            header: 'Description',
            primary: true,
            cell: ({ line, index }) => (
                <div className="field">
                    <input name="line_desc" defaultValue={line.description} aria-label={`Line ${index + 1} description`} placeholder={index === lines.length ? 'Add another line…' : ''} autoComplete="off" enterKeyHint="next" />
                    <input type="hidden" name="line_shift" value={line.shift_id ?? ''} />
                </div>
            )
        },
        {
            key: 'officers',
            header: 'Officers',
            cell: ({ line, index }) => (
                <div className="field"><input name="line_officers" type="number" inputMode="numeric" min={0} step={1} defaultValue={line.officers} aria-label={`Line ${index + 1} officers`} enterKeyHint="next" style={{ width: 72 }} /></div>
            )
        },
        {
            key: 'hours',
            header: 'Hours',
            cell: ({ line, index }) => (
                <div className="field"><input name="line_hours" type="number" inputMode="decimal" min={0} step={0.25} defaultValue={line.hours} aria-label={`Line ${index + 1} hours`} enterKeyHint="next" style={{ width: 84 }} /></div>
            )
        },
        {
            key: 'rate',
            header: 'Rate $',
            cell: ({ line, index }) => (
                <div className="field"><input name="line_rate" type="number" inputMode="decimal" step={0.01} defaultValue={(line.rate_cents / 100).toFixed(2)} aria-label={`Line ${index + 1} rate`} enterKeyHint="next" style={{ width: 104 }} /></div>
            )
        }
    ];

    /* The one action that gets this invoice paid: send it (or send it again).
       Recording a check needs an amount, so it stays in the Payments card; void
       is destructive and never the pinned action. */
    const payable = !['paid', 'void'].includes(invoice.status);

    return (
        <>
            <PageHead
                eyebrow={`Invoice ${invoice.invoice_number}`}
                title={invoice.client_company || invoice.client_name}
                actions={
                    <>
                        <PrintButton />
                        {invoice.status !== 'void' && invoice.amount_paid_cents === 0 ? <form action={voidInvoice}><input type="hidden" name="id" value={id} /><button className="btn btn--danger" type="submit">Void</button></form> : null}
                    </>
                }
                primary={
                    payable ? (
                        <form action={sendInvoice}>
                            <input type="hidden" name="id" value={id} />
                            <button className="btn btn--gold" type="submit">{invoice.status === 'draft' ? 'Send with pay link' : 'Resend'}</button>
                        </form>
                    ) : undefined
                }
            >
                <Badge status={invoice.status} /> · <Money cents={invoice.total_cents} /> · paid <Money cents={invoice.amount_paid_cents} />
                {invoice.sent_at ? ` · sent ${fmtDateTime(invoice.sent_at)}` : ''}{invoice.paid_at ? ` · paid ${fmtDateTime(invoice.paid_at)}` : ''}
                {invoice.job_id ? <> · <Link href={`/portal/jobs/${invoice.job_id}`}>job</Link></> : null}
                {invoice.legacy_source ? ' · imported from the old invoice tool' : ''}
            </PageHead>
            <StatusFromSearch params={await searchParams} />

            <div className="grid grid--2 mt-4 align-start">
                <div className="stack no-print">
                    {editable ? (
                        <form action={updateInvoice} className="card stack">
                            <input type="hidden" name="id" value={id} />
                            <h2>Bill to</h2>
                            {/* These are the client's details, not the signed-in
                                user's: autofill would offer Cameron's own. */}
                            <div className="form-grid">
                                <Field id="client_name" label="Contact"><input id="client_name" name="client_name" defaultValue={invoice.client_name} required autoComplete="off" enterKeyHint="next" /></Field>
                                <Field id="client_company" label="Company"><input id="client_company" name="client_company" defaultValue={invoice.client_company ?? ''} autoComplete="off" enterKeyHint="next" /></Field>
                                <Field id="client_email" label="Email"><input id="client_email" name="client_email" type="email" inputMode="email" defaultValue={invoice.client_email ?? ''} autoComplete="off" autoCapitalize="off" spellCheck={false} enterKeyHint="next" /></Field>
                                <Field id="client_phone" label="Phone"><input id="client_phone" name="client_phone" type="tel" inputMode="tel" defaultValue={invoice.client_phone ?? ''} autoComplete="off" enterKeyHint="next" /></Field>
                                <Field id="client_address" label="Address" className="span-2"><textarea id="client_address" name="client_address" rows={2} defaultValue={invoice.client_address ?? ''} autoComplete="off" /></Field>
                                <Field id="issue_date" label="Issue date"><input id="issue_date" name="issue_date" type="date" defaultValue={invoice.issue_date} /></Field>
                                <Field id="net_term_id" label="Terms"><select id="net_term_id" name="net_term_id" defaultValue={invoice.net_term_id}>{netTerms.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></Field>
                                <Field id="due_date" label="Due date"><input id="due_date" name="due_date" type="date" defaultValue={invoice.due_date} /></Field>
                                <Field id="tax_rate_pct" label="Tax %"><input id="tax_rate_pct" name="tax_rate_pct" type="number" inputMode="decimal" step={0.001} min={0} defaultValue={invoice.tax_rate_pct} enterKeyHint="next" /></Field>
                            </div>
                            <h2>Lines</h2>
                            <DataTable caption="Invoice lines" columns={lineColumns} rows={lineRows} rowKey={(r) => String(r.index)} flush />
                            <Field id="notes" label="Notes (printed)"><textarea id="notes" name="notes" rows={2} defaultValue={invoice.notes ?? ''} /></Field>
                            <Field id="terms" label="Terms (printed)"><textarea id="terms" name="terms" rows={3} defaultValue={invoice.terms ?? ''} /></Field>
                            <div className="row">
                                <button className="btn btn--gold" type="submit">Save & recalculate</button>
                                <span className="small muted">Save before sending: the client gets the last saved version.</span>
                            </div>
                        </form>
                    ) : (
                        <section className="card"><h2 className="mb-2">Locked</h2><p className="small">A sent invoice can’t be edited. To change it, void this one and create a new invoice. Payments below appear on their own when the client pays online, or when you record a check or wire.</p></section>
                    )}

                    <section className="card">
                        <h2 className="mb-4">Payments</h2>
                        {payments.length ? (
                            <DataTable caption="Payments" columns={paymentColumns} rows={payments} rowKey={(p) => p.id} flush />
                        ) : <p className="small muted">No payments yet.</p>}
                        {!['paid', 'void', 'draft'].includes(invoice.status) ? (
                            <Disclosure summary="Record a check or wire" className="mt-4">
                                <form action={recordManualPayment} className="form-grid mt-2">
                                    <input type="hidden" name="id" value={id} />
                                    <Field id="amount" label="Amount $"><input id="amount" name="amount" type="number" inputMode="decimal" step={0.01} min={0.01} defaultValue={((invoice.total_cents - invoice.amount_paid_cents) / 100).toFixed(2)} required enterKeyHint="next" /></Field>
                                    <Field id="method" label="Method"><select id="method" name="method" defaultValue="check"><option value="check">Check</option><option value="wire">Wire</option><option value="cash">Cash</option><option value="other">Other</option></select></Field>
                                    <Field id="note" label="Note" className="span-2"><input id="note" name="note" placeholder="Check #1042" autoComplete="off" enterKeyHint="done" /></Field>
                                    <div className="row"><button className="btn btn--ghost" type="submit">Record payment</button></div>
                                </form>
                            </Disclosure>
                        ) : null}
                        {invoice.status !== 'draft' ? <p className="small mt-4 wrap-anywhere">Pay link: <a href={payUrl} className="mono">{payUrl}</a></p> : null}
                    </section>
                    <Timeline events={events} />
                </div>
                <InvoicePaper invoice={invoice} payUrl={invoice.status !== 'draft' ? payUrl : null} qrSvg={qr} />
            </div>
        </>
    );
}
