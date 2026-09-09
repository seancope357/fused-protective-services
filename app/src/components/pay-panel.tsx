import { Badge, Money } from '@/components/ui';
import { startCheckout } from '@/lib/actions/pay';
import { stripeConfigured, balanceCents } from '@/lib/stripe';
import { fmtDateOnly, fmtDateTime } from '@/lib/format';
import { site } from '@/lib/shared';
import type { Invoice, Payment } from '@/lib/db/types';

/** Shared by the client portal and the public /pay page. */
export function PayPanel({ invoice, payments, status, returnTo }: { invoice: Invoice; payments: Payment[]; status?: string; returnTo?: string }) {
    const balance = balanceCents(invoice);
    const settled = balance <= 0 || invoice.status === 'void';
    const banner =
        status === 'received' ? { tone: 'good', text: 'Payment submitted. Card payments confirm within seconds; bank transfers can take a few business days. Your receipt is emailed when Stripe confirms the funds — this page updates from that confirmation, not from the redirect.' } :
        status === 'cancelled' ? { tone: 'warn', text: 'Checkout was cancelled. Nothing was charged.' } :
        status === 'settled' ? { tone: 'good', text: 'This invoice is already settled.' } :
        status === 'unavailable' ? { tone: 'bad', text: `Online payment is not configured. Please remit by check or call ${site.phone.display}.` } :
        status === 'error' ? { tone: 'bad', text: `We could not start checkout. Please try again or call ${site.phone.display}.` } : null;

    return (
        <>
            <section className="card card--gold">
                <div className="card__title"><h2>{settled ? 'Settled' : 'Pay this invoice'}</h2><Badge status={invoice.status} /></div>
                {banner ? <p className={`alert alert--${banner.tone}`} role="status" aria-live="polite">{banner.text}</p> : null}
                <dl className="kv mt-4">
                    <dt>Total</dt><dd><Money cents={invoice.total_cents} /></dd>
                    <dt>Paid</dt><dd><Money cents={invoice.amount_paid_cents} /></dd>
                    <dt>Balance</dt><dd><strong><Money cents={balance} /></strong></dd>
                    <dt>Due</dt><dd>{fmtDateOnly(invoice.due_date)} ({invoice.payment_terms})</dd>
                </dl>
                {!settled ? (
                    stripeConfigured() ? (
                        <form action={startCheckout} className="mt-4">
                            <input type="hidden" name="token" value={invoice.pay_token} />
                            {returnTo ? <input type="hidden" name="return_to" value={returnTo} /> : null}
                            <button className="btn btn--gold btn--block" type="submit">Pay <Money cents={balance} /> by card or bank transfer</button>
                            <p className="small muted mt-2">Secure checkout by Stripe. The amount is fixed to this invoice's balance.</p>
                        </form>
                    ) : (
                        <p className="alert alert--warn mt-4">Online payment is not available yet. Please remit by check payable to {site.name}, or call {site.phone.display}.</p>
                    )
                ) : null}
            </section>
            {payments.length ? <section className="card"><h2 className="mb-4">Payment history</h2><div className="table-wrap"><table><thead><tr><th>Date</th><th>Method</th><th className="num">Amount</th><th>Status</th></tr></thead><tbody>{payments.map((p) => <tr key={p.id}><td className="small">{fmtDateTime(p.received_at)}</td><td>{p.method === 'us_bank_account' ? 'Bank transfer' : p.method}</td><td className="num"><Money cents={p.amount_cents} /></td><td><Badge status={p.status} /></td></tr>)}</tbody></table></div></section> : null}
        </>
    );
}
