import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { site } from '@/lib/shared';
import { MfaChallengeForm } from './form';

export const metadata: Metadata = { title: 'Verify sign-in' };

export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
    const session = await getSession();
    if (!session) redirect('/login');
    const { next } = await searchParams;
    return (
        <main id="main" className="auth-shell">
            <div className="card card--gold auth-card stack">
                <div>
                    <div className="brand__sub">Command staff</div>
                    <h1>Enter your authenticator code</h1>
                </div>
                <p>Open your authenticator app and enter the current 6-digit code for the {site.shortName} portal.</p>
                <MfaChallengeForm next={next && next.startsWith('/') ? next : '/portal'} />
                <form action="/auth/signout" method="post"><button type="submit" className="btn btn--ghost btn--sm">Sign out</button></form>
            </div>
        </main>
    );
}
