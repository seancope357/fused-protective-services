# 📈 PROGRESS — Fused Protective Services

> **Living operational status, completed milestones, active workstreams, and known gaps.**  
> *Last Updated: 9 September 2026*

---

## 🚦 System Health & Deployment Readiness

| Dimension | Current Status | Notes |
| :--- | :--- | :--- |
| **Compiler & Build Pipeline** | 🟢 **Passing (Zero Drift)** | `node build.mjs --check` validates byte-identical output. |
| **Dependencies** | 🟢 **Zero Dependencies** | Pure Node.js ESM. No `package.json` or `node_modules`. |
| **Marketing Web Platform** | 🟢 **Production Ready** | All 7 divisions, estimator, assessment quiz, and intake live. |
| **Internal Invoicing Engine** | 🟢 **Production Ready** | `/invoice` generating Letter-formatted PDF invoices. |
| **Careers & Recruiting Portal** | 🟢 **Production Ready** | `/careers` live with filterable jobs, 5-stage vetting, & pre-qual. |
| **Context Engineering** | 🟢 **Complete (7 Modules)** | Modular domain documentation live in [`context/`](file:///Users/cope/projects/fused-protective-services/context/index.md). |
| **Lead Persistence** | 🟢 **Live (hosted Supabase)** | `/api/intake` on production writes to the hosted `fused-protective-services` Supabase project; verified end to end 2026-09-08. |
| **Dispatch Alerts** | 🟡 **Code shipped, Resend and Twilio not installed** | Owner email, client auto-reply, and emergency SMS stages are live in `api/intake.js`; none fire until the keys in [`docs/RUNBOOK.md`](docs/RUNBOOK.md) are set. Until then leads sit in the database unannounced. |
| **Phone Line** | 🟡 **Placeholder** | Needs Cameron's real line to replace `(512) 555-0199`. |
| **Review Markup** | 🟢 **Removed** | `rating` is null; `aggregateRating` is only emitted once real reviews exist. |
| **License Number** | 🟡 **Missing** | `licenseNumber` is null in `site.mjs`; footer line and schema identifier stay hidden until Cameron supplies it. `node build.mjs` warns; `--strict` fails. |
| **Online Payment** | 🟡 **Stripe key not set** | `/api/stripe-checkout` recomputes totals server-side and refuses to mint a link without `STRIPE_SECRET_KEY`. |

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
- [x] Implemented CDN fallback redundancy (jsDelivr $\rightarrow$ unpkg) and static fallback plate (`data-forge-fallback`).
- [x] Built ambient particle background canvas and interactive cursor spotlight glow (`ambient.mjs`).
- [x] Designed bespoke 2D gold tactical SVG emblem library (officially rejected 3D icon replacement for clarity and performance).

### Phase 4: High-Converting Tactical Marketing & Intake Flow
- [x] Built Tactical Bookshelf component with smooth `--ease-studio` sliding rail transitions and payload reveal.
- [x] Implemented accessible ARIA tablist for 4-phase Deployment Protocol with full arrow-key keyboard navigation.
- [x] Built 60-Second Threat Assessment quiz with deterministic escalation logic.
- [x] Built interactive Coverage & Budget Estimator with dynamic officer/hour sliders and tier selectors.
- [x] Built Security Detail Intake form with automated pre-fill from quiz/estimator and screen reader live region status (`#formStatus`).

### Phase 5: Internal Invoicing Subsystem (`/invoice`)
- [x] Created standalone `/invoice` builder route (`invoice.html` + `css/invoice.css`).
- [x] Configured auto-numbering format (`FPS-YYYY-####`) incrementing strictly on invoice save.
- [x] Integrated automated payment terms (Due on Receipt, Net 7, Net 15, Net 30 default) and due-date calculation.
- [x] Built automatic Austin/Texas 8.25% sales tax calculation engine.
- [x] Implemented `@media print` single-page Letter stylesheet (`invoice-print.css`).
- [x] Integrated browser `localStorage` invoice store (`fps_invoices_v1`).

### Phase 6: 7-File Context Engineering Architecture
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
- [x] Created zero-dependency Vercel Serverless Function [`api/intake.js`](file:///Users/cope/projects/fused-protective-services/api/intake.js) for instant production deployment.
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
- [x] Rewrote `api/intake.js` as a three-stage delivery chain (persist → Resend email → webhook) that reports per-stage success and returns 503 when nothing was delivered.
- [x] Server-generated collision-safe reference codes; user text escaped in alert emails.
- [x] Form controllers now show a failure message instead of a fake success when delivery fails.
- [x] Verified on preview and production: rows land in Supabase, DB trigger escalates emergency divisions.

### Phase 12: Phase 0 Fixes — Stop the Bleeding (2026-09-09)
- [x] Removed the unverified 5.0/28 `aggregateRating`; schema emits a rating only when `site.rating` has a positive count.
- [x] Added `licenseNumber` to `site.mjs`, rendered in the footer and as a schema.org `identifier` only when set (Texas Occupations Code 1702).
- [x] `build.mjs` prints a placeholder warning block (555 phone, missing license) after every build or check; `--strict` exits 1 for deploy gates.
- [x] `api/intake.js`: client auto-reply email (Stage 2b), Twilio emergency SMS to `DISPATCH_ALERT_SMS_TO` (Stage 2c), origin-allowlisted CORS with `Vary: Origin`, honeypot field on both forms, Postgres-backed per-IP rate limit and duplicate suppression (`intake_attempts`, fails open).
- [x] `api/stripe-checkout.js`: recomputes the charge from line items, rejects tampered or out-of-range totals, upserts every session into `public.invoices`, returns 503 instead of a mock URL when unconfigured.
- [x] Form controllers surface 429 and duplicate responses instead of faking a local reference code.
- [x] Wrote [`docs/RUNBOOK.md`](docs/RUNBOOK.md): Resend, Twilio, Stripe, and every env var with its source.

---

## ⚠️ Known Gaps & Immediate Operational Decisions (Cameron's Call)

These 3 action items require direct operational input from Cameron Harrell:

### 1. Update Live Phone Number
* **Problem:** `(512) 555-0199` is a fictional placeholder.
* **File to Edit:** [`src/data/site.mjs`](file:///Users/cope/projects/fused-protective-services/src/data/site.mjs) (lines 15–18).
* **Action Required:** Provide the real business line (display format and E.164 international format). Rebuilding will automatically update the header nav, mobile drawer, dispatch bar, footer, and schema.org markup.

### 2. Texas DPS License Number
* **Problem:** `licenseNumber` is `null`, so the footer line and schema identifier required by Occupations Code 1702 do not render.
* **File to Edit:** [`src/data/site.mjs`](src/data/site.mjs) (`const licenseNumber`).
* **Action Required:** Enter the company license number exactly as printed on the DPS certificate, rebuild, commit.

### 3. Alert Recipients and Keys
* **Problem:** Owner email, client auto-reply, emergency SMS, and Stripe pay links are all coded and all inert without credentials.
* **File to Read:** [`docs/RUNBOOK.md`](docs/RUNBOOK.md).
* **Action Required:** Install Resend and Twilio, set the env vars listed there in all three Vercel environments, apply the two 2026-09-09 migrations.

---

## 🔮 Backlog & Future Workstreams

| Priority | Item | Description | Dependencies |
| :---: | :--- | :--- | :--- |
| **P0** | **Install Resend + Twilio, set env vars** | Follow [`docs/RUNBOOK.md`](docs/RUNBOOK.md). Turns on owner alerts, client confirmations, and emergency SMS. | Sean, 15 minutes |
| **P0** | **Apply 2026-09-09 migrations** | `intake_attempts` table and `invoices` payment-link columns. Intake fails open without them; Stripe links still mint but do not persist. | `supabase db push` |
| **P1** | **Point alerts at Cameron** | Set `DISPATCH_ALERT_TO` to Cameron's dispatch inbox. | Cameron's email |
| **P1** | **HubSpot CRM Activation** | Input Cameron's HubSpot Access Token / Webhook into Vercel env. | Cameron's HubSpot account |
| **P1** | **Set Real Phone Line** | Update `phone` in `site.mjs` with Cameron's active dispatch line. | Cameron's phone number |
| **P2** | **Twilio SMS Dispatch Alerts** | Add Twilio API credentials to fire real-time SMS to Cameron on emergency dispatch. | Twilio Account SID & Auth Token |
| **P2** | **Client Testimonials Section** | Add verified client quotes to support the 5.0-star schema claim. | Verified reviews |
| **P3** | **Client-Side PDF Generator** | Add standalone PDF export library as alternative to browser print. | Invoicing module |
| **P3** | **DIV-08 Expansion (K9 Unit)** | Implement 8th division following the data-model runbook if K9 units are launched. | Operational division spec |
