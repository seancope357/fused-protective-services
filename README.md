# 🛡️ Fused Protective Services — Official Web Platform

The official high-converting website and security detail quote intake engine for **Fused Protective Services** (Cameron Harrell).

---

> **`index.html`, `css/site.css`, `invoice.html`, and `css/invoice.css` are generated. Do not edit them by hand.**
> Change `src/`, then run `node build.mjs`.
> Full blueprint: **[PROJECT_CONTEXT.md](PROJECT_CONTEXT.md)**.

---

## 📁 Project Architecture

```
fused-protective-services/
├── build.mjs             # The whole toolchain — zero dependencies
├── index.html            # GENERATED — do not edit
├── invoice.html          # GENERATED — internal invoicing tool (/invoice)
├── css/site.css          # GENERATED — do not edit
├── css/invoice.css       # GENERATED — do not edit
├── serve.py              # 1-Click Local Preview Server (http://localhost:5050)
├── src/
│   ├── lib/html.mjs      # Escaping tagged template
│   ├── data/             # Every fact the site states (divisions, FAQ, rates…)
│   ├── templates/        # One module per page section
│   └── styles/           # One module per component, none over 300 LOC
├── js/
│   ├── app.mjs           # Entry point; initialises every widget
│   ├── modules/          # One module per interactive surface
│   └── logo-forge.js     # Scroll-driven WebGL voxel assembly of the emblem
├── assets/
│   ├── logo.png          # 3D Brushed Gold Shield Logo (also the voxel source)
│   └── o-scroll.html     # Standalone Pixel Scroll Forge original (reference)
├── PROJECT_CONTEXT.md    # Definitive build blueprint — read this first
└── README.md             # Deployment & Configuration Guide
```

### 🧱 How it builds

One data file feeds every place a fact appears. The seven divisions render into the
bookshelf spines, the quote form's `<select>`, **and** the schema.org `OfferCatalog`
from a single list — before this, those were three hand-maintained copies that had
already drifted apart.

```bash
node build.mjs           # write index.html + css/site.css and invoice.html + css/invoice.css
node build.mjs --check   # fail if committed output drifted from src/ (CI / pre-push)
```

No `package.json`, no lockfile, nothing to install. The generated files are committed,
so the site still deploys by dragging the directory at a host.

### 🧊 "The Assembly" intro

The page opens on a scroll-driven WebGL sequence (`js/logo-forge.js`, adapted from
`assets/o-scroll.html`): the shield emblem shattered into ~65,000 depth-scattered
voxel cubes that the visitor's scroll fuses back into the logo.

It publishes two clocks. `--assembly` carries **scroll** position and paces the copy
beats. `--assembly-settled` carries the **camera's** real progress and is the only one
anything may use to claim completion — `--assembly` hits 1 the instant the scroll does,
while cubes are still arriving. Reduced motion holds the assembled emblem on a collapsed
track; if WebGL or the three.js CDN (jsdelivr → unpkg fallback) is unreachable, a static
emblem mounts instead (`data-forge-fallback`). three.js is the page's only external
script dependency.

---

## ⚡ Quick Preview (Local)

```bash
cd /Users/cope/projects/fused-protective-services
node build.mjs && python3 serve.py
```
Open your browser to: `http://localhost:5050`

---

## 🌐 Instant Deployment to Live Domain

### Option 1: Vercel (Recommended — Free & 10 Seconds)
```bash
cd /Users/cope/projects/fused-protective-services
npx vercel --prod
```

### Option 2: Cloudflare Pages / Netlify / GitHub Pages
Drag and drop the `/Users/cope/projects/fused-protective-services` directory into the Netlify/Cloudflare dashboard to link a custom domain (e.g. `fusedprotectiveservices.com`).

---

## 📧 Connecting the Lead Form to Email / SMS

Submissions are currently recorded in the visitor's own browser only — **nothing is
transmitted anywhere yet.** Point the `deliver()` function in
[`js/modules/quote-form.mjs`](js/modules/quote-form.mjs) at any form processor
([Formspree](https://formspree.io), [Web3Forms](https://web3forms.com), or a custom
endpoint) to route leads to Cameron's phone or email. That function is the only seam
that needs to change.

## 🧾 Invoicing (internal tool)

`/invoice` (generated `invoice.html`) is a branded invoice builder for Cameron:
auto numbering (`FPS-YYYY-####`, counter advances only on save), auto issue/due
dates from payment terms, line items priced from the same rate card as the
estimator (`src/data/estimator.mjs`), tax, and a live gold-on-white document
preview. **Print / Save PDF** uses the browser's print dialog — only the paper
prints, one Letter page. Saved invoices live in the browser's localStorage only
(clearing site data deletes them), and the page is `noindex` and linked from
nowhere. Terms, tax default, numbering, and the remit-to wording live in
[`src/data/invoice.mjs`](src/data/invoice.mjs).

## ☎️ Setting the real phone number

`(512) 555-0199` is a placeholder from the range reserved for fiction. Set `phone` once
in [`src/data/site.mjs`](src/data/site.mjs), run `node build.mjs`, and the nav, drawer,
dispatch bar, footer, and schema.org record all follow.
