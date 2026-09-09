import { requireStaff } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Shell } from '@/components/shell';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
    const session = await requireStaff();
    const supabase = await createSupabaseServerClient();
    const [{ count: newLeads }, { count: overdue }] = await Promise.all([
        supabase.from('client_quotes').select('id', { count: 'exact', head: true }).eq('status', 'new'),
        supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('status', 'overdue')
    ]);
    const items = [
        { href: '/portal', label: 'Today' },
        { href: '/portal/leads', label: 'Leads', count: newLeads ?? 0 },
        { href: '/portal/quotes', label: 'Quotes & proposals' },
        { href: '/portal/jobs', label: 'Jobs' },
        { href: '/portal/invoices', label: 'Invoices', count: overdue ?? 0 },
        { href: '/portal/clients', label: 'Clients & sites' },
        { href: '/portal/reviews', label: 'Reviews' },
        { href: '/portal/notifications', label: 'Message log' },
        { href: '/portal/settings', label: 'Settings' }
    ];
    return (
        <Shell session={session} items={items} area="Command">
            {children}
        </Shell>
    );
}
