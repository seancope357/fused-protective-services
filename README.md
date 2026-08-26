# 🛡️ Fused Protective Services — Official Web Platform

The official high-converting website and security detail quote intake engine for **Fused Protective Services** (Cameron Harrell).

---

## 📁 Project Architecture

```
fused-protective-services/
├── index.html            # Core Website & Interactive Quote Intake Engine
├── serve.py              # 1-Click Local Preview Server (http://localhost:5050)
├── css/
│   ├── tokens.css        # Design tokens (logo gold spectrum, spacing, easing)
│   ├── main.css          # Global layout & typography
│   ├── components.css    # Section & component styles
│   └── forge.css         # "The Assembly" scroll-forged emblem intro
├── js/
│   ├── logo-forge.js     # Scroll-driven WebGL voxel assembly of the shield emblem
│   ├── particles.js      # Ambient tactical particle mesh
│   └── ...               # Bookshelf, protocol, assessment, estimator, tilt, main
├── assets/
│   ├── logo.png          # High-Res 3D Brushed Gold Shield Logo (also the voxel source)
│   ├── o-scroll.html     # Standalone Pixel Scroll Forge original (reference)
│   └── site_preview.png  # Full-page rendered visual preview
└── README.md             # Deployment & Configuration Guide
```

### 🧊 "The Assembly" intro

The page opens on a scroll-driven WebGL sequence (`js/logo-forge.js`, adapted from
`assets/o-scroll.html`): the shield emblem shattered into ~65,000 depth-scattered
voxel cubes that the visitor's scroll fuses back into the logo. Progress is
published as `--assembly` on `<html>` plus a `pixelScroll` event; `css/forge.css`
keys the copy beats and HUD readout off that clock. Reduced motion holds the
assembled emblem with a collapsed track; if WebGL or the three.js CDN
(jsdelivr → unpkg fallback) is unavailable, a static emblem mounts instead
(`data-forge-fallback`). three.js is the page's only external script dependency.

---

## ⚡ Quick Preview (Local)

To run and preview the site locally:

```bash
python3 /Users/cope/projects/fused-protective-services/serve.py
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
In `index.html`, replace the form submission action with any free form processor (such as [Formspree](https://formspree.io) or [Web3Forms](https://web3forms.com)) to route lead notifications directly to Cameron's phone or email.
