import Link from 'next/link';
import { site, logoSrc } from '@/lib/shared';
import type { Session } from '@/lib/auth';
import type { NavItem } from '@/lib/nav';
import { SidebarLinks, TabBar } from '@/components/nav';

export type { NavItem };

/* The application frame (SPEC-012). Both navigations are rendered and CSS
   shows exactly one: the tab bar and More sheet below 1024px, the sidebar
   from 1024px. The frame itself stays a server component; only the pieces
   that need the current path live in components/nav.tsx. */
export function Shell({ session, items, area, children }: { session: Session; items: NavItem[]; area: string; children: React.ReactNode }) {
    const root = items[0]?.href ?? '/';
    const account = { name: session.fullName || session.email || 'Signed in', role: session.role.charAt(0).toUpperCase() + session.role.slice(1) };
    /* With no More sheet (the client portal), sign-out has to live in the top bar. */
    const everyItemIsATab = items.every((item) => item.tab);

    const brand = (
        <Link href={root} className="brand">
            <img src={logoSrc} alt="" width={34} height={34} />
            <div>
                <div className="brand__title">{site.shortName}</div>
                <div className="brand__sub">{area}</div>
            </div>
        </Link>
    );

    return (
        <div className="shell">
            <a href="#main" className="skip-link">Skip to content</a>
            <header className="topbar no-print">
                {brand}
                {everyItemIsATab ? (
                    <form action="/auth/signout" method="post" style={{ marginLeft: 'auto' }}>
                        <button type="submit" className="btn btn--ghost btn--sm">Sign out</button>
                    </form>
                ) : null}
            </header>
            <nav className="sidebar no-print" aria-label={`${area} navigation`}>
                {brand}
                <SidebarLinks items={items} root={root} />
                <div className="sidebar__foot">
                    <div>
                        <strong>{account.name}</strong>
                        <div>{account.role}</div>
                    </div>
                    <form action="/auth/signout" method="post">
                        <button type="submit" className="btn btn--ghost btn--sm">Sign out</button>
                    </form>
                </div>
            </nav>
            <main id="main" className="shell__main">
                {children}
            </main>
            <TabBar items={items} root={root} area={area} account={account} />
        </div>
    );
}
