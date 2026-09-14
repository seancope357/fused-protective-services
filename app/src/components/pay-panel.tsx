import { Badge, Money } from '@/components/ui';
import { DataTable, type Column } from '@/components/data-table';
import { startCheckout } from '@/lib/actions/pay';
import { stripeConfigured, balanceCents } from '@/lib/stripe';
import { fmtDateOnly, fmtDateTime, statusLabel, titleCase } from '@/lib/format';
import { site } from '@/lib/shared';
import type { Invoice, Payment } from '@/lib/db/types';

/** Whether this invoice can be paid online right now. A page that pins the pay
    button in its action bar must ask this first: PageHead draws the bar for any
    truthy `primary`, and an element that renders nothing is still truthy. */
export const canPayOnline = (invoice: Invoice): boolean => balanceCents(invoice) > 0 && invoice.status !== 'void' && stripeConfigured();

/** The checkout form on its own, so the client portal can pin it in the page
    action bar. Only the token decides what is charged (see startCheckout). */
export function PayButton({ invoice, returnTo, block, children }: { invoice: Invoice; returnTo?: string; block?: boolean; children: React.ReactNode }) {
    return (
        <form action={startCheckout}>
            <input type="hidden" name="token" value={invoice.pay_token} />
            {returnTo ? <input type="hidden" name="return_to" value={returnTo} /> : null}
            <button className={`btn btn--gold${block ? ' btn--block' : ''}`} type="submit">{children}</button>
        </form>
    );
}

const paymentColumns: Column<Payment>[] = [
    { key: 'date', header: 'Date', cell: (p) => <span className="small">{fmtDateTime(p.received_at)}</span> },
    { key: 'method', header: 'Method', cell: (p) => <span>{p.method === 'us_bank_account' ? 'Bank transfer' : titleCase(statusLabel(p.method))}</span> },
    /* On a phone the amount is what a person looks for, so it titles the card. */
    { key: 'amount', header: 'Amount', primary: true, num: true, cell: (p) => <Money cents={p.amount_cents} /> },
    { key: 'status', header: 'Status', cell: (p) => <Badge status={p.status} /> }
];

/** Shared by the client portal and the public /pay page. The amount due and
    the pay button come first: most people arrive from an emailed link on a
    phone, and paying should not need a scroll. The breakdown follows.
    `payButton={false}` when the page already pins the button in its action bar. */
export function PayPanel({ invoice, payments, status, returnTo, payButton = true }: { invoice: Invoice; payments: Payment[]; status?: string; returnTo?: string; payButton?: boolean }) {
    const balance = balanceCents(invoice);
    const settled = balance <= 0 || invoice.status === 'void';
    const tel = <a href={`tel:${site.phone.e164}`}>{site.phone.display}</a>;
    const banner =
        status === 'received' ? { tone: 'good', text: <>Thank you — your payment is on its way. Card payments confirm within seconds; bank transfers can take a few business days. We email your receipt as soon as the payment clears, and this page shows it then.</> } :
        status === 'cancelled' ? { tone: 'warn', text: <>Checkout was cancelled. Nothing was charged.</> } :
        status === 'settled' ? { tone: 'good', text: <>This invoice is already paid. Thank you.</> } :
        status === 'unavailable' ? { tone: 'bad', text: <>Online payment isn&rsquo;t available right now. Please pay by check or call {tel}.</> } :
        status === 'error' ? { tone: 'bad', text: <>We couldn&rsquo;t open checkout. Please try again, or call {tel}.</> } : null;

    return (
        <>
            <section className="card card--gold" aria-labelledby="pay-panel-h">
                <div className="card__title">
                    <h2 id="pay-panel-h">{invoice.status === 'void' ? 'Nothing to pay' : settled ? 'Paid in full' : 'Pay this invoice'}</h2>
                    <Badge status={invoice.status} />
                </div>
                {banner ? <p className={`alert alert--${banner.tone} mb-4`} role="status" aria-live="polite">{banner.text}</p> : null}
                {!settled ? (
                    <>
                        <div className="stat">
                            <div className="stat__label">Amount due</div>
                            <div className="stat__value stat__value--gold"><Money cents={balance} /></div>
                            <div className="stat__hint">Due {fmtDateOnly(invoice.due_date)} · {invoice.payment_terms}</div>
                        </div>
                        {stripeConfigured() ? (
                            payButton ? (
                                <div className="mt-4">
                                    <PayButton invoice={invoice} returnTo={returnTo} block>Pay <Money cents={balance} /> by card or bank transfer</PayButton>
                                    <p className="small muted mt-2">Secure checkout by Stripe. You&rsquo;ll pay exactly the balance of this invoice.</p>
                                </div>
                            ) : (
                                <p className="small muted mt-2">Secure checkout by Stripe, by card or bank transfer. You&rsquo;ll pay exactly the balance of this invoice.</p>
                            )
                        ) : (
                            <p className="alert alert--warn mt-4">Online payment isn&rsquo;t available yet. You can pay by check made out to {site.name}, or call us at {tel}.</p>
                        )}
                    </>
                ) : null}
                <dl className="kv mt-4">
                    <dt>Total</dt><dd><Money cents={invoice.total_cents} /></dd>
                    <dt>Paid</dt><dd><Money cents={invoice.amount_paid_cents} /></dd>
                    {settled ? <><dt>Balance</dt><dd><strong><Money cents={balance} /></strong></dd></> : null}
                    <dt>Due</dt><dd>{fmtDateOnly(invoice.due_date)} ({invoice.payment_terms})</dd>
                </dl>
            </section>
            {payments.length ? (
                <section className="card">
                    <h2 className="mb-4">Payment history</h2>
                    <DataTable caption="Payment history" columns={paymentColumns} rows={payments} rowKey={(p) => p.id} flush />
                </section>
            ) : null}
        </>
    );
}
