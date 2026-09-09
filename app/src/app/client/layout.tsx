import { requireClient } from '@/lib/auth';
import { Shell } from '@/components/shell';

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
    const session = await requireClient();
    const items = [
        { href: '/client', label: 'Overview' },
        { href: '/client/proposals', label: 'Proposals' },
        { href: '/client/jobs', label: 'Details' },
        { href: '/client/invoices', label: 'Invoices' }
    ];
    return (
        <Shell session={session} items={items} area="Client Portal">
            {children}
        </Shell>
    );
}
