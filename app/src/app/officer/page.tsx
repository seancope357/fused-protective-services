import { redirect } from 'next/navigation';
import { getSession, homeFor } from '@/lib/auth';
import { site } from '@/lib/shared';

/* Phase 2 lands the officer screens. The role, RLS scoping and sign-in path
   exist now; this page only tells an officer that. It has no Shell, so it
   provides its own <main> landmark. */
export default async function OfficerHome() {
    const session = await getSession();
    if (!session) redirect('/login?next=/officer');
    if (session.role !== 'officer') redirect(homeFor(session.role));
    return (
        <main id="main" className="auth-shell">
            <div className="card card--gold auth-card stack">
                <h1>Officer portal</h1>
                <p>Assigned shifts, clock-in and checkpoint scans arrive in the next release. Until then, dispatch reaches you directly at <a href={`tel:${site.phone.e164}`}>{site.phone.display}</a>.</p>
                <form action="/auth/signout" method="post">
                    <button type="submit" className="btn btn--ghost">Sign out</button>
                </form>
            </div>
        </main>
    );
}
