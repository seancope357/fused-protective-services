import { site, divisionByQuoteValue, armedLevels, logoSrc } from '@/lib/shared';
import { formatMoney } from '@/lib/money';
import { fmtDateOnly, fmtDateTime } from '@/lib/format';
import type { Client, Proposal, Quote } from '@/lib/db/types';

/** The client-facing document. Renders identically in the portal, the client
    view, and print. Frozen values come from the snapshot once sent. */
export function ProposalPaper({ proposal, quote, client, signature }: { proposal: Proposal; quote: Quote; client: Client | null; signature?: React.ReactNode }) {
    const division = divisionByQuoteValue(quote.division_quote_value);
    const level = armedLevels.find((l) => l.id === quote.armed_level)?.label ?? quote.armed_level;
    return (
        <article className="paper" aria-label={`Proposal ${quote.quote_number}`}>
            <header className="paper__brand">
                <div className="row" style={{ gap: 12 }}>
                    <img src={logoSrc} alt="" width={56} height={56} />
                    <div>
                        <div className="paper__name">{site.name}</div>
                        <div className="paper__motto">{site.motto}</div>
                    </div>
                </div>
                <address className="paper__contact" style={{ fontStyle: 'normal' }}>
                    {site.address.locality}, {site.address.region}<br />{site.phone.display}<br />{site.email}<br />
                    <span className="small">{site.licenseNumber.label} {site.licenseNumber.value}</span>
                </address>
            </header>

            <div className="row row--between mb-4">
                <div>
                    <div className="paper__label">Proposal</div>
                    <h1 style={{ fontSize: 22 }}>{proposal.title}</h1>
                </div>
                <span className="badge">{proposal.status.replace('_', ' ')}</span>
            </div>

            <div className="grid grid--2">
                <div>
                    <div className="paper__label">Prepared for</div>
                    <p><strong>{client?.name ?? '—'}</strong><br />{client?.billing_contact_name}<br />{client?.billing_email}</p>
                </div>
                <dl className="kv">
                    <dt>Reference</dt><dd>{quote.quote_number}</dd>
                    <dt>Date</dt><dd>{fmtDateOnly((proposal.sent_at ?? quote.created_at).slice(0, 10))}</dd>
                    <dt>Valid until</dt><dd>{fmtDateOnly(quote.valid_until)}</dd>
                </dl>
            </div>

            <table className="mt-4">
                <thead><tr><th>Service</th><th className="num">Officers</th><th className="num">Hours</th><th className="num">Rate</th><th className="num">Amount</th></tr></thead>
                <tbody>
                    <tr>
                        <td>{division?.heading ?? quote.division_quote_value}<div className="small">{level}{quote.starts_at ? ` · ${fmtDateTime(quote.starts_at)}${quote.ends_at ? ` – ${fmtDateTime(quote.ends_at)}` : ''}` : ''}</div></td>
                        <td className="num">{quote.officer_count}</td>
                        <td className="num">{quote.hours}</td>
                        <td className="num">{formatMoney(quote.bill_rate_cents)}/hr</td>
                        <td className="num">{formatMoney(quote.subtotal_cents)}</td>
                    </tr>
                </tbody>
            </table>
            <div className="paper__totals">
                <div><span>Subtotal</span><span>{formatMoney(quote.subtotal_cents)}</span></div>
                {quote.tax_cents > 0 ? <div><span>Sales tax ({quote.tax_rate_pct}%)</span><span>{formatMoney(quote.tax_cents)}</span></div> : null}
                <div className="total"><span>Total</span><span>{formatMoney(quote.total_cents)}</span></div>
                {quote.deposit_pct > 0 ? <div className="small"><span>Deposit due on acceptance ({quote.deposit_pct}%)</span><span>{formatMoney(Math.round((quote.total_cents * quote.deposit_pct) / 100))}</span></div> : null}
            </div>

            <section className="paper__section"><div className="paper__label">Scope of services</div><p>{proposal.scope}</p></section>
            {proposal.exclusions ? <section className="paper__section"><div className="paper__label">Exclusions</div><p>{proposal.exclusions}</p></section> : null}
            <section className="paper__section"><div className="paper__label">Terms</div><p>{proposal.terms}</p></section>

            <section className="paper__sign">
                <div className="paper__label">Acceptance</div>
                {proposal.accepted_at ? (
                    <p>Accepted by <strong>{proposal.accepted_name}</strong> on {fmtDateTime(proposal.accepted_at)} (IP {proposal.accepted_ip}). This electronic acceptance is binding under the Texas Uniform Electronic Transactions Act.</p>
                ) : proposal.declined_at ? (
                    <p>Declined on {fmtDateTime(proposal.declined_at)}{proposal.declined_reason ? `: ${proposal.declined_reason}` : ''}.</p>
                ) : (
                    signature ?? <p>Awaiting client acceptance.</p>
                )}
            </section>
        </article>
    );
}
