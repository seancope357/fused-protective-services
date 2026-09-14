# SPEC-012 — Portal: mobile-first, and ready for Cameron
**Gate:** GO_LIVE.md → F1 (Cameron's dry run) · **Surface:** portal (`app/`) only
**Size:** L · **Depends on:** — · **Human blocker:** none to build; Cameron's first sign-in to prove it

## Why

The portal is built for a laptop, and the person who will run it lives on a phone.

- **The frame collapses badly.** Below 900px the 12-item sidebar wraps into a block of links above
  every page (`app/src/styles/app.css:79`). There is no current-page indicator anywhere: the CSS styles
  `.shell__link[aria-current="page"]`, but `NavLink` never sets the attribute (`components/shell.tsx:40`).
- **Every list scrolls sideways.** 20 tables of 4–9 columns sit in `.table-wrap`, whose table has
  `min-width: 560px`. On a 375px phone every inbox is a horizontal scroll.
- **Controls are desktop-sized.** `.btn` is ~38px tall and `.btn--sm` ~30px, below the 44pt touch target
  in Apple's HIG and the 48dp in Material; inputs are 14.5px, so iOS Safari zooms the page on every
  focus (it zooms any focused field under 16px).
- **The calendar is a 7-column grid** at every width — slivers on a phone.
- **Cameron's first session is written for the developer.** Settings shows `RESEND_API_KEY`,
  `docs/RUNBOOK.md`, `src/data/*.mjs` and `app/src/lib/notifications/templates.ts`; Reviews asks him to paste
  a snippet into a source file. An account made with a temporary password is never asked to change it.
  An empty Today shows four zeros and no next step.
- **Colours bypass the tokens.** Status colours are inline hex (`#fca5a5`, `#6ee7b7`) in page files.
- **A11Y-07** (open): portal `/login` has no `<h1>` and no `<main>`.

## Scope

**In**
- Mobile-first rewrite of `app/src/styles/app.css`: phone base, tablet at **600px**, desktop at **1024px**.
- New application frame: phone/tablet top bar + bottom tab bar + "More" sheet; desktop sidebar.
- One list primitive (`DataTable`) that renders a real table on tablet/desktop and labelled cards on a phone.
- Page-head primary action pinned above the tab bar on phone/tablet.
- Touch sizing, input sizing, chip-strip filters, calendar agenda view, stacked key/value and timeline.
- Every screen under `app/src/app/portal/**`, `app/src/app/client/**`, `/pay/[token]`, `/login`, `/login/mfa`,
  `/officer`, and the proposal/invoice paper components.
- Cameron-ready content: plain-English Settings, getting-started checklist on Today, forced password change on
  first sign-in, first-time explanation on two-factor enrolment, plain-language page copy.
- Status colour tokens replacing inline hex.
- A seeded local stack and a responsive capture suite that proves the result (`app/tests/responsive.test.ts`).

**Out**
- The marketing site and `src/styles/tokens.css` values — including the two pending brand-token contrast
  decisions (`docs/A11Y-AUDIT.md`). This spec neither fixes nor worsens them.
- New features, schema changes, Phase 2 officer screens.
- Arming the CI a11y gate (SPEC-008's follow-up).
- Dark/light theming, icons library, PWA install.

## Design

### 1. Breakpoints and the frame

Written mobile-first with `min-width` queries only: base = phone; `@media (min-width: 600px)` = tablet;
`@media (min-width: 1024px)` = desktop. Pointer-dependent sizing uses `@media (pointer: coarse)`.

**Phone and tablet (< 1024px)**
- Sticky **top bar**: logo, brand, current area. Environment banner stays above it (unchanged, SPEC-002).
- Fixed **bottom tab bar**, five slots, each ≥ 44px tall, padded by `env(safe-area-inset-bottom)`:
  Today · Leads (badge) · Jobs · Invoices (overdue badge) · **More**. Client portal: its four items, no More.
- **More** opens a native `<dialog>` sheet (focus trap, Esc, backdrop) listing the remaining destinations
  (Quotes & proposals, Clients & sites, Candidates (badge), Reviews, Activity, Message log, Settings, Security),
  the signed-in account, and Sign out. The More tab shows the sum of badges it hides.
- Root layout exports `viewport` with `viewportFit: 'cover'` and a `themeColor` matching `--color-void`.

**Desktop (≥ 1024px)**: the existing sticky sidebar, restyled to the new spacing.

**Mechanics.** `components/shell.tsx` stays a server component and renders both navs; CSS shows one per
breakpoint (`display: none` removes the other from the accessibility tree). A new client component
`components/nav.tsx` owns: `aria-current="page"` (exact match for the area root, longest-prefix match
otherwise), the More dialog, and closing it on route change (`usePathname`). Nav items gain `tab?: boolean`.
Nothing else becomes a client component.

### 2. Lists: `DataTable`

`components/data-table.tsx`, a server component:

```tsx
type Column<T> = {
  key: string;
  header: string;                    // also the card label on phone
  cell: (row: T) => React.ReactNode;
  primary?: boolean;                 // exactly one: the card title on phone; holds the row link
  num?: boolean;                     // right-aligned, tabular figures
  hide?: 'phone' | 'tablet';         // hidden below 600px, or below 1024px
};
<DataTable caption="Leads" columns={cols} rows={leads} rowKey={(l) => l.id} />
```

- Always a semantic `<table>` with a `<caption>` (visually hidden). Because phone CSS changes table display
  values — which makes some browsers (notably Safari/VoiceOver) drop table semantics — the component sets
  explicit `role="table" | "rowgroup" | "row" | "columnheader" | "cell"` (the pattern documented by Adrian
  Roselli, "A Responsive Accessible Table").
- **Phone:** header row visually hidden; each row is a card: the primary cell first as the title, then
  label/value pairs from `data-label`, badges inline. The primary cell's link is stretched over the card
  (`::after` inset 0) so the whole card is the tap target; any other interactive element in a row sits above it.
- **Tablet/desktop:** a normal table; `min-width` removed; `.table-wrap` keeps `overflow-x: auto` only as a
  safety net inside its card, never on the page.
- Empty state stays the caller's `<Empty>`.

### 3. Page head, actions, forms, controls

- `PageHead` gains `primary?: React.ReactNode`. Desktop renders it first in the actions row. Below 1024px it
  moves into a fixed **action bar** above the tab bar (full-width button, safe-area aware); `main` gets
  bottom padding so content is never covered. Secondary `actions` wrap below the title.
- **Touch targets:** `.btn` min-height 44px; `.btn--sm` 36px on fine pointers, 44px under `pointer: coarse`.
  WCAG 2.2 SC 2.5.8 (24px) is the floor; 44px is the product standard here.
- **Inputs:** 16px text, min-height 44px, correct `type`/`inputmode`/`autocomplete`/`enterkeyhint` where the
  field implies one (tel, email, numeric money, one-time-code).
- `.form-grid`: one column on phone, auto-fit from tablet. Long forms (quote, job) put their submit in the
  page's action bar on phone.
- **Filter rows** become `.chips`: a single horizontally scrollable strip with scroll-snap on phone (the strip
  scrolls, the page does not), wrapping rows from tablet. Active chip carries `aria-current="true"`.
- `details > summary` is a 44px row with a disclosure marker.
- `.kv` stacks label over value on phone. `.timeline__item` stacks time over event on phone.
- `.grid--4` stats: two columns on phone. `h1` scales down; long names wrap (`overflow-wrap: anywhere` on
  cells, titles and `dd`).
- **Calendar:** grid from 1024px; below that an agenda list (days that have shifts, each shift a row). A month grid's chips cannot reach 44px, so touch tablets get the agenda.
  The page renders both; CSS shows one.
- **Paper (proposal/invoice):** brand header stacks on phone; line-item table scrolls inside the paper on phone
  only; print output unchanged.
- **Colour tokens:** add `--status-good`, `--status-bad`, `--status-warn` (+ `-bg`, `-border`) to `app.css`;
  replace every inline hex in `app/src`.
- **Motion:** sheet and action bar transitions honour the existing reduced-motion clamp.

### 4. Ready for Cameron

- **Today:** a "Getting started" card while any step is incomplete, each step linking to where it is done:
  alert email and phone set (Settings) · first client · first quote sent · first job scheduled · first invoice
  sent. Derived from existing tables with head counts; no new storage; hidden when all are done.
  Stats become a 2×2 grid on phone; "Unpaid invoices" uses `DataTable`.
- **Settings in plain English:** integrations read "Connected" / "Not connected yet — Sean is setting this up";
  the variable names move into a collapsed "Technical detail" disclosure. Site facts read "Shown on the
  website. Ask Sean to change these." Message rules become a collapsed list of sentences
  ("When a proposal is accepted → text and email you").
- **First sign-in:** `createStaffUser` sets `app_metadata.must_change_password = true` (service-role only;
  users cannot write `app_metadata`). After two-factor, the portal layout redirects such a user to
  `/portal/welcome`, which sets a new password and clears the flag server-side. The Security enrolment view
  explains, on first visit, why an authenticator is required and which apps work.
- **Copy:** developer phrasing on visible pages is rewritten for an operator (e.g. "Numbers are minted by the
  database…" → "Invoice numbers are assigned automatically. Payments update on their own when a client pays.").
  Stage selects use human labels. The Reviews export moves into a "For Sean: website snippet" disclosure.
- **A11Y-07:** `/login` and `/login/mfa` get `<main>` and an `<h1>`.

## Verification

`app/tests/responsive.test.ts` against a seeded local Supabase (`app/scripts/seed-demo.mjs`,
`app/scripts/README-demo.md`), signing in through the real password + TOTP flow, capturing every screen at
**375×812, 768×1024, 1280×800** (and 320px on the list screens for WCAG 1.4.10 reflow).

## Acceptance criteria

1. No screen scrolls horizontally at 320, 375, 768 or 1280px (`scrollWidth ≤ innerWidth + 1`), signed in as
   owner and as client, on seeded data that includes long names and addresses.
2. On phone and tablet, no visible control in the frame, page heads, forms, chips or cards is smaller than
   44×44px; inline links in running text are exempt.
3. Every list renders as cards below 600px and as a table from 600px, with table semantics exposed in both.
4. The current destination is marked `aria-current="page"` in whichever nav is visible; More opens as a modal
   dialog, traps focus, closes on Esc and on navigation.
5. Primary actions are reachable without scrolling on phone on every detail and form screen.
6. No inline hex colour remains in `app/src/**/*.tsx`.
7. Settings, Today, Reviews and page heads contain no environment-variable names or repository paths outside a
   collapsed technical disclosure.
8. A staff account created from Settings is required to set a new password after its first two-factor sign-in.
9. axe (wcag2a/2aa/21a/21aa/22aa) reports no violation on any screen that the baseline capture did not already
   report; `/login` has one `<h1>` and a `<main>`.
10. `pnpm typecheck`, `pnpm test` and `pnpm build` pass; proposal and invoice print previews are unchanged.

## Execution

One lead owns the foundation; page groups then run in parallel with disjoint file ownership. No task edits
another task's files; a page task that needs a new primitive reports it instead of adding CSS.

| Task | Owner | Files |
| :--- | :--- | :--- |
| T0 Harness | agent | `app/scripts/seed-demo.mjs`, `app/tests/responsive.test.ts`, `app/scripts/README-demo.md`, `supabase/config.toml` (local MFA), `.gitignore`, `app/package.json` scripts |
| T1 Foundation | lead | `app/src/styles/app.css`, `app/src/app/layout.tsx`, `components/shell.tsx`, `components/nav.tsx`, `components/ui.tsx`, `components/data-table.tsx`, `app/portal/layout.tsx`, `app/client/layout.tsx`, `app/login/**` |
| T2 Pipeline | agent | `portal/leads/**`, `portal/quotes/**`, `components/quote-form.tsx` |
| T3 Operations | agent | `portal/jobs/**` (incl. calendar), `portal/clients/**`, `components/job-form.tsx`, `components/client-form.tsx` |
| T4 Billing & records | agent | `portal/invoices/**`, `portal/candidates/**`, `portal/reviews/**`, `portal/activity/**`, `portal/notifications/**`, `components/timeline.tsx` |
| T5 Client surfaces | agent | `app/client/**` (except layout), `app/pay/**`, `app/officer/**`, `app/review/**`, `components/invoice-paper.tsx`, `components/proposal-paper.tsx`, `components/pay-panel.tsx`, `components/print-button.tsx` |
| T6 Cameron-ready | agent | `portal/page.tsx`, `portal/settings/**`, `portal/security/**`, `portal/welcome/**` (new), `lib/actions/settings.ts`, `lib/domain/queries.ts` (getting-started counts only). The `must_change_password` redirect lives in `portal/layout.tsx`, so T1 adds it. |
| T7 Verify & review | lead + reviewer | capture, fix, independent review, docs |
