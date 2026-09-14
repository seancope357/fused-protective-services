# 📈 PROGRESS — Fused Protective Services

> **Living operational status, completed milestones, active workstreams, and known gaps.**  
> *Last Updated: 2026-09-14 — PR #10 go-live work (seven of eleven specs done), client-facing copy refinements, and a documentation audit.*

Latest focused implementation status: [Client-facing website refinements](context/progress-tracker.md).

---

## 🚦 System Health & Deployment Readiness

| Dimension | Current Status | Notes |
| :--- | :--- | :--- |
| **Compiler & Build Pipeline** | 🟢 **Passing (Zero Drift)** | `node build.mjs --check` validates byte-identical output. |
| **Dependencies** | 🟢 **Zero Dependencies (site)** | Static site and `api/`: pure Node.js ESM, no root `package.json`. The portal in `app/` is a separate pnpm workspace. |
| **Marketing Web Platform** | 🟢 **Production Ready** | All 7 divisions, estimator, assessment quiz, and intake live. Zero third-party origins; three.js and the fonts are vendored. |
| **Operations Portal** | 🟢 **Live** | `app/` (Next.js 16 + Supabase) at https://fused-portal.vercel.app — leads → quotes → proposals → jobs → invoices → payments → reviews, client portal, notification engine, hourly scheduler. Owner account exists. |
| **Invoicing** | 🟢 **Server-side** | Numbers minted by Postgres; payments from the Stripe webhook. The old `/invoice` page is now an export tool for legacy browser records; import at Portal → Invoices → Import legacy. |
| **Client-facing email** | 🔴 **Blocked on Resend** | Proposals, briefs, invoices, receipts and client sign-in links all wait on `DISPATCH_ALERT_FROM` (verified sender). Every skipped send is logged. |
| **Payments** | 🟡 **Code live, no Stripe keys** | Pay page and webhook deployed; `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` absent, so the pay button explains that online payment is unavailable. |
| **Legal pages** | 🟡 **Draft** | `/privacy`, `/terms`, `/sms-consent` generated from `src/data/legal.mjs`, banner-marked pending attorney review, `noindex`. |
| **Careers & Recruiting Portal** | 🟢 **Production Ready** | `/careers` live with filterable jobs, 5-stage vetting, & pre-qual. |
| **Context Engineering** | 🟢 **Current (8 documents)** | Seven domain documents plus the current-unit tracker in [`context/`](context/index.md); audited against the code 2026-09-14. |
| **Lead Persistence** | 🟢 **Live (hosted Supabase)** | All 15 migrations applied, versions aligned to filenames (2026-09-14). A labelled production test lead (`TX-FPS-Z8NHSG`) persisted with `source_env = production` and was then deleted; the portal cron tick returns 200. |
| **Dispatch Alerts** | 🟡 **Code shipped, Resend not installed** | Owner email, emergency SMS, and visitor confirmation are all wired in `api/intake.mjs`; `RESEND_API_KEY` and the Twilio variables are absent. Steps in `docs/RUNBOOK.md`. Until then leads persist and nobody is notified. |
| **Intake Abuse Controls** | 🟢 **Live** | Same-origin CORS, honeypot, per-IP rate limit and duplicate window (`public.intake_gate`). |
| **Stripe Checkout** | 🟢 **Honest** | Amount read from the stored invoice by id; 503 without a key. No mock links anywhere. |
| **Phone Line** | 🟢 **Confirmed** | `(512) 555-0199` confirmed by Sean 2026-09-09; placeholder flag cleared. |
| **DPS Licence Number** | 🔴 **Placeholder, flagged** | Footer and schema carry `B00000` until Cameron supplies the number. `docs/OPEN_QUESTIONS.md` §2. |
| **Environment separation** | 🟢 **Code done, account pending** | Preview deploys label every row `source_env` and send nothing — owner email, emergency SMS, visitor confirmation and webhook all skip and report `non_production_env` rather than faking. The production scheduler filters preview rows. Sean still has to create the Supabase `preview` branch (`docs/RUNBOOK.md` §1a); until then previews share the production database, labelled and silent. |
| **Accessibility** | 🟡 **Audited, gate staged** | `docs/A11Y-AUDIT.md`: 48 automated + 12 manual findings, each with file, selector, rule id and fix. The skip-link defect is fixed. Four CSS value changes clear all 48; the gate arms after those land. |
| **Backup & restore** | 🟡 **Verifier proven, drill unrun** | `app/scripts/verify-restore.mjs` runs in CI against a real migrated database on every push (20/20 tables, RLS, invoice-sequence reissue check). The drill itself ships banner-marked **never run** — it needs Supabase dashboard access. `docs/RESTORE-DRILL.md`. |
| **Incident response** | 🟢 **Written** | `docs/INCIDENT.md`: first-minute triage across both Vercel projects, four reversible stop-the-bleeding actions, five scenarios. Writing it corrected four things this tracker had wrong. |
| **Error reporting** | 🟡 **Built, alerting dark until Resend** | `api/_lib/report.mjs` (zero-dependency) on the static site and `api/`; `@sentry/nextjs` in the portal, server and edge runtimes only, `tracesSampleRate: 0`, no session replay. Browser errors to `/api/client-error` with no PII. Alerts deduplicated through `public.alert_gate` — a storm produces a handful of emails with a suppressed count. **Emails nothing until `DISPATCH_ALERT_FROM` is set**, and logs the skip rather than faking it. |
| **Security headers (marketing site)** | 🟢 **Locked down** | `default-src 'self'` with **no allowlisted origin**, no `unsafe-inline`, no `unsafe-eval`; `frame-ancestors 'none'` + `X-Frame-Options: DENY`; HSTS. three.js and all three typefaces are self-hosted, so the page loads nothing third-party. `vercel.json` is generated by `build.mjs` and covered by `--check`. Zero violations on six pages in Chromium, enforcing, with an 18/18 negative control. |
| **Review Markup** | 🟢 **Removed** | No rating is claimed. `src/data/reviews.mjs` re-enables it only from real reviews. |
| **CI** | 🟢 **GitHub Actions** | Four jobs on every push and PR: `site` (drift check + API tests), `portal` (typecheck, vitest incl. RLS/numbering/ATS against Postgres 17, restore-verifier, `next build`), `a11y` (WCAG 2.1 AA scan, reporting — not yet blocking), `release-gate` (`--verify-release`, tags and manual dispatch only). |

---

## ✅ Completed Milestones

### Phase 1: Core Architecture & Zero-Dependency Toolchain
- [x] Implemented standalone `build.mjs` compiler with zero external npm dependencies.
- [x] Configured deterministic compilation generating `index.html`, `css/site.css`, `invoice.html`, and `css/invoice.css`.
- [x] Established `node build.mjs --check` CI/pre-commit drift detection with exit code `1` on mismatch.
- [x] Created lightweight local preview server (`serve.py`) on port 5050.
- [x] Configured static deployment recipes for Vercel (`vercel.json`), Cloudflare Pages, and Netlify.

### Phase 2: Data-Driven Anti-Drift Architecture
- [x] Eliminated 5-way manual drift across bookshelf, form, SEO, quiz, and estimator.
- [x] Built single-source-of-truth data layer in `src/data/` (`site.mjs`, `divisions.mjs`, `estimator.mjs`, `protocol.mjs`, `assessment.mjs`, `intake.mjs`, `faq.mjs`, `icons.mjs`, `invoice.mjs`).
- [x] Established the immutable `quoteValue` contract across all interactive widgets and lead payloads.
- [x] Implemented automated Schema.org JSON-LD generation (`LocalBusiness`, `OfferCatalog`, `FAQPage`).
- [x] Created client state island (`#fps-config`) eliminating hardcoded business data in JavaScript.

### Phase 3: Interactive Experiences & WebGL Assembly Engine
- [x] Integrated scroll-driven Three.js WebGL voxel assembly engine (`js/logo-forge.js`, ~65k cubes).
- [x] Established dual-clock contract: `--assembly` (scroll position) vs `--assembly-settled` (camera arrival).
- [x] Implemented CDN fallback redundancy (jsDelivr $\rightarrow$ unpkg) and static fallback plate (`data-forge-fallback`). *Superseded 2026-09-14 by SPEC-006: three.js is vendored at `js/vendor/three.module.js`; there is no CDN.*
- [x] Built ambient particle background canvas and interactive cursor spotlight glow (`ambient.mjs`).
- [x] Designed bespoke 2D gold tactical SVG emblem library (officially rejected 3D icon replacement for clarity and performance).

### Phase 4: High-Converting Tactical Marketing & Intake Flow
- [x] Built Tactical Bookshelf component with smooth `--ease-studio` sliding rail transitions and payload reveal.
- [x] Implemented accessible ARIA tablist for 4-phase Deployment Protocol with full arrow-key keyboard navigation.
- [x] Built 60-Second Threat Assessment quiz with deterministic escalation logic.
- [x] Built interactive Coverage & Budget Estimator with dynamic officer/hour sliders and tier selectors.
- [x] Built Security Detail Intake form with automated pre-fill from quiz/estimator and screen reader live region status (`#formStatus`).

### Phase 5: Internal Invoicing Subsystem (`/invoice`) — *superseded by the portal in Phase 1 (2026-09-09); `/invoice` now only exports legacy records*
- [x] Created standalone `/invoice` builder route (`invoice.html` + `css/invoice.css`).
- [x] Configured auto-numbering format (`FPS-YYYY-####`) incrementing strictly on invoice save.
- [x] Integrated automated payment terms (Due on Receipt, Net 7, Net 15, Net 30 default) and due-date calculation.
- [x] Built automatic Austin/Texas 8.25% sales tax calculation engine.
- [x] Implemented `@media print` single-page Letter stylesheet (`invoice-print.css`).
- [x] Integrated browser `localStorage` invoice store (`fps_invoices_v1`).

### Phase 6: 7-File Context Engineering Architecture (an eighth, `context/progress-tracker.md`, now tracks the current unit)
- [x] Transformed monolithic blueprint into 7 specialized domain steering documents in [`context/`](file:///Users/cope/projects/fused-protective-services/context/):
  1. [`context/index.md`](file:///Users/cope/projects/fused-protective-services/context/index.md) — Master Index, The One Rule, Task Router.
  2. [`context/business.md`](file:///Users/cope/projects/fused-protective-services/context/business.md) — Client, 7 Divisions, Rate Cards, Quiz Logic.
  3. [`context/architecture.md`](file:///Users/cope/projects/fused-protective-services/context/architecture.md) — Toolchain, WebGL Engine, Island State.
  4. [`context/data-model.md`](file:///Users/cope/projects/fused-protective-services/context/data-model.md) — Data Schemas, `quoteValue` Contract, SEO.
  5. [`context/code-standards.md`](file:///Users/cope/projects/fused-protective-services/context/code-standards.md) — Tagged Templates, Escaping, CSS Layers.
  6. [`context/ui-standards.md`](file:///Users/cope/projects/fused-protective-services/context/ui-standards.md) — Design Tokens, Motion Physics, A11y Baseline.
  7. [`context/workflows.md`](file:///Users/cope/projects/fused-protective-services/context/workflows.md) — Runbooks, Lead Seams, Cameron's Gaps.
- [x] Streamlined root [`PROJECT_CONTEXT.md`](file:///Users/cope/projects/fused-protective-services/PROJECT_CONTEXT.md) as the primary project gateway.

### Phase 7: Tactical Careers & Officer Recruitment Portal (`/careers`)
- [x] Researched elite private security recruitment best practices (Gavin de Becker, Constellis) and Texas DPS PSB Level III/IV regulatory standards.
- [x] Created `src/data/careers.mjs` single source of truth for 5 tactical positions, 5-stage vetting protocol, officer benefits, and pre-qualification criteria.
- [x] Built interactive Careers templates (`src/templates/careers/`): Hero, Pre-Qual Checker, Benefits Grid, Filterable Postings, Vetting Timeline, and Candidate Intake Form.
- [x] Implemented Schema.org `JobPosting` JSON-LD structured data for automated Google Jobs indexing.
- [x] Integrated client-side controller `js/modules/careers.mjs` for category filtering, accordion toggle, prequal logic, and candidate submission.
- [x] Updated `build.mjs` compiler to generate `careers.html` and compile `careers.css` into `css/site.css` with zero drift.
- [x] Configured clean URL support in `serve.py` and `vercel.json` for `/careers`.

### Phase 8: Supabase Backend, PostgreSQL Relational Schema & Ingestion Engine
- [x] Initialized Supabase architecture and authored deterministic PostgreSQL migration [`20260904000000_fused_core_schema.sql`](file:///Users/cope/projects/fused-protective-services/supabase/migrations/20260904000000_fused_core_schema.sql).
- [x] Built relational tables: `client_quotes` (leads/bookings), `candidate_applications` (recruiting ATS), and `invoices` (billing records).
- [x] Created automated PostgreSQL threat triage triggers (`trg_triage_quote`) escalating `priority` to `'emergency'` for rapid dispatch and Level IV PPO requests.
- [x] Implemented Row Level Security (RLS) policies allowing public anon insertion while securing all read/update access.
- [x] Created Supabase Deno Edge Function [`supabase/functions/intake-dispatcher/index.ts`](file:///Users/cope/projects/fused-protective-services/supabase/functions/intake-dispatcher/index.ts).
- [x] Created zero-dependency Vercel Serverless Function [`api/intake.mjs`](file:///Users/cope/projects/fused-protective-services/api/intake.mjs) for instant production deployment.
- [x] Updated local preview engine ([`serve.py`](file:///Users/cope/projects/fused-protective-services/serve.py)) with `/api/intake` routing and direct persistence to local PostgreSQL (`fused_protective_services`).
- [x] Wired client controllers ([`quote-form.mjs`](file:///Users/cope/projects/fused-protective-services/js/modules/quote-form.mjs) and [`careers.mjs`](file:///Users/cope/projects/fused-protective-services/js/modules/careers.mjs)) to `/api/intake` with local offline resilience.
- [x] Completed full automated browser submission validation and verified row insertions in PostgreSQL.
- [x] Documented complete HubSpot CRM property mapping and webhook integration recipes in [`context/workflows.md`](file:///Users/cope/projects/fused-protective-services/context/workflows.md).

### Phase 9: San Antonio Operations, Market Pay Scales & Nightlife Division
- [x] Added **DIV-07 // VENUE** (Restaurant, Bar & Nightlife Venue Security) to `src/data/divisions.mjs`; renders into the bookshelf, quote `<select>`, `OfferCatalog`, and a new assessment quiz option with bespoke `nightlife` spine/quiz emblems.
- [x] Surfaced San Antonio as a primary area of operation: hero intro, SEO copy, FAQ, careers postings, and a footer "Areas of Operation" line derived from `site.areaServed`.
- [x] Reset officer pay scales to San Antonio–Austin market rates (Level IV $30–$60, Level III $20–$40, Level II $16–$25, Dispatch $18–$25) in `payScales`, every posting, and the `JobPosting` schema.
- [x] Added the gear policy (own gear preferred; repayable stipend deducted from pay) to the benefits grid, pay-scale strip, and armed posting requirements.
- [x] Stated operational experience standards (confirmed skilled civilian personnel alongside military and law enforcement) as a fourth Fused Standard card and in vetting Stage 1.
- [x] First hero intro now names commissioned armed **and** unarmed officers.

### Phase 10: Careers CTA Polish & Page Motion
- [x] Defined the missing `.btn-outline` (plus `.btn-sm` / `.btn-block`) in `buttons.css`: the careers "Check Eligibility" link rendered as a default blue anchor because no rule matched its class.
- [x] Added a scroll-reveal system (`components/reveal.css` + `js/modules/reveal.mjs`) applied to every section head and card on both pages, gated by `@media (scripting: enabled)` so no-JS visitors see a complete page and no inline script is required.
- [x] Added a staged CSS entrance for the careers hero (`careersHeroRise`), fully clamped under `prefers-reduced-motion`.

### Phase 11: Hosted Backend & Real Lead Delivery (2026-09-08)
- [x] Provisioned the hosted Supabase project through the Vercel Marketplace; env vars auto-injected into all Vercel environments.
- [x] Applied the core schema and a `search_path` hardening migration; migration history aligned to the committed file names.
- [x] Rewrote `api/intake.mjs` as a three-stage delivery chain (persist → Resend email → webhook) that reports per-stage success and returns 503 when nothing was delivered.
- [x] Server-generated collision-safe reference codes; user text escaped in alert emails.
- [x] Form controllers now show a failure message instead of a fake success when delivery fails.
- [x] Verified on preview and production: rows land in Supabase, DB trigger escalates emergency divisions.

### Audit log and timelines (2026-09-09)
- [x] `public.audit_log`: trigger-fed, append-only record of every insert/update/delete on clients, sites, leads, quotes, proposals, jobs, shifts, invoices, payments, reviews and settings — actor, per-column old/new diff, one-line summary, parent grouping (migration `20260910000009`; DB test covers diff, no-op suppression, staff-only read, no delete).
- [x] Timeline on every job, invoice, quote, client and lead page merging changes with the message log; global feed at Portal → Activity.

### Security hardening (2026-09-09)
- [x] Staff MFA (TOTP) enrolled at Portal → Security, challenged at sign-in, and enforced by `is_staff()` in the database (migration `20260910000008`; proved in `tests/db/rls.test.ts`).
- [x] Login rate limiting per address and per email through the shared `intake_gate` function.
- [x] Session lifetime policy in the proxy: 8 h idle, 72 h absolute, with a plain reason on the login page.
- [x] Nonce-based Content Security Policy (`strict-dynamic`, no unsafe script sources, `frame-ancestors 'none'`) and HSTS.

### Phase 1: Lead to cash — the operations platform (2026-09-09)
- [x] **Data model** — seven additive migrations (`20260910000001` … `07`): `profiles` with roles, `clients`, `sites`, `quotes`, `proposals`, `jobs`, `shifts`, `officers` + `shift_assignments` (Phase 2 seams), reshaped `invoices` (cents columns, generated dollar columns, sequence-minted numbers, pay tokens), `payments`, `stripe_events`, `reviews`, append-only `notifications`, `settings`, SMS consent columns, `sms_opt_outs`. Every table has RLS; cross-table policies go through SECURITY DEFINER helpers so the policy graph is acyclic. Applied to the hosted project with versions aligned to filenames.
- [x] **Auth** — Supabase Auth; owner/staff by password, clients and officers by magic link minted server-side and emailed through Resend (branded, deliverable to anyone once the sender is verified). Roles enforced in RLS: `tests/db/rls.test.ts` proves a client cannot read another client's invoice, drafts are invisible, an officer sees only assigned shifts, anon sees nothing.
- [x] **Owner portal** `/portal` — dashboard (leads needing response, next 7 days, unpaid with aging, collected this month), leads inbox with one-click convert-to-quote, quotes + proposal editor + send, jobs (list, calendar, shifts, recurrence, brief, complete), invoices (generate from shifts, deposit/balance, edit drafts, send with pay link + in-page QR, manual payments, void), clients & sites, reviews, message log, settings (recipients, defaults, integrations check, staff accounts, password change).
- [x] **Client portal** `/client` — proposal with binding acceptance (typed name, timestamp, IP, user agent; emailed copy; job auto-created), upcoming/past details with the brief, invoices with pay button, review form. Public `/pay/[token]` and `/review/[token]` reached from email without login.
- [x] **Payments** — Stripe Checkout (card + ACH) for the stored balance only; webhook verifies the signature, deduplicates by event id, updates invoice + payment in one Postgres transaction (`apply_stripe_payment_event`), sends receipt + owner alert. Deposit % on quotes/jobs; balance invoice credits the deposit pre-tax. QR generated in-process.
- [x] **Notification engine** — table-driven matrix (`app/src/lib/notifications/templates.ts`, 14 rules) + engine with SMS consent and STOP enforcement + hourly scheduler (`/api/cron/tick`: 2h unanswered leads, 24h reminders, unstaffed warning, review request +24h, overdue day 1/7/14, 7am Central digest), all idempotent through `notifications.dedupe_key`. The intake function logs its sends to the same table.
- [x] **SMS compliance** — consent checkbox with disclosure on both intake forms, stored with timestamp; Twilio inbound webhook records STOP/START; `/sms-consent` program terms page.
- [x] **Legal pages** — `privacy.html`, `terms.html`, `sms-consent.html` generated by `build.mjs` from `src/data/legal.mjs`, draft-banner until `reviewed: true`.
- [x] **Legacy invoices** — `/invoice` shows the browser's saved records as JSON to paste into Portal → Invoices → Import legacy (totals recomputed and checked; sequence bumped past imported numbers).
- [x] **Tests** — 38 in `app/tests` (tax arithmetic, deposit/balance maths, legacy parsing, notification rules and scheduler conditions, Stripe event interpretation, shift materialisation, RLS, 40-way concurrent numbering, payment idempotency) + 7 intake tests. CI runs both suites, typecheck and `next build`.
- [x] **Deployed** — `fused-portal` Vercel project, Git-connected since 2026-09-09: every push to `main` deploys both projects (`docs/RUNBOOK.md` §5b). Owner account created; cron verified on production.
- [ ] **Blocked on accounts** — Resend sender, Twilio, Stripe keys, custom domains (`docs/OPEN_QUESTIONS.md`).

### Phase 0: Stop the bleeding (2026-09-09)
- [x] Phone number and DPS licence number carry `placeholder: true` in `src/data/site.mjs`; the build warns on every run.
  **Superseded by SPEC-001 (2026-09-14):** the flag was host-gated through `js/modules/env.mjs`, whose
  `productionHosts` list already contained the live `.vercel.app` alias — so `B00000` was rendering
  *unflagged* on the public site. `env.mjs` is deleted; the flag now renders on **every** host with no
  JavaScript involved (`components/placeholder.css`).
- [x] `licenseNumber` rendered in the footer and as the schema.org `identifier` (37 Tex. Admin. Code §35.9; originally miscited as Tex. Occ. Code §1702.284, corrected 2026-09-14).
- [x] False `aggregateRating` removed. `src/data/reviews.mjs` derives the rating from real reviews only; an empty list emits no markup.
- [x] `/api/intake` rewritten around `api/_lib/`: same-origin CORS, honeypot, per-IP rate limit and duplicate window backed by `public.intake_gate` (migration `20260909000000`), owner email, emergency Twilio SMS, branded visitor confirmation with reference code and dispatch line, honest per-stage `delivery` report.
- [x] `/api/stripe-checkout` reads the amount from `public.invoices` by id; returns 503 without a key; no mock URL. The browser invoice tool no longer calls Stripe or `api.qrserver.com`.
- [x] `serve.py` no longer fakes success: local inserts are parameterised and a failed insert answers 503; the Stripe stub answers 503.
- [x] Dead `supabase/functions/intake-dispatcher` removed (a parallel intake with wildcard CORS and client-minted codes).
- [x] `tests/` (node --test, fetch stubbed) cover the intake chain, honeypot, duplicates, rate limit, and Stripe amount authority. CI workflow added.
- [x] `docs/RUNBOOK.md` (Resend domain verification, Twilio 10DLC, Stripe, env index) and `docs/OPEN_QUESTIONS.md` (everything blocked on Cameron).

### Phase 12: Go-live readiness — the gate list and the first six specs (2026-09-14)

Built by a team of agents in parallel worktrees with partitioned file ownership, integrated
continuously rather than at the end. Full narrative in PR #10.

- [x] **[`docs/GO_LIVE.md`](docs/GO_LIVE.md) — six ordered gates**, every box with an owner and a
      verification step. It says, in order, what has to be true before the domain points here and
      Cameron takes real work through it. About half of it is accounts, DNS, licence numbers and
      attorney review that no agent can do; the buildable half became eleven specs.
- [x] **[`specs/`](specs/README.md) — eleven specs**, one branch and one PR each, carrying the ten
      inherited invariants, the definition of done and the dependency order once rather than eleven
      times.
- [x] **SPEC-001 — fail-closed placeholder guardrail.** The PLACEHOLDER flag was hidden on any host
      in `productionHosts`, which already included the live alias, so the fake licence number was
      rendering unflagged in the footer and the schema.org `identifier`. Flag now renders everywhere
      with no JavaScript; `js/modules/env.mjs` deleted; `node build.mjs --verify-release` exits 1
      while any placeholder remains, gated in CI to tags and manual dispatch.
- [x] **SPEC-002 — preview deploys can no longer page anyone.** Both previews on the PR were pointed
      at the production Supabase project. Now every non-production row is labelled and every
      client-facing send is skipped and honestly reported. Two defects found beyond the brief: the
      *production* scheduler was still going to page about preview leads (suppressing at the preview
      does not help when the row is in the production database), and a suppressed send was logging
      `error: 'not_configured'` — a false record.
- [x] **SPEC-007 — a first view of `/` is 960 KB lighter.** The favicon was the 1.07 MB brand plate;
      it is now 575 bytes. Composed 1200×630 social card with the dimension and alt tags that were
      missing. The spec's premise was wrong and is corrected in place: the voxel forge does not need
      the full-resolution source, because `GRID_ROWS` is already 256 and the master has no alpha
      channel, so re-encoding beat downscaling on both size and sharpness.
- [x] **SPEC-008 — accessibility audited, gate staged.** 48 automated + 12 manual findings. Two were
      decision-free and are fixed: **the skip link skipped the hero and both primary CTAs** — "Skip
      to main content" on `/` pointed at `#capabilities`, three sections into `<main>`, and
      `/careers` had the same shape. A conversion defect as much as an accessibility one.
- [x] **SPEC-010 — candidate ATS.** `/portal/candidates` lists, filters and stages applications from
      `/careers`, production rows only; the detail page carries the application, internal notes,
      assignment, rejection and the audit timeline. Stages advance one at a time and cannot skip; a
      rejection can be re-opened; every change is audited with actor and diff. Candidate email waits
      on a verified Resend sender and skips honestly until then; reaching `active_roster`
      deliberately creates no `officers` row.
- [x] **SPEC-011 — incident response, and an honestly unrun drill.** `docs/INCIDENT.md` and
      `docs/RESTORE-DRILL.md`. The drill ships banner-marked never run with blank result fields —
      inventing backup numbers would be worse than an honest blank. Its verifier now runs in CI
      against a real migrated database, so the SQL is proven continuously rather than first
      discovered broken during an incident.
- [x] **SPEC-006 (CSP + self-hosted three.js and fonts) and SPEC-003 (error reporting)** — merged in PR #10 the same day. SPEC-003 has two acceptance criteria verified by reading rather than by test (GO_LIVE D1b).
- [ ] **SPEC-005 (analytics) and SPEC-009 (perf budget)** — recommended **cut from launch scope**.
      Analytics tells you how launch went; a perf budget prevents future regression. Neither is a
      precondition for launching, and each adds surface area on day one.

**Three defects that existed only in the combination of two agents' work**, which is the argument for
integrating continuously:

1. **The environment banner failed contrast** — white on `#ef4444` is 3.76:1, under the 4.5:1 floor.
   The accessibility audit found `/login` clean, but it branched *before* the banner merged, so
   neither agent could have seen it. Fixed at the banner, not the shared token: `--color-crimson` is
   designed as a foreground on dark and passes there.
2. **Candidate rows in the activity feed rendered as dead text** — `entityHref` had no `candidate`
   case. The vocabulary lives in SQL where no TypeScript can see it, so the next table would repeat
   it; there is now a test that reads the newest declaring migration and the route tree and asserts
   every audited entity type links to a page that exists.
3. **A latent cross-file database race**, surfaced by a third test file changing scheduling: one
   suite reserved an invoice-sequence block and asserted an exact delta while another minted
   invoices concurrently against the same database. Fixed at the shared resource
   (`fileParallelism: false`), not by re-running it until it passed.

**One thing a spec asked for that was deliberately not shipped.** SPEC-010 supplied privacy-policy
copy promising that unsuccessful applications are deleted at 24 months. Nothing deletes them — the
spec shipped no deleter because the DPS retention floor for hired officers is a question for counsel.
A privacy policy must not promise a purge that does not run, so the published copy states what the
system actually does and the fixed period became gate **F3a**.

**Deployed ahead of its migrations.** PR #10 added `20260914000000_source_env`, `20260914120000_candidates_ats`
and `20260914140000_alert_gate`, and the Git deploy shipped code that uses them, but none were applied to the
hosted project (checked 2026-09-14). Merging does not migrate the database; apply by hand (`docs/RUNBOOK.md` §1).
All three were applied and verified the same afternoon; the only quote on file predates the deploy.

### Client-facing copy refinements (2026-09-14)

- [x] Removed the “FPS // Assembly Protocol” hero badge (`1387db3`) and shortened the scroll cue to “SCROLL ↓” (`83003e0`).
- [x] Rewrote the four How It Works steps in client language; tactical badges, metadata strips and simulated terminal logs are gone from `src/data/protocol.mjs` (`696e114`).
- [x] Careers application header: removed the “COMMAND INTAKE” badge and the word “TRANSMIT” (heading now “OFFICER APPLICATION”), and the lead now says applications go to Fused Protective Services instead of naming Cameron Harrell (`6c0ffee`). The interview stage, its sign-off line, the careers keywords and the post-submit confirmation followed (`66a0884`); the careers page no longer names Cameron.
- [x] **Threat assessment safety gap closed.** “Elevated / Immediate Known Threat” carried no routing, so the environment decided — an immediate threat at a construction site was recommended routine patrol and filed at standard priority. It now recommends Emergency Tactical Dispatch (armed officers, “call 911 first”) and routes the quote form there, so the lead triages as `emergency`. Guarded by `tests/assessment.test.mjs`.
- [x] Each change was made in `src/`, regenerated, drift-checked, and confirmed on production.

---

---

## ⚠️ Known Gaps & Immediate Operational Decisions (Cameron's Call)

Tracked in [`docs/OPEN_QUESTIONS.md`](file:///Users/cope/projects/fused-protective-services/docs/OPEN_QUESTIONS.md): proof that the dispatch line rings, DPS licence number, alert recipients, sales-tax confirmation, Resend sender, Twilio 10DLC, Stripe keys, custom domain.

## 🚀 Go-live gates

[`docs/GO_LIVE.md`](file:///Users/cope/projects/fused-protective-services/docs/GO_LIVE.md)
is the ordered launch gate list — legal and licensing, the lead-to-cash delivery chain,
domains and environment separation, operational readiness, site quality, and Cameron's
day-one dry run. Every box names an owner and a verification step.

**Ticked so far: C4, D1, D8, E1, E2, F3.** Advanced: A1, C3, D4, E4. It raised the items
this tracker did not carry — of those, the restore drill, environment separation, the
accessibility check, the candidate screen, error monitoring and the marketing-site CSP are
now built or written; uptime checks (SPEC-004) and analytics are not.

**The launch-blocking remainder is not engineering.** The critical path is Twilio 10DLC
registration (business days, needs the EIN), attorney review, and DNS → Resend — a chain,
not three parallel tasks. Until Resend verifies a sender, no client can sign into the
portal at all. What the spec work buys is that nothing is *also* waiting on engineering
when those accounts land.

The buildable half is broken into eleven specs in
[`specs/`](specs/README.md) — one branch and one pull request each, with a status table,
a dependency order, the invariants every spec inherits, and a shared definition of done.
**Done: 001, 002, 003, 006, 007, 010, 011**, plus 008 audited with its gate staged.
**Ready to build: 004.** **Recommended cut from launch scope: 005, 009.**

---

## 🔮 Backlog & Future Workstreams

| Priority | Item | Description | Dependencies |
| :---: | :--- | :--- | :--- |
| **P1** | **Point alerts at Cameron** | Set `DISPATCH_ALERT_TO` to Cameron's dispatch inbox. | Cameron's email |
| **P1** | **HubSpot CRM Activation** | Input Cameron's HubSpot Access Token / Webhook into Vercel env. | Cameron's HubSpot account |
| **P1** | **Prove the dispatch line rings** | Gate A2: `(512) 555-0199` is marked confirmed in `site.mjs`, but it sits in the 555-01xx block reserved for fiction. Dial it from an outside phone. | Cameron / Sean |
| **P1** | **Twilio credentials** | Code is live; set the four Twilio variables and `DISPATCH_ALERT_SMS_TO` (`docs/RUNBOOK.md` §3). | Twilio account, 10DLC |
| **P0** | **Resend sender + Stripe keys + Twilio** | Everything client-facing waits on these accounts (`docs/RUNBOOK.md` §2–4). | Sean, Cameron |
| **P0** | **Two brand-token decisions** | Blocking the accessibility gate. (1) `--text-tertiary` `#78716c` → `#8f8a86` — clears 42 of 48 violations, measured 5.74–5.97:1 against every surface it lands on. (2) A `--gradient-gold-brushed-ui` clamped at `#a1814c` for interactive faces; the decorative gradient stays as is. Both reversible; the current values fail WCAG AA. | Cameron/Sean to approve the look |
| **P1** | **Application retention period** | Gate **F3a**. Nothing deletes candidate applications today and the privacy policy correctly does not claim otherwise. A fixed period cannot be published until counsel sets the DPS floor for hired officers; then engineering adds the deletion to the cron tick and the policy sentence changes with it. | Counsel, same review as A3 |
| **P2** | **Arm the accessibility gate** | After the four CSS fixes: add `--exit` back to both axe steps, delete the summary blocks and `continue-on-error`, add `a11y` to required checks, and tighten `tests/skip-link.test.mjs` to assert `#main` exactly. | The two token decisions |
| **P2** | **Phase 2 operations** | Officer roster UI, shift assignment with conflict detection, officer mobile view, GPS clock-in and checkpoint scans, incident reports with photos, timesheets/payroll export, invoices reconciled to worked hours. Schema seams exist (`officers`, `shift_assignments` clock columns, `pay_rate_cents`). | Phase 1 in use |
| **P2** | **Client Testimonials Section** | Render `src/data/reviews.mjs` once real reviews exist; the rating markup follows automatically. | Verified reviews |
| **P3** | **Client-Side PDF Generator** | Add standalone PDF export library as alternative to browser print. | Invoicing module |
| **P3** | **DIV-08 Expansion (K9 Unit)** | Implement 8th division following the data-model runbook if K9 units are launched. | Operational division spec |
| **P1** | **A site must belong to its client** | New quote and new job load sites only from `?client=`, so choosing a client in the form leaves the site list empty (or showing the previous client's sites on quote detail), and the quote/job actions never check that the chosen site belongs to the chosen client. Found during SPEC-012. | — |
| **P2** | **Plain error messages from actions** | Many server actions show raw database text to the owner (`Could not save: ${error.message}`). Map failures to operator wording and log the detail. Found during SPEC-012. | — |
| **P2** | **Editing a repeat rule changes no shifts** | `updateJob` saves the job row only; a rule without a "Repeats until" date silently produces one shift. The forms now say both; regenerate future shifts on edit. | — |
| **P2** | **Save-then-send for draft invoices** | Send and Save are separate forms, so edits are lost if Send is tapped first (SPEC-012 made Send the pinned action and added a warning). Send should save first. | — |
| **P2** | **Portal contrast token** | The seeded capture (`pnpm screens`) reports ~300–500 `color-contrast` nodes per viewport in the portal, almost all `--text-tertiary` — the same pending decision as the site. | Sean/Cameron approve the look |
| **P2** | **Hosted `secure_password_change`** | `/portal/welcome` assumes a password change needs no reauthentication within 24 h of sign-in. Confirm the hosted Supabase Auth setting. | Supabase dashboard (Sean) |
| **P3** | **Portal fonts vs CSP** | The portal loads Google Fonts while `connect-src` blocks tooling that fetches the stylesheet; `context/architecture.md` says fonts are self-hosted, which is true only of the marketing site. Self-host or correct the doc. | — |
