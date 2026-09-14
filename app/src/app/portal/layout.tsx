import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { isMfaExempt } from '@/lib/security/policy';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { countCandidates, countLeads } from '@/lib/domain/queries';
import { Shell } from '@/components/shell';
import { vettingStageOrder } from '@/lib/shared';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
    const session = await requireStaff();
    /* An account made from Settings starts on a temporary password and sets its
       own after its first two-factor sign-in (SPEC-012). The proxy enforces this
       on every request from the session token; this read (getUser, always fresh)
       is defence in depth. MFA-exempt pages (Security, where a new account
       enrols) are left alone: enrol first, then set the password. */
    const path = (await headers()).get('x-pathname') ?? '';
    if (session.mustChangePassword && path !== '/portal/welcome' && !isMfaExempt(path)) redirect('/portal/welcome');
    if (session.mustChangePassword) {
        /* Until the password is set every destination redirects back here, so
           the frame offers none: no nav links (each prefetch would only bounce),
           just the page and a way to sign out. */
        return (
            <div className="auth-shell">
                <main id="main" className="auth-card stack">
                    {children}
                    <form action="/auth/signout" method="post">
                        <button type="submit" className="btn btn--ghost btn--sm">Sign out</button>
                    </form>
                </main>
            </div>
        );
    }
    const supabase = await createSupabaseServerClient();
    /* The Leads and Candidates badges count production rows only (SPEC-002) — a
       badge that counts preview submissions sends the owner after work that
       isn't there. The candidate badge counts the intake stage, the one stage
       where the next move is always someone's to make. */
    const [newLeads, newCandidates, { count: overdue }] = await Promise.all([
        countLeads({ stage: 'new' }),
        countCandidates({ stage: vettingStageOrder[0] }),
        supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('status', 'overdue')
    ]);
    const items = [
        { href: '/portal', label: 'Today', tab: true, icon: 'today' as const },
        { href: '/portal/leads', label: 'Leads', count: newLeads, tab: true, icon: 'leads' as const },
        { href: '/portal/quotes', label: 'Quotes & proposals' },
        { href: '/portal/jobs', label: 'Jobs', tab: true, icon: 'jobs' as const },
        { href: '/portal/invoices', label: 'Invoices', count: overdue ?? 0, tab: true, icon: 'invoices' as const },
        { href: '/portal/clients', label: 'Clients & sites' },
        { href: '/portal/candidates', label: 'Candidates', count: newCandidates },
        { href: '/portal/reviews', label: 'Reviews' },
        { href: '/portal/activity', label: 'Activity' },
        { href: '/portal/notifications', label: 'Message log' },
        { href: '/portal/settings', label: 'Settings' },
        { href: '/portal/security', label: 'Security' }
    ];
    return (
        <Shell session={session} items={items} area="Command">
            {children}
        </Shell>
    );
}
