import type { Metadata } from 'next';
import { site, logoSrc } from '@/lib/shared';
import { LoginForms } from './forms';

export const metadata: Metadata = { title: 'Sign in' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; unscoped?: string }> }) {
    const params = await searchParams;
    const next = params.next && params.next.startsWith('/') ? params.next : '/';
    return (
        <div className="auth-shell">
            <div className="card card--gold auth-card stack">
                <div className="row" style={{ gap: 12 }}>
                    <img src={logoSrc} alt="" width={44} height={44} style={{ borderRadius: 8 }} />
                    <div>
                        <div className="shell__brand-title">{site.shortName}</div>
                        <div className="shell__brand-sub">Operations Portal</div>
                    </div>
                </div>
                {params.unscoped ? (
                    <p className="alert alert--warn">Your account is not linked to a client yet. Contact dispatch at {site.phone.display}.</p>
                ) : null}
                <LoginForms next={next} />
                <p className="small muted">
                    Questions: <a href={`tel:${site.phone.e164}`}>{site.phone.display}</a> · <a href={`mailto:${site.email}`}>{site.email}</a>
                </p>
            </div>
        </div>
    );
}
