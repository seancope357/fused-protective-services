# SPEC-012 Portal Mobile-First — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every portal screen mobile-first (phone, tablet, desktop) and ready for Cameron's first session.

**Architecture:** One lead rewrites the shared layer (CSS, frame, `DataTable`, `PageHead` action bar) first; page groups then convert in parallel with disjoint file ownership; a seeded local Supabase and a Playwright capture suite prove the result at 320/375/768/1280px.

**Tech Stack:** Next.js 16 App Router (server components + server actions), React 19, TypeScript 5.9, Supabase (`@supabase/ssr`), vitest 5, Playwright 1.56, @axe-core/playwright 4.13. No new dependencies.

**Spec:** `specs/SPEC-012-portal-mobile-first.md`

## Global Constraints

- Breakpoints, `min-width` only: base = phone; `600px` = tablet; `1024px` = desktop. Coarse pointer: `@media (pointer: coarse)`.
- Touch targets ≥ 44×44px on phone/tablet (`.btn` min-height 44px; `.btn--sm` 36px fine pointer, 44px coarse). Inline text links exempt.
- Inputs: 16px font, min-height 44px.
- No page may scroll horizontally at 320, 375, 768, 1280px; only an inner `overflow-x: auto` container may.
- Only `components/nav.tsx` becomes a new client component. Everything else stays server-rendered.
- No new npm dependencies. No schema migrations. Do not edit `src/` (marketing site) or `shared/`.
- Colours come from tokens; no inline hex in `app/src/**/*.tsx`.
- Visible copy is for an operator: no env-var names or repo paths outside a collapsed "Technical detail" disclosure.
- Keep existing behaviour of every server action, query and redirect unless a task says otherwise.
- Match surrounding code style: 4-space indent, single quotes, block comments that explain *why*.
- `pnpm typecheck` and `pnpm test` pass after every task (run from `app/`). Page tasks run `npx tsc --noEmit` without re-running `sync-shared` (the lead has already synced `app/shared/`), because parallel tasks share one worktree.
- Commit only files you own (see ownership table in the spec); message format `feat(spec-012): …`.

---

### Task 1: Foundation (lead)

**Files:**
- Modify: `app/src/styles/app.css` (mobile-first rewrite, status tokens, frame, chips, action bar, data-table, agenda, details, kv/timeline stacking, paper on phone)
- Modify: `app/src/app/layout.tsx` (export `viewport`)
- Modify: `app/src/components/shell.tsx` (renders sidebar + top bar + tab bar via `Nav`)
- Create: `app/src/components/nav.tsx` (`'use client'`)
- Create: `app/src/lib/nav.ts` (pure helpers)
- Create: `app/src/components/data-table.tsx`
- Modify: `app/src/components/ui.tsx` (`PageHead.primary`, `Chips`, `Disclosure`)
- Modify: `app/src/app/portal/layout.tsx` (tab flags; `must_change_password` redirect)
- Modify: `app/src/app/client/layout.tsx` (tab flags)
- Modify: `app/src/app/login/page.tsx`, `app/src/app/login/mfa/page.tsx` (`<main>`, `<h1>`)
- Test: `app/tests/nav.test.ts`

**Interfaces — Produces (every later task relies on these exact names):**

```ts
// lib/nav.ts
export type NavItem = { href: string; label: string; count?: number; tab?: boolean };
export function activeHref(pathname: string, items: NavItem[], root: string): string | null;
export function hiddenCount(items: NavItem[]): number; // sum of counts on items without tab

// components/data-table.tsx
export type Column<T> = {
    key: string;
    header: string;
    cell: (row: T) => React.ReactNode;
    primary?: boolean;
    num?: boolean;
    hide?: 'phone' | 'tablet';
};
export function DataTable<T>(props: { caption: string; columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string }): JSX.Element;

// components/ui.tsx (additions)
PageHead({ eyebrow?, title, actions?, primary?, children? })  // primary → action bar below 1024px
Chips({ label, items: { href: string; label: string; active: boolean }[] })  // nav aria-label=label
Disclosure({ summary, children, className? })  // styled <details>
```

CSS vocabulary later tasks use: `.stack`, `.row`, `.grid--2/3/4`, `.form-grid` + `.span-2`, `.card`, `.kv`, `.chips`, `.agenda` / `.agenda__day` / `.agenda__item`, `.calendar` (shown ≥768px), `.only-phone`, `.hide-phone`, `.status-good` / `.status-bad` / `.status-warn` (text colour), `.wrap-anywhere`.

- [ ] **Step 1: Write the failing test** — `app/tests/nav.test.ts`

```ts
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
    });
    it('does not match a sibling that shares a prefix', () => {
        expect(activeHref('/portal/jobsite', items, '/portal')).toBeNull();
    });
});

describe('hiddenCount', () => {
    it('sums badges on items that are not tabs', () => {
        expect(hiddenCount(items)).toBe(2);
    });
});
```

- [ ] **Step 2: Run it and see it fail** — `cd app && pnpm exec vitest run tests/nav.test.ts` → FAIL, cannot resolve `@/lib/nav`.
- [ ] **Step 3: Implement `lib/nav.ts`**

```ts
export type NavItem = { href: string; label: string; count?: number; tab?: boolean };

/** The item the current path belongs to. The area root matches only itself;
    everything else matches itself or a descendant, longest href winning. */
export function activeHref(pathname: string, items: NavItem[], root: string): string | null {
    let best: string | null = null;
    for (const { href } of items) {
        const hit = href === root ? pathname === root : pathname === href || pathname.startsWith(`${href}/`);
        if (hit && (!best || href.length > best.length)) best = href;
    }
    return best;
}

export const hiddenCount = (items: NavItem[]): number =>
    items.reduce((sum, i) => sum + (i.tab ? 0 : i.count ?? 0), 0);
```

- [ ] **Step 4: Run it and see it pass** — same command → PASS (5 tests).
- [ ] **Step 5: Frame.** `nav.tsx` renders the desktop sidebar links, the bottom tab bar and the More `<dialog>` (opened with `showModal()`, closed on Esc natively, on backdrop click, and in a `useEffect` on `usePathname()` change). `shell.tsx` passes `items`, `area`, `root`, `session` display name/role; keeps the skip link and `<main id="main">`.
- [ ] **Step 6: `DataTable`, `PageHead.primary`, `Chips`, `Disclosure`** per the interfaces above; `data-label` on every cell; explicit ARIA table roles; visually hidden `<caption>`.
- [ ] **Step 7: `app.css` rewrite** to the Global Constraints; remove `.table-wrap table { min-width }`; add status tokens and utilities listed above.
- [ ] **Step 8: Layouts.** Portal tabs: Today, Leads, Jobs, Invoices (`tab: true`). Client tabs: all four. `portal/layout.tsx`: read `app_metadata.must_change_password` from `supabase.auth.getUser()`; when true and the path is not `/portal/welcome`, `redirect('/portal/welcome')` (the layout receives no pathname — read it from the `x-pathname` header the proxy sets, adding that header in `lib/supabase/proxy.ts` if absent).
- [ ] **Step 9: Login `<main>` + `<h1>`** (A11Y-07).
- [ ] **Step 10: Verify** — `pnpm typecheck && pnpm test && pnpm build`; convert `/portal/leads` as the reference page; capture it at 375/768/1280.
- [ ] **Step 11: Commit** `feat(spec-012): mobile-first frame, DataTable and action bar`.

---

### Tasks 2–5: Page groups (parallel agents)

Each group converts its screens to the Task 1 vocabulary. For every screen in the group:

- [ ] Replace each `<div className="table-wrap"><table>…` with `DataTable` — pick one `primary` column (the thing a person taps), mark money `num`, hide low-value columns on phone/tablet (`hide`).
- [ ] Move the one main action of a detail/form screen into `PageHead primary`; keep secondary actions in `actions`.
- [ ] Replace filter button rows with `Chips`.
- [ ] Replace inline hex colours with `.status-*` classes; remove inline `style` that fights the layout (keep ones that are genuinely one-off and harmless).
- [ ] Give inputs the right `type` / `inputMode` / `autoComplete` / `enterKeyHint`.
- [ ] Rewrite developer-facing visible copy for an operator.
- [ ] `npx tsc --noEmit` (from `app/`), then commit only the group's files.

| Task | Files |
| :--- | :--- |
| 2 Pipeline | `portal/leads/**`, `portal/quotes/**`, `components/quote-form.tsx` |
| 3 Operations | `portal/jobs/**` (calendar: render `.calendar` grid and an `.agenda` list; CSS shows one), `portal/clients/**`, `components/job-form.tsx`, `components/client-form.tsx` |
| 4 Billing & records | `portal/invoices/**`, `portal/candidates/**`, `portal/reviews/**` (export snippet in `Disclosure` "For Sean: website snippet"), `portal/activity/**`, `portal/notifications/**`, `components/timeline.tsx` |
| 5 Client surfaces | `app/client/**` (not layout), `app/pay/**`, `app/officer/**`, `app/review/**`, `components/invoice-paper.tsx`, `components/proposal-paper.tsx`, `components/pay-panel.tsx`, `components/print-button.tsx` (print output must not change) |

---

### Task 6: Cameron-ready

**Files:** `portal/page.tsx`, `portal/settings/**`, `portal/security/**`, `portal/welcome/**` (new), `lib/actions/settings.ts`, `lib/domain/getting-started.ts` (new), `lib/domain/queries.ts` (add `gettingStartedFacts()` only), test `app/tests/getting-started.test.ts`.

**Interfaces — Produces:**

```ts
// lib/domain/getting-started.ts
export type StartFacts = { alertsSet: boolean; clients: number; quotesSent: number; jobs: number; invoicesSent: number };
export type StartStep = { id: 'alerts' | 'client' | 'quote' | 'job' | 'invoice'; label: string; href: string; done: boolean };
export function gettingStartedSteps(f: StartFacts): StartStep[];   // always 5, in that order
export const allDone = (steps: StartStep[]): boolean => steps.every((s) => s.done);
```

- [ ] **Step 1: Failing test** `app/tests/getting-started.test.ts`: all-zero facts → 5 steps, none done, hrefs `/portal/settings`, `/portal/clients/new`, `/portal/quotes/new`, `/portal/jobs/new`, `/portal/invoices`; full facts → `allDone` true; `alertsSet` alone → only `alerts` done.
- [ ] **Step 2:** run → FAIL. **Step 3:** implement. **Step 4:** run → PASS.
- [ ] **Step 5:** Today renders the card while `!allDone`; stats 2×2 on phone; unpaid invoices via `DataTable`.
- [ ] **Step 6:** Settings plain-English integrations + "Technical detail" `Disclosure`; site facts copy; message rules as sentences in a `Disclosure`.
- [ ] **Step 7:** `createStaffUser` passes `app_metadata: { must_change_password: true }`; `/portal/welcome` page + `setInitialPassword` action (12+ chars, confirm match, `supabase.auth.updateUser({ password })`, then service-role `auth.admin.updateUserById(id, { app_metadata: { must_change_password: false } })`, then `redirect('/portal')`).
- [ ] **Step 8:** Security: first-time explanation above the enrolment panel when `?enroll=1`.
- [ ] **Step 9:** `pnpm exec vitest run tests/getting-started.test.ts && npx tsc --noEmit`; commit.

---

### Task 7: Verify and review (lead + reviewer)

- [ ] `pnpm typecheck && pnpm test && pnpm build` in `app/`.
- [ ] Seed and capture (`app/scripts/README-demo.md`), label `after`; compare `report.json` with `before`.
- [ ] Fix every overflow and every small target; confirm no axe rule appears that the baseline lacked.
- [ ] Read the phone screenshots of Today, Leads, a lead, a job, an invoice, Settings, the More sheet, the client overview and the pay page.
- [ ] Independent code review of the branch diff; address findings.
- [ ] Update `context/architecture.md` (frame, breakpoints, `DataTable`), `context/ui-standards.md` (portal responsive rules), `docs/A11Y-AUDIT.md` (A11Y-07 closed), `specs/README.md` status, `context/progress-tracker.md`.
- [ ] Commit; report to Sean with before/after evidence.
