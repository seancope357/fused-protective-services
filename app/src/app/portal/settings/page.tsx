import { getSettings } from '@/lib/domain/queries';
import { getSession } from '@/lib/auth';
import { PageHead, Field, PlaceholderFlag } from '@/components/ui';
import { StatusFromSearch, type SearchStatus } from '@/components/status-from-search';
import { saveSettings, createStaffUser, changeOwnPassword } from '@/lib/actions/settings';
import { site, tiers, netTerms, taxDefaults, invoiceDefaults } from '@/lib/shared';
import { rules } from '@/lib/notifications/templates';
import { emailConfigured, smsConfigured, publicSender } from '@/lib/transports';
import { stripeConfigured } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

export default async function SettingsPage({ searchParams }: { searchParams: Promise<SearchStatus> }) {
    const [settings, session] = await Promise.all([getSettings(), getSession()]);
    const s = settings as Record<string, string | undefined>;
    const checks: [string, boolean, string][] = [
        ['Email (Resend)', emailConfigured(), 'RESEND_API_KEY'],
        ['Verified sender', Boolean(publicSender()), 'DISPATCH_ALERT_FROM on the verified domain'],
        ['SMS (Twilio)', smsConfigured(), 'TWILIO_* variables'],
        ['Payments (Stripe)', stripeConfigured(), 'STRIPE_SECRET_KEY'],
        ['Webhook secret', Boolean(process.env.STRIPE_WEBHOOK_SECRET), 'STRIPE_WEBHOOK_SECRET'],
        ['Scheduler', Boolean(process.env.CRON_SECRET), 'CRON_SECRET']
    ];

    return (
        <>
            <PageHead eyebrow="Configuration" title="Settings">Rates, terms and the dispatch line live in the site's data files and are shown here read-only; everything editable below is stored in the database.</PageHead>
            <StatusFromSearch params={await searchParams} />

            <div className="grid grid--2 mt-4" style={{ alignItems: 'start' }}>
                <form action={saveSettings} className="card stack">
                    <h2>Notification recipients & defaults</h2>
                    <Field id="owner_name" label="Owner name"><input id="owner_name" name="owner_name" defaultValue={s.owner_name ?? ''} placeholder="Cameron Harrell" /></Field>
                    <Field id="owner_email" label="Owner alert email(s)" hint="Comma-separated. Falls back to DISPATCH_ALERT_TO."><input id="owner_email" name="owner_email" defaultValue={s.owner_email ?? ''} placeholder={process.env.DISPATCH_ALERT_TO ?? ''} /></Field>
                    <Field id="owner_phone" label="Owner SMS number (E.164)" hint="Falls back to DISPATCH_ALERT_SMS_TO."><input id="owner_phone" name="owner_phone" defaultValue={s.owner_phone ?? ''} placeholder="+1512…" /></Field>
                    <Field id="default_deposit_pct" label="Default deposit % for new quotes"><input id="default_deposit_pct" name="default_deposit_pct" type="number" min={0} max={100} defaultValue={s.default_deposit_pct ?? ''} /></Field>
                    <Field id="brief_arrival_window" label="Default arrival window in briefs"><input id="brief_arrival_window" name="brief_arrival_window" defaultValue={s.brief_arrival_window ?? ''} placeholder="Officers arrive 30 minutes before start" /></Field>
                    <Field id="proposal_terms" label="Default proposal terms" hint="Blank uses the invoice terms from src/data/invoice.mjs."><textarea id="proposal_terms" name="proposal_terms" rows={4} defaultValue={s.proposal_terms ?? ''} /></Field>
                    <div className="row"><button className="btn btn--gold" type="submit">Save settings</button></div>
                </form>

                <div className="stack">
                    <section className="card">
                        <h2 className="mb-4">Integrations</h2>
                        <dl className="kv">{checks.map(([label, ok, hint]) => <div key={label} style={{ display: 'contents' }}><dt>{label}</dt><dd>{ok ? <span style={{ color: '#6ee7b7' }}>configured</span> : <span style={{ color: '#fca5a5' }}>missing — set {hint}</span>}</dd></div>)}</dl>
                        <p className="small mt-4">Setup order and verification steps are in <span className="mono">docs/RUNBOOK.md</span>.</p>
                    </section>
                    <section className="card">
                        <h2 className="mb-4">Facts from the site data (read-only)</h2>
                        <dl className="kv">
                            <dt>Dispatch line</dt><dd>{site.phone.display} <PlaceholderFlag fact={site.phone} what="phone" /></dd>
                            <dt>Licence</dt><dd>{site.licenseNumber.value} <PlaceholderFlag fact={site.licenseNumber} what="licence number" /></dd>
                            <dt>Rate card</dt><dd>{tiers.map((t) => `${t.name} $${t.rate}/hr`).join('\n')}</dd>
                            <dt>Terms</dt><dd>{netTerms.map((t) => t.label).join(', ')}</dd>
                            <dt>Tax default</dt><dd>{taxDefaults.defaultRatePct}% ({taxDefaults.label})</dd>
                            <dt>Invoice terms</dt><dd className="small">{invoiceDefaults.terms}</dd>
                        </dl>
                        <p className="small mt-4">Edit these in <span className="mono">src/data/*.mjs</span>, rebuild the site, and redeploy both projects.</p>
                    </section>
                    <section className="card">
                        <h2 className="mb-4">Message templates</h2>
                        <p className="small">Table-driven in <span className="mono">app/src/lib/notifications/templates.ts</span>. {rules.length} rules:</p>
                        <ul className="small" style={{ paddingLeft: 18, marginTop: 8 }}>{rules.map((r) => <li key={`${r.trigger}-${r.audience}`}><span className="mono">{r.trigger}</span> → {r.audience} via {r.channels.join(' + ')}</li>)}</ul>
                    </section>
                    <form action={changeOwnPassword} className="card stack">
                        <h2>Change my password</h2>
                        <Field id="pw_new" label="New password (12+ characters)"><input id="pw_new" name="password" type="password" minLength={12} required autoComplete="new-password" /></Field>
                        <Field id="pw_confirm" label="Confirm"><input id="pw_confirm" name="confirm" type="password" minLength={12} required autoComplete="new-password" /></Field>
                        <div className="row"><button className="btn btn--ghost" type="submit">Change password</button></div>
                    </form>
                    {session?.role === 'owner' ? (
                        <form action={createStaffUser} className="card stack">
                            <h2>Add command staff</h2>
                            <Field id="st_name" label="Full name"><input id="st_name" name="full_name" /></Field>
                            <Field id="st_email" label="Email"><input id="st_email" name="email" type="email" required /></Field>
                            <Field id="st_pw" label="Temporary password (12+ characters)"><input id="st_pw" name="password" type="password" minLength={12} required autoComplete="new-password" /></Field>
                            <Field id="st_role" label="Role"><select id="st_role" name="role" defaultValue="staff"><option value="staff">Staff</option><option value="owner">Owner</option></select></Field>
                            <div className="row"><button className="btn btn--ghost" type="submit">Create account</button></div>
                        </form>
                    ) : null}
                </div>
            </div>
        </>
    );
}
