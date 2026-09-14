'use client';

/* The only client component in the frame (SPEC-012). It exists for three
   things a server component cannot do: know the current path to set
   aria-current, open the More sheet as a modal dialog, and close that sheet
   when the route changes. Everything it renders is plain links and a form. */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { activeHref, hiddenCount, type NavIcon, type NavItem } from '@/lib/nav';

const ICONS: Record<NavIcon | 'more' | 'close', string> = {
    today: 'M3.5 11 12 4l8.5 7M5.5 9.5V20h5v-5.5h3V20h5V9.5',
    leads: 'M4 13.5h4.5l1.5 2.5h4l1.5-2.5H20M6 5h12l2 8.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5.5z',
    jobs: 'M12 3.5 5 6.2v5.6c0 4.2 3 7.8 7 8.7 4-.9 7-4.5 7-8.7V6.2zM9 12l2 2 4-4',
    invoices: 'M6.5 3.5h11v17l-2.75-1.75L12 20.5l-2.75-1.75L6.5 20.5zM9.5 8h5M9.5 11.5h5M9.5 15h3',
    proposals: 'M7 3.5h6.5l4 4v13H7zM13.5 3.5v4h4M9.5 12h5M9.5 15.5h5',
    more: 'M4.5 7h15M4.5 12h15M4.5 17h15',
    close: 'M6 6l12 12M18 6 6 18'
};

function Icon({ name }: { name: keyof typeof ICONS }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
            <path d={ICONS[name]} />
        </svg>
    );
}

function Count({ n }: { n?: number }) {
    if (!n) return null;
    return (
        <span className="count">
            <span aria-hidden="true">{n}</span>
            <span className="visually-hidden">, {n} needing attention</span>
        </span>
    );
}

/** Desktop sidebar links. */
export function SidebarLinks({ items, root }: { items: NavItem[]; root: string }) {
    const current = activeHref(usePathname(), items, root);
    return (
        <>
            {items.map((item) => (
                <Link key={item.href} href={item.href} className="sidebar__link" aria-current={current === item.href ? 'page' : undefined}>
                    <span>{item.label}</span>
                    <Count n={item.count} />
                </Link>
            ))}
        </>
    );
}

/** Phone and tablet: the bottom tab bar and the More sheet. */
export function TabBar({ items, root, area, account }: { items: NavItem[]; root: string; area: string; account: { name: string; role: string } }) {
    const pathname = usePathname();
    const current = activeHref(pathname, items, root);
    const tabs = items.filter((item) => item.tab);
    const rest = items.filter((item) => !item.tab);
    /* When the current page lives in the sheet, the More tab stands in for it. */
    const moreCurrent = rest.find((item) => item.href === current);
    const sheet = useRef<HTMLDialogElement>(null);
    const [open, setOpen] = useState(false);

    /* A link in the sheet navigates; the sheet must not stay open over the
       page it just opened. */
    useEffect(() => {
        sheet.current?.close();
    }, [pathname]);

    const openSheet = () => {
        sheet.current?.showModal();
        setOpen(true);
    };
    const closeSheet = () => sheet.current?.close();

    return (
        <>
            <nav className="tabbar no-print" aria-label={`${area} navigation`} style={{ '--tabs': tabs.length + (rest.length ? 1 : 0) } as CSSProperties}>
                {tabs.map((item) => (
                    <Link key={item.href} href={item.href} className="tabbar__item" aria-current={current === item.href ? 'page' : undefined}>
                        {item.icon ? <Icon name={item.icon} /> : null}
                        <span>{item.label}</span>
                        <Count n={item.count} />
                    </Link>
                ))}
                {rest.length ? (
                    <button
                        type="button"
                        className="tabbar__item"
                        aria-haspopup="dialog"
                        aria-expanded={open}
                        aria-controls="more-sheet"
                        data-active={moreCurrent ? true : undefined}
                        aria-current={moreCurrent ? 'true' : undefined}
                        onClick={openSheet}
                    >
                        <Icon name="more" />
                        <span>More{moreCurrent ? <span className="visually-hidden">, current page: {moreCurrent.label}</span> : null}</span>
                        <Count n={hiddenCount(items)} />
                    </button>
                ) : null}
            </nav>

            {rest.length ? (
                <dialog
                    id="more-sheet"
                    ref={sheet}
                    className="sheet"
                    aria-labelledby="more-sheet-title"
                    onClose={() => setOpen(false)}
                    /* The dialog element itself is only hit through its backdrop:
                       all content sits in .sheet__body. */
                    onClick={(event) => {
                        if (event.target === event.currentTarget) closeSheet();
                    }}
                >
                    <div className="sheet__body">
                        <div className="sheet__head">
                            <h2 id="more-sheet-title">More</h2>
                            <button type="button" className="btn btn--ghost btn--icon" onClick={closeSheet} aria-label="Close menu">
                                <Icon name="close" />
                            </button>
                        </div>
                        <ul className="sheet__list">
                            {rest.map((item) => (
                                <li key={item.href}>
                                    <Link href={item.href} className="sheet__link" aria-current={current === item.href ? 'page' : undefined} onClick={closeSheet}>
                                        <span>{item.label}</span>
                                        <Count n={item.count} />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                        <div className="sheet__account">
                            <div>
                                <strong>{account.name}</strong>
                                {account.role}
                            </div>
                            <form action="/auth/signout" method="post">
                                <button type="submit" className="btn btn--ghost btn--sm">Sign out</button>
                            </form>
                        </div>
                    </div>
                </dialog>
            ) : null}
        </>
    );
}
