/* ==========================================================================
   SPEC-012 — which destination the current path belongs to.

   Both navs (desktop sidebar, phone tab bar + More sheet) mark the current
   destination with aria-current. The rule lives in one pure function so the
   two can never disagree, and so its edge cases are proven here rather than
   discovered on a phone: the area root must not light up on every page, a
   detail route belongs to its list, and a sibling that merely shares a
   prefix is not a match.
   ========================================================================== */

import { describe, expect, it } from 'vitest';
import { activeHref, hiddenCount, type NavItem } from '@/lib/nav';

const items: NavItem[] = [
    { href: '/portal', label: 'Today', tab: true },
    { href: '/portal/leads', label: 'Leads', count: 3, tab: true },
    { href: '/portal/jobs', label: 'Jobs', tab: true },
    { href: '/portal/jobs/calendar', label: 'Calendar' },
    { href: '/portal/candidates', label: 'Candidates', count: 2 },
    { href: '/portal/reviews', label: 'Reviews', count: 0 }
];

describe('activeHref', () => {
    it('matches the area root only exactly', () => {
        expect(activeHref('/portal', items, '/portal')).toBe('/portal');
        expect(activeHref('/portal/settings', items, '/portal')).toBeNull();
    });

    it('matches detail routes to their section', () => {
        expect(activeHref('/portal/leads/abc', items, '/portal')).toBe('/portal/leads');
    });

    it('prefers the longest prefix', () => {
        expect(activeHref('/portal/jobs/calendar', items, '/portal')).toBe('/portal/jobs/calendar');
        expect(activeHref('/portal/jobs/123', items, '/portal')).toBe('/portal/jobs');
    });

    it('does not match a sibling that shares a prefix', () => {
        expect(activeHref('/portal/jobsite', items, '/portal')).toBeNull();
    });
});

describe('hiddenCount', () => {
    it('sums badges on items that are not tabs, so More can show what it hides', () => {
        expect(hiddenCount(items)).toBe(2);
    });

    it('is zero when every badge is on a tab', () => {
        expect(hiddenCount(items.filter((i) => i.tab))).toBe(0);
    });
});
