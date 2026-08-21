# 🛡️ Fused Protective Services — Official Web Platform

The official high-converting website and security detail quote intake engine for **Fused Protective Services** (Cameron Harrell).

---

## 📁 Project Architecture

```
fused-protective-services/
├── index.html            # Core Website & Interactive Quote Intake Engine
├── serve.py              # 1-Click Local Preview Server (http://localhost:5050)
├── assets/
│   ├── logo.png          # High-Res 3D Brushed Gold Shield Logo
│   └── site_preview.png  # Full-page rendered visual preview
└── README.md             # Deployment & Configuration Guide
```

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
