# PROJECT_CONTEXT — Fused Protective Services

> **The definitive build blueprint and context engineering repository for this project.**

**Client:** Cameron Harrell / Fused Protective Services (Austin, TX)  
**What it is:** High-converting marketing site + security detail intake, and the operations platform (`app/`, Next.js + Supabase) that runs the work from lead to cash: quotes, proposals, jobs, invoices, payments, notifications, client portal.  
**Full Context Architecture:** See the modular 7-document repository in [`context/`](file:///Users/cope/projects/fused-protective-services/context/index.md).

---

## ⚡ The One Rule

> [!CAUTION]
> **`index.html`, `css/site.css`, `invoice.html`, and `css/invoice.css` are generated. Never edit them by hand.**

Everything the page says lives in `src/`. Run `node build.mjs` after any change and commit the regenerated output alongside the source:

```bash
node build.mjs           # write index.html + css/site.css and invoice.html + css/invoice.css
node build.mjs --check   # fail if committed output drifted from src/
python3 serve.py         # preview at http://localhost:5050
```

There is no `package.json`, no lockfile, and no npm dependencies. `node build.mjs` is the entire toolchain. The generated files are committed so the site deploys anywhere (Vercel, Cloudflare, Netlify) by simple static upload.

---

## 📚 The 7-File Context Engineering Architecture

In accordance with modern context engineering standards, all repository knowledge, invariants, and guidelines have been decomposed into 7 dedicated steering documents located in [`context/`](file:///Users/cope/projects/fused-protective-services/context/):

1. **[`context/index.md`](file:///Users/cope/projects/fused-protective-services/context/index.md)** — **Master Index & Router**  
   Operating rules, repository layout, progressive disclosure router, and rule precedence.
2. **[`context/business.md`](file:///Users/cope/projects/fused-protective-services/context/business.md)** — **Business & Domain Model**  
   Cameron Harrell, Texas security market, 6 Divisions, rate cards, assessment quiz logic, and invoice business model.
3. **[`context/architecture.md`](file:///Users/cope/projects/fused-protective-services/context/architecture.md)** — **Technical Architecture & Systems**  
   Zero-dependency toolchain, `build.mjs`, tagged templates, WebGL voxel engine, `#fps-config` state island, and invoice tool.
4. **[`context/data-model.md`](file:///Users/cope/projects/fused-protective-services/context/data-model.md)** — **Data Architecture & Schema Contracts**  
   Single Source of Truth (`src/data/`), `quoteValue` stability contract, schema.org JSON-LD, and anti-drift architecture.
5. **[`context/code-standards.md`](file:///Users/cope/projects/fused-protective-services/context/code-standards.md)** — **Engineering & Code Standards**  
   Escaping invariants (`html` vs `raw`), no inline handlers/styles, CSS `@layer` rules, `STYLE_ORDER`, 300 LOC limits, and deterministic builds.
6. **[`context/ui-standards.md`](file:///Users/cope/projects/fused-protective-services/context/ui-standards.md)** — **UI/UX Design System & Accessibility**  
   Dark tactical aesthetic, gold/carbon color tokens, dual motion clocks (`--assembly` vs `--assembly-settled`), gold SVG emblems, and WCAG 2.1 AA a11y baseline.
7. **[`context/workflows.md`](file:///Users/cope/projects/fused-protective-services/context/workflows.md)** — **Developer Workflows, Integrations & Gaps**  
   Local CLI commands, CI drift checks, Vercel/Cloudflare deployment, lead form `deliver()` seam, invoice workflow, and Cameron's known gaps.

---

## 📈 Operational Progress & Milestone Tracker

For active workstreams, completed phase deliverables, operational blockers, and prioritized backlog items, consult the root tracker:  
👉 **[`PROGRESS.md`](PROGRESS.md)** (located at the repository root).

**To ship, start instead with [`docs/GO_LIVE.md`](docs/GO_LIVE.md)** — six ordered gates, every box
with an owner and a verification step. `PROGRESS.md` records what was built; `GO_LIVE.md` records
what must be true before the domain points here. They are different questions and the second is the
one that blocks launch. The buildable half of it is specified in [`specs/`](specs/README.md), whose
README carries the ten invariants every spec inherits and a shared definition of done.

---

## 🗂️ High-Level Layout

```text
├── app/                       operations portal — Next.js 16 + Supabase (own package.json)
├── api/                       Vercel functions for the static site (intake) + api/_lib transports
├── supabase/migrations/       additive migrations (fourteen), supabase/tests/auth_shim.sql for local RLS tests
├── docs/                      GO_LIVE.md (the launch gate list — start here), RUNBOOK.md (setup order),
│                           OPEN_QUESTIONS.md (blocked on Cameron), INCIDENT.md, RESTORE-DRILL.md,
│                           A11Y-AUDIT.md (measured accessibility reality)
├── specs/                     the buildable half of go-live — eleven specs, one branch and PR each
├── build.mjs                  the static-site toolchain (zero dependencies)
├── index.html                 GENERATED — marketing & intake page
├── careers.html               GENERATED — recruiting page (/careers)
├── privacy.html               GENERATED — from src/data/legal.mjs
├── terms.html                 GENERATED — from src/data/legal.mjs
├── sms-consent.html           GENERATED — from src/data/legal.mjs
├── invoice.html               GENERATED — legacy-record export tool (/invoice)
├── css/
│   ├── site.css               GENERATED — compiled site stylesheet
│   └── invoice.css            GENERATED — compiled invoice stylesheet
├── context/                   7-file context engineering repository
├── PROGRESS.md                living milestone, health & roadmap tracker
├── PROJECT_CONTEXT.md         definitive build blueprint & context gateway
├── src/                       SOURCE OF TRUTH (all edits happen here)
│   ├── lib/html.mjs           escaping tagged template primitive
│   ├── data/                  every business fact, division, and rate
│   ├── templates/             one module per section
│   └── styles/                one module per component, none over 300 LOC
├── js/
│   ├── app.mjs                entry point; initializes widgets
│   ├── modules/               one module per interactive surface
│   └── logo-forge.js          scroll-forged emblem engine (WebGL Three.js)
└── assets/
    ├── logo.png               brand plate and voxel source
    └── o-scroll.html          original Pixel Scroll Forge reference
```

---

## ⚡ Quick Reference: Critical Invariants

* **Escaping by Default:** `html` from `src/lib/html.mjs` escapes every interpolated value. Use `raw()` only on markup this repository generates. Never put an HTML entity (`&amp;`) in a data field.
* **Keep `quoteValue` Stable:** It is the contract linking the bookshelf button, the `<select>` form option, the assessment recommendation, the budget calculator, and the operational lead payload.
* **Dual Clocks in Logo Forge:** `--assembly` tracks scroll position (copy beats). `--assembly-settled` tracks camera arrival (the only clock allowed to claim animation completion).
* **CSS is Layered:** `@layer tokens, base, layout, components, utilities;` is declared once. Cascade order inside `components` is dictated by explicit `STYLE_ORDER` in `build.mjs`.
* **Deterministic Builds:** `copyrightYear` is stated (e.g. 2026), never read from the clock, ensuring `node build.mjs --check` passes across new years. Nothing in the build may read the clock, the environment or the network.
* **A Placeholder Never Hides:** Facts that are not yet real carry `placeholder: true` in `src/data/site.mjs` and render a red flag on **every** host — no JavaScript, no host allow-list. `node build.mjs --verify-release` exits 1 while any remain, so a release cannot be cut carrying one. The DPS licence number is the one still outstanding.
* **No Fake Success, Anywhere:** A missing key is a reported state — `503` with a stable `error` code and a plain-language message. A send that did not happen is logged with its real reason (`no_verified_sender`, `non_production_env`), never as success and never as a different error. This applies to the published word too: the privacy policy may not promise a data purge that no code performs.
* **Preview Is Not Production:** `deployEnv()` in `api/_lib/env.mjs` returns `production` only when `VERCEL_ENV` says so; absent falls to `development`. The asymmetry is deliberate — wrong way round, a preview deploy pages the owner at 3am. Every non-production row is labelled `source_env`, and the production scheduler filters on it.
* **Generated Output Is Committed and Verified:** Not just HTML and CSS. Anything derived from source belongs in `artefacts()` so `node build.mjs --check` catches drift in it.
