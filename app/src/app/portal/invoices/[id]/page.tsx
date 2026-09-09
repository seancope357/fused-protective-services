import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getInvoice, listPayments } from '@/lib/domain/queries';
import { PageHead, Badge, Money, Field } from '@/components/ui';
import { StatusFromSearch, type SearchStatus } from '@/components/status-from-search';
import { updateInvoice, sendInvoice, voidInvoice, recordManualPayment } from '@/lib/actions/invoices';
import { InvoicePaper } from '@/components/invoice-paper';
import { fmtDateTime } from '@/lib/format';
import { netTerms, appUrl } from '@/lib/shared';
import { qrSvg } from '@/lib/qr';
import { PrintButton } from '@/components/print-button';

export const dynamic = 'force-dynamic';

export default async function InvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchStatus> }) {
    const { id } = await params;
    const invoice = await getInvoice(id);
    if (!invoice) notFound();
    const payments = await listPayments(id);
    const editable = invoice.status === 'draft';
    const payUrl = `${appUrl()}/pay/${invoice.pay_token}`;
    const qr = invoice.status !== 'draft' && invoice.status !== 'void' ? await qrSvg(payUrl) : null;
    const lines = editable && invoice.line_items.length === 0 ? [{ description: '', officers: 1, hours: 8, rate_cents: 6500, amount_cents: 0 }] : invoice.line_items;

    return (
        <>
            <PageHead eyebrow={`Invoice ${invoice.invoice_number}`} title={invoice.client_company || invoice.client_name}
                actions={
                    <>
                        <PrintButton />
                        {!['paid', 'void'].includes(invoice.status) ? <form action={sendInvoice}><input type="hidden" name="id" value={id} /><button className="btn btn--gold" type="submit">{invoice.status === 'draft' ? 'Send with pay link' : 'Resend'}</button></form> : null}
                        {invoice.status !== 'void' && invoice.amount_paid_cents === 0 ? <form action={voidInvoice}><input type="hidden" name="id" value={id} /><button className="btn btn--danger" type="submit">Void</button></form> : null}
                    </>
                }>
                <Badge status={invoice.status} /> · <Money cents={invoice.total_cents} /> · paid <Money cents={invoice.amount_paid_cents} />
                {invoice.sent_at ? ` · sent ${fmtDateTime(invoice.sent_at)}` : ''}{invoice.paid_at ? ` · paid ${fmtDateTime(invoice.paid_at)}` : ''}
                {invoice.job_id ? <> · <Link href={`/portal/jobs/${invoice.job_id}`}>job</Link></> : null}
                {invoice.legacy_source ? ' · imported from the browser tool' : ''}
            </PageHead>
            <StatusFromSearch params={await searchParams} />

            <div className="grid grid--2 mt-4" style={{ alignItems: 'start' }}>
                <div className="stack no-print">
                    {editable ? (
                        <form action={updateInvoice} className="card stack">
                            <input type="hidden" name="id" value={id} />
                            <h2>Bill to</h2>
                            <div className="form-grid">
                                <Field id="client_name" label="Contact"><input id="client_name" name="client_name" defaultValue={invoice.client_name} required /></Field>
                                <Field id="client_company" label="Company"><input id="client_company" name="client_company" defaultValue={invoice.client_company ?? ''} /></Field>
                                <Field id="client_email" label="Email"><input id="client_email" name="client_email" type="email" defaultValue={invoice.client_email ?? ''} /></Field>
                                <Field id="client_phone" label="Phone"><input id="client_phone" name="client_phone" defaultValue={invoice.client_phone ?? ''} /></Field>
                                <Field id="client_address" label="Address" className="span-2"><textarea id="client_address" name="client_address" rows={2} defaultValue={invoice.client_address ?? ''} /></Field>
                                <Field id="issue_date" label="Issue date"><input id="issue_date" name="issue_date" type="date" defaultValue={invoice.issue_date} /></Field>
                                <Field id="net_term_id" label="Terms"><select id="net_term_id" name="net_term_id" defaultValue={invoice.net_term_id}>{netTerms.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></Field>
                                <Field id="due_date" label="Due date"><input id="due_date" name="due_date" type="date" defaultValue={invoice.due_date} /></Field>
                                <Field id="tax_rate_pct" label="Tax %"><input id="tax_rate_pct" name="tax_rate_pct" type="number" step={0.001} min={0} defaultValue={invoice.tax_rate_pct} /></Field>
                            </div>
                            <h2>Lines</h2>
                            <div className="table-wrap"><table>
                                <thead><tr><th>Description</th><th>Officers</th><th>Hours</th><th>Rate $</th></tr></thead>
                                <tbody>
                                    {[...lines, { description: '', officers: 1, hours: 0, rate_cents: 0, amount_cents: 0 }].map((l, i) => (
                                        <tr key={i}>
                                            <td><input name="line_desc" defaultValue={l.description} aria-label={`Line ${i + 1} description`} placeholder={i === lines.length ? 'Add another line…' : ''} style={{ width: '100%' }} /><input type="hidden" name="line_shift" value={l.shift_id ?? ''} /></td>
                                            <td><input name="line_officers" type="number" min={0} step={1} defaultValue={l.officers} aria-label={`Line ${i + 1} officers`} style={{ width: 70 }} /></td>
                                            <td><input name="line_hours" type="number" min={0} step={0.25} defaultValue={l.hours} aria-label={`Line ${i + 1} hours`} style={{ width: 80 }} /></td>
                                            <td><input name="line_rate" type="number" step={0.01} defaultValue={(l.rate_cents / 100).toFixed(2)} aria-label={`Line ${i + 1} rate`} style={{ width: 100 }} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table></div>
                            <Field id="notes" label="Notes (printed)"><textarea id="notes" name="notes" rows={2} defaultValue={invoice.notes ?? ''} /></Field>
                            <Field id="terms" label="Terms (printed)"><textarea id="terms" name="terms" rows={3} defaultValue={invoice.terms ?? ''} /></Field>
                            <div className="row"><button className="btn btn--gold" type="submit">Save & recalculate</button></div>
                        </form>
                    ) : (
                        <section className="card"><h2 className="mb-2">Locked</h2><p className="small">Sent invoices are not edited. Void this one and issue a new invoice to change it. Payments below come from Stripe's webhook or a manual record.</p></section>
                    )}

                    <section className="card">
                        <h2 className="mb-4">Payments</h2>
                        {payments.length ? (
                            <div className="table-wrap"><table>
                                <thead><tr><th>Received</th><th>Method</th><th className="num">Amount</th><th>Status</th></tr></thead>
                                <tbody>{payments.map((p) => <tr key={p.id}><td className="mono small">{fmtDateTime(p.received_at)}</td><td>{p.method}</td><td className="num"><Money cents={p.amount_cents} /></td><td><Badge status={p.status} />{p.failure_message ? <div className="small muted">{p.failure_message}</div> : null}</td></tr>)}</tbody>
                            </table></div>
                        ) : <p className="small muted">No payments yet.</p>}
                        {!['paid', 'void', 'draft'].includes(invoice.status) ? (
                            <details className="mt-4"><summary style={{ cursor: 'pointer' }}>Record a check or wire</summary>
                                <form action={recordManualPayment} className="form-grid mt-4">
                                    <input type="hidden" name="id" value={id} />
                                    <Field id="amount" label="Amount $"><input id="amount" name="amount" type="number" step={0.01} min={0.01} defaultValue={((invoice.total_cents - invoice.amount_paid_cents) / 100).toFixed(2)} required /></Field>
                                    <Field id="method" label="Method"><select id="method" name="method" defaultValue="check"><option value="check">Check</option><option value="wire">Wire</option><option value="cash">Cash</option><option value="other">Other</option></select></Field>
                                    <Field id="note" label="Note" className="span-2"><input id="note" name="note" placeholder="Check #1042" /></Field>
                                    <div className="row"><button className="btn btn--ghost" type="submit">Record payment</button></div>
                                </form>
                            </details>
                        ) : null}
                        {invoice.status !== 'draft' ? <p className="small mt-4">Pay link: <a href={payUrl} className="mono">{payUrl}</a></p> : null}
                    </section>
                </div>
                <InvoicePaper invoice={invoice} payUrl={invoice.status !== 'draft' ? payUrl : null} qrSvg={qr} />
            </div>
        </>
    );
}
