# PROJECT_CONTEXT — Fused Protective Services

> **The definitive build blueprint and context engineering repository for this project.**

**Client:** Cameron Harrell / Fused Protective Services (Austin, TX)  
**What it is:** High-converting marketing site + security detail intake, and the operations platform (`app/`, Next.js + Supabase) that runs the work from lead to cash: quotes, proposals, jobs, invoices, payments, notifications, client portal.  
**Full Context Architecture:** See the 8-document repository (seven domain documents plus the current-unit tracker) in [`context/`](file:///Users/cope/projects/fused-protective-services/context/index.md).

---

## ⚡ The One Rule

> [!CAUTION]
> **`index.html`, `careers.html`, `invoice.html`, `privacy.html`, `terms.html`, `sms-consent.html`, `css/site.css`, `css/invoice.css`, `css/noscript.css` and `vercel.json` are generated. Never edit them by hand.**

Everything the page says lives in `src/`. Run `node build.mjs` after any change and commit the regenerated output alongside the source:

```bash
node build.mjs           # write every generated page, stylesheet and vercel.json
node build.mjs --check   # fail if committed output drifted from src/
python3 serve.py         # preview at http://localhost:5050 with the production headers
```

The static site has no root `package.json`, no lockfile, and no npm dependencies; `node build.mjs` is its entire toolchain. The generated files are committed and served by Vercel, which also runs `api/` and applies the security headers in the generated `vercel.json`. The portal in `app/` is a separate pnpm workspace.

---

## 📚 The 8-File Context Engineering Architecture

All repository knowledge, invariants, and guidelines are decomposed into seven domain steering documents plus one current-unit tracker, located in [`context/`](file:///Users/cope/projects/fused-protective-services/context/):

1. **[`context/index.md`](file:///Users/cope/projects/fused-protective-services/context/index.md)** — **Master Index & Router**  
   Operating rules, repository layout, progressive disclosure router, and rule precedence.
2. **[`context/business.md`](file:///Users/cope/projects/fused-protective-services/context/business.md)** — **Business & Domain Model**  
   Cameron Harrell, Texas security market, 7 Divisions, rate cards, assessment quiz logic, How It Works copy, careers pay and copy decisions, and the invoicing model.
3. **[`context/architecture.md`](file:///Users/cope/projects/fused-protective-services/context/architecture.md)** — **Technical Architecture & Systems**  
   Zero-dependency toolchain, `build.mjs`, tagged templates, WebGL voxel engine with vendored three.js, `#fps-config` state island, generated security headers, and the operations portal.
4. **[`context/data-model.md`](file:///Users/cope/projects/fused-protective-services/context/data-model.md)** — **Data Architecture & Schema Contracts**  
   Single Source of Truth (`src/data/`), `quoteValue` stability contract, schema.org JSON-LD, and anti-drift architecture.
5. **[`context/code-standards.md`](file:///Users/cope/projects/fused-protective-services/context/code-standards.md)** — **Engineering & Code Standards**  
   Escaping invariants (`html` vs `raw`), no inline handlers/styles, CSS `@layer` rules, `STYLE_ORDER`, 300 LOC limits, and deterministic builds.
6. **[`context/ui-standards.md`](file:///Users/cope/projects/fused-protective-services/context/ui-standards.md)** — **UI/UX Design System & Accessibility**  
   Dark tactical aesthetic, gold/carbon color tokens, dual motion clocks (`--assembly` vs `--assembly-settled`), gold SVG emblems, and WCAG 2.1 AA a11y baseline.
7. **[`context/workflows.md`](file:///Users/cope/projects/fused-protective-services/context/workflows.md)** — **Developer Workflows, Integrations & Gaps**  
   Local commands, Git-driven Vercel deploys, the `/api/intake` pipeline, portal workflows, migrations and hosted status, the HubSpot bridge, and Cameron's known gaps.
8. **[`context/progress-tracker.md`](context/progress-tracker.md)** — **Current Implementation Unit**  
   The goal, completed steps, next steps and decisions for the unit in progress; the broader history stays in `PROGRESS.md`.

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
├── api/                       Vercel functions for the static site (intake, client-error) + api/_lib transports
├── supabase/migrations/       additive migrations (fifteen; apply by hand — merging does not migrate), supabase/tests/auth_shim.sql
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
│   ├── invoice.css            GENERATED — compiled invoice stylesheet
│   └── noscript.css           GENERATED — no-JavaScript fallback styles
├── vercel.json                GENERATED — clean URLs, CSP (inline-script hashes), HSTS
├── context/                   8-file context engineering repository
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
│   ├── vendor/                three.js r160, vendored and hash-checked (no CDN)
│   └── logo-forge.js          scroll-forged emblem engine (WebGL Three.js)
├── tests/                     node --test suites for the static site and api/
├── scripts/                   build-assets.sh, og-card.mjs — brand derivatives, run by hand
└── assets/
    ├── logo.png               brand master (not served); logo.webp is the plate and voxel source
    ├── icon-*.png, og-card.png favicon, touch icons, social card
    ├── fonts/                 self-hosted Cinzel, Outfit, JetBrains Mono
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
