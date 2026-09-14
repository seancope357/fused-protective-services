import { requireStaff } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { countCandidates, countLeads } from '@/lib/domain/queries';
import { Shell } from '@/components/shell';
import { vettingStageOrder } from '@/lib/shared';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
    const session = await requireStaff();
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
        { href: '/portal', label: 'Today' },
        { href: '/portal/leads', label: 'Leads', count: newLeads },
        { href: '/portal/quotes', label: 'Quotes & proposals' },
        { href: '/portal/jobs', label: 'Jobs' },
        { href: '/portal/invoices', label: 'Invoices', count: overdue ?? 0 },
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
