export type NavIcon = 'today' | 'leads' | 'jobs' | 'invoices' | 'proposals';

export type NavItem = { href: string; label: string; count?: number; tab?: boolean; icon?: NavIcon };

/** The item the current path belongs to. The area root matches only itself —
    otherwise "Today" would light up on every page — and everything else
    matches itself or a descendant, the longest href winning. */
export function activeHref(pathname: string, items: NavItem[], root: string): string | null {
    let best: string | null = null;
    for (const { href } of items) {
        const hit = href === root ? pathname === root : pathname === href || pathname.startsWith(`${href}/`);
        if (hit && (!best || href.length > best.length)) best = href;
    }
    return best;
}

/** What the More tab must badge: every count it hides from the tab bar. */
export const hiddenCount = (items: NavItem[]): number =>
    items.reduce((sum, item) => sum + (item.tab ? 0 : item.count ?? 0), 0);
