import Link from 'next/link';
import { site, logoSrc } from '@/lib/shared';
import type { Session } from '@/lib/auth';

export type NavItem = { href: string; label: string; count?: number };

export function Shell({ session, items, area, children }: { session: Session; items: NavItem[]; area: string; children: React.ReactNode }) {
    return (
        <div className="shell">
            <a href="#main" className="skip-link">Skip to content</a>
            <nav className="shell__nav no-print" aria-label={`${area} navigation`}>
                <Link href={items[0]?.href ?? '/'} className="shell__brand">
                    <img src={logoSrc} alt="" width={36} height={36} />
                    <div>
                        <div className="shell__brand-title">{site.shortName}</div>
                        <div className="shell__brand-sub">{area}</div>
                    </div>
                </Link>
                {items.map((item) => (
                    <NavLink key={item.href} item={item} />
                ))}
                <div className="shell__foot">
                    <div>
                        <strong style={{ color: 'var(--text-secondary)' }}>{session.fullName || session.email}</strong>
                        <div className="mono" style={{ fontSize: 11 }}>{session.role}</div>
                    </div>
                    <form action="/auth/signout" method="post">
                        <button type="submit" className="btn btn--ghost btn--sm">Sign out</button>
                    </form>
                </div>
            </nav>
            <main id="main" className="shell__main">
                {children}
            </main>
        </div>
    );
}

function NavLink({ item }: { item: NavItem }) {
    return (
        <Link href={item.href} className="shell__link">
            <span>{item.label}</span>
            {item.count ? <span className="shell__link-count" aria-label={`${item.count} needing attention`}>{item.count}</span> : null}
        </Link>
    );
}
