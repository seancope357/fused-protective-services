# 🛡️ Fused Protective Services — Official Web Platform

The official high-converting website and security detail quote intake engine for **Fused Protective Services** (Cameron Harrell).

---

> **`index.html`, `careers.html`, `invoice.html`, `privacy.html`, `terms.html`, `sms-consent.html`, `css/*.css` and `vercel.json` are generated. Do not edit them by hand.**
> Change `src/`, then run `node build.mjs`.
> Full blueprint: **[PROJECT_CONTEXT.md](PROJECT_CONTEXT.md)**.

---

## 📁 Project Architecture

```
fused-protective-services/
├── build.mjs             # The static-site toolchain — zero dependencies
├── index.html            # GENERATED — marketing & intake page
├── careers.html          # GENERATED — recruiting page (/careers)
├── privacy.html          # GENERATED — legal pages, with terms.html and sms-consent.html
├── invoice.html          # GENERATED — legacy invoice export (/invoice)
├── vercel.json           # GENERATED — clean URLs and security headers (CSP hashes)
├── css/                  # GENERATED — site.css, invoice.css, noscript.css
├── serve.py              # Local preview server (http://localhost:5050), production headers
├── src/
│   ├── lib/html.mjs      # Escaping tagged template
│   ├── data/             # Every fact the site states (divisions, FAQ, rates, careers, legal…)
│   ├── templates/        # One module per page section
│   └── styles/           # One module per component, none over 300 LOC
├── js/
│   ├── app.mjs           # Entry point; initialises every widget
│   ├── modules/          # One module per interactive surface
│   ├── vendor/           # three.js r160, vendored (no CDN)
│   └── logo-forge.js     # Scroll-driven WebGL voxel assembly of the emblem
├── api/                  # Vercel functions: /api/intake, /api/client-error
├── app/                  # Operations portal — Next.js + Supabase, its own package.json
├── supabase/migrations/  # Additive Postgres migrations
├── tests/                # node --test suites for the site and api/
├── assets/
│   ├── logo.png          # Brand master (not served; logo.webp is the served plate)
│   ├── fonts/            # Self-hosted Cinzel, Outfit, JetBrains Mono
│   └── o-scroll.html     # Standalone Pixel Scroll Forge original (reference)
├── docs/                 # GO_LIVE, RUNBOOK, OPEN_QUESTIONS, INCIDENT, RESTORE-DRILL, A11Y-AUDIT
├── specs/                # The engineering half of go-live, one spec per PR
├── PROJECT_CONTEXT.md    # Definitive build blueprint — read this first
└── README.md             # Deployment & Configuration Guide
```

### 🧱 How it builds

One data file feeds every place a fact appears. The seven divisions render into the
bookshelf spines, the quote form's `<select>`, **and** the schema.org `OfferCatalog`
from a single list — before this, those were three hand-maintained copies that had
already drifted apart.

```bash
node build.mjs           # write every generated page, stylesheet and vercel.json
node build.mjs --check   # fail if committed output drifted from src/ (CI / pre-push)
```

No root `package.json`, no lockfile, nothing to install for the site (the portal in
`app/` is a separate workspace). The generated files are committed, so Vercel serves the
root with no build step.

### 🧊 "The Assembly" intro

The page opens on a scroll-driven WebGL sequence (`js/logo-forge.js`, adapted from
`assets/o-scroll.html`): the shield emblem shattered into ~65,000 depth-scattered
voxel cubes that the visitor's scroll fuses back into the logo.

It publishes two clocks. `--assembly` carries **scroll** position and paces the copy
beats. `--assembly-settled` carries the **camera's** real progress and is the only one
anything may use to claim completion — `--assembly` hits 1 the instant the scroll does,
while cubes are still arriving. Reduced motion holds the assembled emblem on a collapsed
track; if WebGL is unavailable or the context is lost, a static emblem mounts instead
(`data-forge-fallback`). three.js is vendored at `js/vendor/three.module.js` and imported
statically — **the page loads nothing from a third-party origin**, which is what lets the
Content-Security-Policy be `default-src 'self'` with no allowlisted host.

---

## ⚡ Quick Preview (Local)

```bash
cd /Users/cope/projects/fused-protective-services
node build.mjs && python3 serve.py
```
Open your browser to: `http://localhost:5050`

---

## 🌐 Deployment

Both Vercel projects are connected to GitHub: every push to `main` deploys the site
(`fused-protective-services`) and the portal (`fused-portal`) to production, and every
pull request gets a preview of each. Manual fallback for the site, from the repo root:

```bash
vercel --prod
```

Other static hosts are not drop-in replacements: the Content-Security-Policy and HSTS
headers live in the generated `vercel.json`, and `/api/intake` is a Vercel function.
Merging does not migrate the database — apply new files in `supabase/migrations/` by hand
([`docs/RUNBOOK.md`](docs/RUNBOOK.md) §1).

---

## 📧 Lead delivery

Both forms post to `/api/intake` (`api/intake.mjs`, a zero-dependency Vercel
function): persist to Supabase → email and emergency SMS to dispatch → confirmation
email to the visitor → optional webhook. Every stage is reported; nothing fakes
success. Setup order and verification: [`docs/RUNBOOK.md`](docs/RUNBOOK.md).
Blocked items: [`docs/OPEN_QUESTIONS.md`](docs/OPEN_QUESTIONS.md).

## 🚀 Going live

What must be true before the custom domain is pointed at this and Cameron starts taking
work through it — ordered gates, each with an owner and a verification step:
**[`docs/GO_LIVE.md`](docs/GO_LIVE.md)**.

About half of those gates are accounts, DNS and legal review that no agent can do. The
other half — the engineering work — is specified one spec per branch in
**[`specs/`](specs/README.md)**, with the invariants, acceptance criteria and definition
of done each one inherits.

## 🏛️ Operations portal (`app/`)

Everything after the lead — quotes, proposals with binding e-acceptance, jobs and
shifts, invoices with Stripe card/ACH payment, the client portal, reviews, and a
table-driven notification engine — lives in [`app/`](app/), a Next.js + Supabase
workspace deployed as `fused-portal` (https://fused-portal.vercel.app). It reads the
same `src/data` files this site is generated from. Setup order:
[`docs/RUNBOOK.md`](docs/RUNBOOK.md). `/invoice` on this site now only exports the
old browser-stored invoices for import into the portal.

## ☎️ The licence number and the dispatch line

`B00000` stands in for the DPS licence number. Set `licenseNumber` in
[`src/data/site.mjs`](src/data/site.mjs), flip its `placeholder` to `false`, and run
`node build.mjs`; the footer, schema.org record, proposals and invoices all follow. Until
then the build warns, a red PLACEHOLDER flag renders beside it on **every** host, and
`node build.mjs --verify-release` exits 1.

The dispatch phone `(512) 555-0199` is marked confirmed, but it sits in the 555-01xx
block reserved for fiction — dial it before launch ([`docs/GO_LIVE.md`](docs/GO_LIVE.md) A2).
Changing `phone` in `site.mjs` updates the nav, drawer, dispatch bar, footer, schema.org
record and confirmation emails at once.
