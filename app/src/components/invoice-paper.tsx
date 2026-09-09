import { site, invoiceDefaults, logoSrc } from '@/lib/shared';
import { formatMoney } from '@/lib/money';
import { fmtDateOnly } from '@/lib/format';
import type { Invoice } from '@/lib/db/types';

/** The invoice document: gold-on-white, prints on one Letter page. */
export function InvoicePaper({ invoice, payUrl, qrSvg }: { invoice: Invoice; payUrl?: string | null; qrSvg?: string | null }) {
    const balance = Math.max(0, invoice.total_cents - invoice.amount_paid_cents);
    return (
        <article className="paper" aria-label={`Invoice ${invoice.invoice_number}`}>
            <header className="paper__brand">
                <div className="row" style={{ gap: 12 }}>
                    <img src={logoSrc} alt="" width={56} height={56} />
                    <div><div className="paper__name">{site.name}</div><div className="paper__motto">{site.motto}</div></div>
                </div>
                <address className="paper__contact" style={{ fontStyle: 'normal' }}>
                    {site.address.locality}, {site.address.region}<br />{site.phone.display}<br />{site.email}<br />
                    <span className="small">{site.licenseNumber.label} {site.licenseNumber.value}</span>
                </address>
            </header>

            <div className="row row--between mb-4">
                <h1 style={{ fontSize: 24 }}>Invoice</h1>
                <span className="badge">{invoice.status.replace('_', ' ')}{invoice.kind !== 'standard' ? ` · ${invoice.kind}` : ''}</span>
            </div>

            <div className="grid grid--2">
                <div>
                    <div className="paper__label">Bill to</div>
                    <p><strong>{invoice.client_name}</strong>{invoice.client_company ? <><br />{invoice.client_company}</> : null}{invoice.client_address ? <><br /><span style={{ whiteSpace: 'pre-line' }}>{invoice.client_address}</span></> : null}{invoice.client_email ? <><br />{invoice.client_email}</> : null}{invoice.client_phone ? <><br />{invoice.client_phone}</> : null}</p>
                </div>
                <dl className="kv">
                    <dt>Invoice №</dt><dd className="mono">{invoice.invoice_number}</dd>
                    <dt>Issue date</dt><dd>{fmtDateOnly(invoice.issue_date)}</dd>
                    <dt>Terms</dt><dd>{invoice.payment_terms}</dd>
                    <dt>Due date</dt><dd>{fmtDateOnly(invoice.due_date)}</dd>
                </dl>
            </div>

            <table className="mt-4">
                <thead><tr><th>Service</th><th className="num">Officers</th><th className="num">Hours</th><th className="num">Rate</th><th className="num">Amount</th></tr></thead>
                <tbody>
                    {invoice.line_items.map((l, i) => (
                        <tr key={i}><td>{l.description}</td><td className="num">{l.officers}</td><td className="num">{l.hours}</td><td className="num">{formatMoney(l.rate_cents)}</td><td className="num">{formatMoney(l.amount_cents)}</td></tr>
                    ))}
                </tbody>
            </table>
            <div className="paper__totals">
                <div><span>Subtotal</span><span>{formatMoney(invoice.subtotal_cents)}</span></div>
                {invoice.tax_rate_pct > 0 ? <div><span>Sales tax ({invoice.tax_rate_pct}%)</span><span>{formatMoney(invoice.tax_cents)}</span></div> : null}
                <div className="total"><span>Total</span><span>{formatMoney(invoice.total_cents)}</span></div>
                {invoice.amount_paid_cents > 0 ? <><div><span>Paid</span><span>−{formatMoney(invoice.amount_paid_cents)}</span></div><div className="total"><span>Balance due</span><span>{formatMoney(balance)}</span></div></> : null}
            </div>

            {invoice.notes ? <section className="paper__section"><div className="paper__label">Notes</div><p>{invoice.notes}</p></section> : null}
            {invoice.terms ? <section className="paper__section"><div className="paper__label">Terms</div><p>{invoice.terms}</p></section> : null}
            <section className="paper__section row row--between" style={{ alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                    <div className="paper__label">{invoiceDefaults.paymentCopy.heading}</div>
                    <p>{invoiceDefaults.paymentCopy.instructions}</p>
                    {payUrl && balance > 0 ? <p className="small"><a href={payUrl}>{payUrl.replace(/^https?:\/\//, '')}</a></p> : null}
                    <p className="small">Questions: {site.email} · {site.phone.display}</p>
                </div>
                {qrSvg && balance > 0 ? <div className="qr" aria-label="Scan to pay" role="img" dangerouslySetInnerHTML={{ __html: qrSvg }} /> : null}
            </section>
        </article>
    );
}
