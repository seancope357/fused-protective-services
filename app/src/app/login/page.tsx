import type { Metadata } from 'next';
import { site, logoSrc } from '@/lib/shared';
import { LoginForms } from './forms';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; unscoped?: string; reason?: string; error?: string }> }) {
    const params = await searchParams;
    const next = params.next && params.next.startsWith('/') ? params.next : '/';
    return (
        <main id="main" className="auth-shell">
            <div className="card card--gold auth-card stack">
                <div className="row" style={{ gap: 12 }}>
                    <img src={logoSrc} alt="" width={44} height={44} style={{ borderRadius: 8 }} />
                    <div>
                        <div className="brand__title">{site.shortName}</div>
                        <div className="brand__sub">Operations Portal</div>
                    </div>
                </div>
                <h1>Sign in</h1>
                {params.reason === 'idle_expired' ? <p className="alert alert--warn">You were signed out after 8 hours of inactivity. Sign in again.</p> : null}
                {params.reason === 'absolute_expired' ? <p className="alert alert--warn">Sessions last 72 hours at most. Sign in again.</p> : null}
                {params.error === 'expired_link' ? <p className="alert alert--warn">That sign-in link has expired or was already used. Request a new one.</p> : null}
                {params.unscoped ? (
                    <p className="alert alert--warn">Your account is not linked to a client yet. Contact dispatch at {site.phone.display}.</p>
                ) : null}
                <LoginForms next={next} />
                <p className="small muted">
                    Questions: <a href={`tel:${site.phone.e164}`}>{site.phone.display}</a> · <a href={`mailto:${site.email}`}>{site.email}</a>
                </p>
            </div>
        </main>
    );
}
