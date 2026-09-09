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
    return (
        <>
            <PageHead eyebrow="Account" title="Security">
                Command staff sign in with a password and an authenticator code. Sessions end after {SESSION.idleMs / 3600000} hours idle or {SESSION.absoluteMs / 3600000} hours total.
            </PageHead>
            <StatusFromSearch params={params} />
            {params.enroll && !enrolled ? <p className="alert alert--warn mt-4">Two-factor authentication is required for command staff. Enroll below to continue to the portal.</p> : null}
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
                        <p className="small">Any TOTP app works: 1Password, Google Authenticator, Authy, Microsoft Authenticator, or Apple Passwords.</p>
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
