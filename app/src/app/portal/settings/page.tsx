import { Fragment } from 'react';
import { getSettings } from '@/lib/domain/queries';
import { getSession } from '@/lib/auth';
import { PageHead, Field, PlaceholderFlag, Disclosure } from '@/components/ui';
import { StatusFromSearch, type SearchStatus } from '@/components/status-from-search';
import { saveSettings, createStaffUser, changeOwnPassword } from '@/lib/actions/settings';
import { MIN_PASSWORD_LENGTH } from '@/lib/security/policy';
import { site, tiers, netTerms, taxDefaults, invoiceDefaults } from '@/lib/shared';
import { statusLabel } from '@/lib/format';
import { rules, type Rule } from '@/lib/notifications/templates';
import { emailConfigured, smsConfigured, publicSender } from '@/lib/transports';
import { stripeConfigured } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

/* The notification matrix, read aloud. Keys are rule triggers; a trigger not
   listed here still renders (from its id) so a new rule can never vanish from
   this page, it just reads less well until it is named. */
const WHEN: Record<string, string> = {
    lead_unanswered_2h: 'When a lead has had no reply for 2 hours',
    candidate_stage_advanced: 'When a candidate moves to the next vetting stage',
    candidate_rejected: 'When a candidate is turned down',
    proposal_sent: 'When a proposal is sent',
    proposal_accepted: 'When a proposal is accepted',
    proposal_accepted_copy: 'When a proposal is accepted',
    job_confirmed: 'When a job is confirmed',
    job_reminder_24h: 'A day before a job starts',
    job_unstaffed_24h: 'A day before a job starts with no officers assigned',
    job_completed: 'When a job is completed',
    review_request: 'When it is time to ask for a review',
    invoice_sent: 'When an invoice is sent',
    payment_received: 'When a payment comes in',
    payment_receipt: 'When a payment comes in',
    invoice_overdue: 'When an invoice is overdue',
    daily_digest: 'Every morning'
};

function ruleSentence(rule: Rule): string {
    const when = WHEN[rule.trigger] ?? `When ${statusLabel(rule.trigger)}`;
    const how = rule.channels.map((c) => (c === 'sms' ? 'text' : 'email')).join(' and ');
    /* Candidate rules use the client audience internally (templates.ts explains
       why); to Cameron the person being emailed is the candidate. */
    const who = rule.audience === 'owner' ? 'you' : rule.trigger.startsWith('candidate_') ? 'the candidate' : 'the client';
    return `${when}, ${how} ${who}.`;
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<SearchStatus> }) {
    const [settings, session] = await Promise.all([getSettings(), getSession()]);
    const s = settings as Record<string, string | undefined>;
    /* Plain status for Cameron; the variable names stay one tap away for Sean,
       who wires these up. */
    const checks: { label: string; ok: boolean; env: string }[] = [
        { label: 'Email', ok: emailConfigured(), env: 'RESEND_API_KEY' },
        { label: 'Email sender address', ok: Boolean(publicSender()), env: 'DISPATCH_ALERT_FROM on the verified domain' },
        { label: 'Text messages', ok: smsConfigured(), env: 'TWILIO_* variables' },
        { label: 'Card payments', ok: stripeConfigured(), env: 'STRIPE_SECRET_KEY' },
        { label: 'Payment confirmations', ok: Boolean(process.env.STRIPE_WEBHOOK_SECRET), env: 'STRIPE_WEBHOOK_SECRET' },
        { label: 'Scheduled reminders', ok: Boolean(process.env.CRON_SECRET), env: 'CRON_SECRET' }
    ];

    return (
        <>
            <PageHead eyebrow="Configuration" title="Settings">Where your alerts go, your password and staff accounts. What your website shows is listed at the bottom.</PageHead>
            <StatusFromSearch params={await searchParams} />

            {/* Source order is the phone order: the things Cameron changes come first. */}
            <div className="grid grid--2 mt-4 align-start">
                <div className="stack">
                    <form action={saveSettings} className="card stack">
                        <h2>Alerts and defaults</h2>
                        <Field id="owner_name" label="Owner name">
                            <input id="owner_name" name="owner_name" defaultValue={s.owner_name ?? ''} placeholder="Cameron Harrell" autoComplete="name" />
                        </Field>
                        <Field id="owner_email" label="Email for alerts" hint="Separate more than one with commas. If blank, alerts go to the address set up during installation.">
                            <input id="owner_email" name="owner_email" type="email" multiple inputMode="email" autoComplete="email" defaultValue={s.owner_email ?? ''} placeholder="name@example.com" aria-describedby="owner_email-hint" />
                        </Field>
                        <Field id="owner_phone" label="Mobile number for text alerts" hint="Include +1, e.g. +15125550123. If blank, texts go to the number set up during installation.">
                            <input id="owner_phone" name="owner_phone" type="tel" inputMode="tel" autoComplete="tel" pattern="\+[0-9]{8,15}" title="Start with +1, then the 10-digit number, no spaces" defaultValue={s.owner_phone ?? ''} placeholder="+15125550123" aria-describedby="owner_phone-hint" />
                        </Field>
                        <Field id="default_deposit_pct" label="Deposit % asked for on new quotes">
                            <input id="default_deposit_pct" name="default_deposit_pct" type="number" inputMode="numeric" min={0} max={100} defaultValue={s.default_deposit_pct ?? ''} />
                        </Field>
                        <Field id="brief_arrival_window" label="Arrival instructions in officer briefs">
                            <input id="brief_arrival_window" name="brief_arrival_window" defaultValue={s.brief_arrival_window ?? ''} placeholder="Officers arrive 30 minutes before start" />
                        </Field>
                        <Field id="proposal_terms" label="Terms printed on proposals" hint="If blank, proposals use the invoice terms shown on your website.">
                            <textarea id="proposal_terms" name="proposal_terms" rows={4} defaultValue={s.proposal_terms ?? ''} aria-describedby="proposal_terms-hint" />
                        </Field>
                        <div className="row"><button className="btn btn--gold" type="submit">Save settings</button></div>
                    </form>

                    <form action={changeOwnPassword} className="card stack">
                        <h2>Change my password</h2>
                        <Field id="pw_new" label={`New password (${MIN_PASSWORD_LENGTH}+ characters)`}>
                            <input id="pw_new" name="password" type="password" minLength={MIN_PASSWORD_LENGTH} required autoComplete="new-password" />
                        </Field>
                        <Field id="pw_confirm" label="Type it again">
                            <input id="pw_confirm" name="confirm" type="password" minLength={MIN_PASSWORD_LENGTH} required autoComplete="new-password" />
                        </Field>
                        <div className="row"><button className="btn btn--ghost" type="submit">Change password</button></div>
                    </form>

                    {session?.role === 'owner' ? (
                        <form action={createStaffUser} className="card stack">
                            <h2>Add command staff</h2>
                            <Field id="st_name" label="Full name">
                                <input id="st_name" name="full_name" autoComplete="off" />
                            </Field>
                            <Field id="st_email" label="Their email">
                                <input id="st_email" name="email" type="email" inputMode="email" autoComplete="off" required />
                            </Field>
                            <Field id="st_pw" label={`Temporary password (${MIN_PASSWORD_LENGTH}+ characters)`} hint="Give it to them in person or by phone. They choose their own the first time they sign in.">
                                <input id="st_pw" name="password" type="password" minLength={MIN_PASSWORD_LENGTH} required autoComplete="new-password" aria-describedby="st_pw-hint" />
                            </Field>
                            <Field id="st_role" label="Role">
                                <select id="st_role" name="role" defaultValue="staff"><option value="staff">Staff</option><option value="owner">Owner</option></select>
                            </Field>
                            <div className="row"><button className="btn btn--ghost" type="submit">Create account</button></div>
                        </form>
                    ) : null}
                </div>

                <div className="stack">
                    <section className="card stack" aria-labelledby="h-integrations">
                        <h2 id="h-integrations">Connected services</h2>
                        <dl className="kv">
                            {checks.map((c) => (
                                <Fragment key={c.label}>
                                    <dt>{c.label}</dt>
                                    <dd>{c.ok ? <span className="status-good">Connected</span> : <span className="status-warn">Not connected yet — Sean is setting this up</span>}</dd>
                                </Fragment>
                            ))}
                        </dl>
                        <Disclosure summary="Technical detail">
                            <dl className="kv small">
                                {checks.map((c) => (
                                    <Fragment key={c.label}>
                                        <dt>{c.label}</dt>
                                        <dd><span className="mono wrap-anywhere">{c.env}</span> — {c.ok ? 'set' : 'missing'}</dd>
                                    </Fragment>
                                ))}
                            </dl>
                            <p className="small mt-4">
                                Setup order and checks: <span className="mono">docs/RUNBOOK.md</span>. Website facts: <span className="mono">src/data/*.mjs</span> (rebuild
                                the site and redeploy both projects). Message rules: <span className="mono wrap-anywhere">app/src/lib/notifications/templates.ts</span>.
                            </p>
                        </Disclosure>
                    </section>

                    <section className="card" aria-labelledby="h-site">
                        <h2 id="h-site">Shown on your website</h2>
                        <p className="small muted mb-4">To change these, ask Sean.</p>
                        <dl className="kv">
                            <dt>Dispatch line</dt><dd>{site.phone.display} <PlaceholderFlag fact={site.phone} what="phone" /></dd>
                            <dt>Licence</dt><dd>{site.licenseNumber.value} <PlaceholderFlag fact={site.licenseNumber} what="licence number" /></dd>
                            <dt>Rate card</dt><dd>{tiers.map((t) => `${t.name} $${t.rate}/hr`).join('\n')}</dd>
                            <dt>Payment terms</dt><dd>{netTerms.map((t) => t.label).join(', ')}</dd>
                            <dt>Sales tax</dt><dd>{taxDefaults.defaultRatePct}% ({taxDefaults.label})</dd>
                            <dt>Invoice terms</dt><dd className="small">{invoiceDefaults.terms}</dd>
                        </dl>
                    </section>

                    <Disclosure summary="Automatic messages">
                        <p className="small">The portal sends these on its own. Every one is recorded in the Message log.</p>
                        <ul className="bullets small mt-2">
                            {rules.map((r) => <li key={`${r.trigger}-${r.audience}`}>{ruleSentence(r)}</li>)}
                        </ul>
                    </Disclosure>
                </div>
            </div>
        </>
    );
}
