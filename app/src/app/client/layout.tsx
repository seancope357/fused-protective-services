import { requireClient } from '@/lib/auth';
import { Shell } from '@/components/shell';

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
    const session = await requireClient();
    const items = [
        { href: '/client', label: 'Overview', tab: true, icon: 'today' as const },
        { href: '/client/proposals', label: 'Proposals', tab: true, icon: 'proposals' as const },
        { href: '/client/jobs', label: 'Details', tab: true, icon: 'jobs' as const },
        { href: '/client/invoices', label: 'Invoices', tab: true, icon: 'invoices' as const }
    ];
    return (
        <Shell session={session} items={items} area="Client Portal">
            {children}
        </Shell>
    );
}
