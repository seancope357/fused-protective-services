import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHead } from '@/components/ui';
import { StatusFromSearch, type SearchStatus } from '@/components/status-from-search';
import { EnrollmentPanel, DisablePanel } from './panels';
import { SESSION } from '@/lib/security/policy';

export const dynamic = 'force-dynamic';

export default async function SecurityPage({ searchParams }: { searchParams: Promise<SearchStatus & { enroll?: string }> }) {
    const params = await searchParams;
    const supabase = await createSupabaseServerClient();
    const [{ data: factors }, { data: aal }] = await Promise.all([supabase.auth.mfa.listFactors(), supabase.auth.mfa.getAuthenticatorAssuranceLevel()]);
    const enrolled = Boolean(factors?.totp?.some((f) => f.status === 'verified'));
    /* `?enroll=1` is where the proxy sends staff who have no authenticator yet
       (SPEC-012 §4). For a new account that is the first screen after the
       password, so it says why before it asks. */
    const firstTime = Boolean(params.enroll) && !enrolled;
    return (
        <>
            <PageHead eyebrow="Account" title="Security">
                Command staff sign in with a password and an authenticator code. Sessions end after {SESSION.idleMs / 3600000} hours idle or {SESSION.absoluteMs / 3600000} hours total.
            </PageHead>
            <StatusFromSearch params={params} />
            {firstTime ? (
                <section className="card card--gold stack mt-4" aria-labelledby="h-why">
                    <h2 id="h-why">One more step before you start</h2>
                    <p>
                        The portal holds your clients&rsquo; details and takes card payments, so a password alone is not enough. Each time you
                        sign in you will also type a 6-digit code from an app on your phone. Setting it up takes about a minute, and you need
                        to finish it before you can use the portal.
                    </p>
                    <p className="small">
                        Any free authenticator app works: Google Authenticator, Microsoft Authenticator, Authy, or Apple Passwords (built into
                        iPhone). 1Password works too.
                    </p>
                </section>
            ) : null}
            <div className="grid grid--2 mt-4" style={{ alignItems: 'start' }}>
                {enrolled ? (
                    <section className="card stack">
                        <h2>Authenticator app</h2>
                        <p className="alert alert--good">Enrolled. This session is at level <span className="mono">{aal?.currentLevel}</span>.</p>
                        <DisablePanel />
                    </section>
                ) : (
                    <section className="card stack">
                        <h2>Set up an authenticator app</h2>
                        {firstTime ? null : (
                            <p className="small">Any TOTP app works: 1Password, Google Authenticator, Authy, Microsoft Authenticator, or Apple Passwords.</p>
                        )}
                        <EnrollmentPanel />
                    </section>
                )}
                <section className="card stack">
                    <h2>How access is protected</h2>
                    <ul className="small" style={{ paddingLeft: 18, lineHeight: 1.8 }}>
                        <li>Staff data access is refused by the database itself unless the session carries a verified second factor.</li>
                        <li>Sign-in attempts are limited per address and per email.</li>
                        <li>Sessions expire after inactivity and after a fixed maximum.</li>
                        <li>A strict Content Security Policy blocks scripts that are not part of this app.</li>
                        <li>Clients sign in by a one-time emailed link and see only their own records.</li>
                    </ul>
                </section>
            </div>
        </>
    );
}
