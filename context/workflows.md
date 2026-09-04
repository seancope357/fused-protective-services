# Developer Workflows, Integrations & Known Gaps — Fused Protective Services

This document provides step-by-step developer runbooks, deployment procedures, external integration seams, and the prioritized list of client-facing known gaps.

---

## 💻 Local Developer Workflows

The platform requires no npm installations and no build dependencies.

### Standard Commands

```bash
# 1. Compile source files to generated assets
node build.mjs

# 2. Check for drift (exits 1 if generated files do not match src/ byte-for-byte)
node build.mjs --check

# 3. Launch the local preview server on port 5050
python3 serve.py
```

* **Local Preview URL:** `http://localhost:5050` (Main Landing Page)
* **Local Invoicing URL:** `http://localhost:5050/invoice` (Internal Invoicing Builder)

---

## 🚢 Deployment Runbooks

Because all generated artifacts (`index.html`, `invoice.html`, `css/site.css`, `css/invoice.css`) are checked into version control, hosting requires zero build environment configuration.

### Option 1: Vercel CLI (Recommended)
Deploy directly to production in seconds:
```bash
npx vercel --prod
```
The included `vercel.json` automatically configures route rewrites, clean URLs (e.g. `/invoice` mapping to `/invoice.html`), and caching headers.

### Option 2: Cloudflare Pages / Netlify
1. Connect the GitHub repository or drag and drop the `/fused-protective-services` project folder directly into the hosting dashboard.
2. Set **Build Command** to empty (`None`).
3. Set **Output Directory** to `/` (Root).

---

## 🔌 External Integration Seams

### The Lead Intake Webhook Seam (`deliver()`)

Submissions from the Security Detail Quote form (`#securityQuoteForm`) are handled by `js/modules/quote-form.mjs`.

Currently, submissions are stored in the user's browser `localStorage` (`last_fused_quote`) for demonstration. **No leads are transmitted externally yet.**

#### Connecting to Formspree, Web3Forms, or an API Endpoint
To route quotes directly to Cameron's email, SMS, or CRM, update the single `deliver()` function in `js/modules/quote-form.mjs`:

```javascript
// js/modules/quote-form.mjs
async function deliver(payload) {
    // 1. Local backup
    try {
        localStorage.setItem('last_fused_quote', JSON.stringify(payload));
    } catch (_) {}

    // 2. Transmit to remote endpoint
    try {
        const response = await fetch('https://api.web3forms.com/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                access_key: 'YOUR-ACCESS-KEY-HERE',
                subject: `NEW INTAKE: ${payload.refCode} - ${payload.division}`,
                ...payload
            })
        });
        return response.ok;
    } catch (err) {
        console.error('Lead transmission failed:', err);
    }
}
```

#### Lead Payload Data Structure
```typescript
interface QuotePayload {
    refCode: string;          // e.g. "TX-FPS-4821"
    timestamp: string;        // ISO 8601 string
    fullName: string;         // Client contact name
    formPhone: string;        // Client telephone number
    formEmail: string;        // Client email address
    serviceDivision: string;  // Matches division quoteValue
    armedPreference: string;  // Matches armedPreferences string
    startDate: string;        // Requested deployment date
    notes: string;            // Threat context / specific instructions
}
```

---

## 🧾 Internal Invoicing Workflow

Cameron uses `/invoice` (`invoice.html`) to draft and issue branded client invoices:

1. **Access the Tool:** Open `http://localhost:5050/invoice` (or `https://fusedprotectiveservices.com/invoice`).
2. **Draft the Invoice:**
   * Select client terms (Due on receipt, Net 7, Net 15, Net 30).
   * Add line items (rates pre-populate from `src/data/estimator.mjs`).
   * Taxes calculate automatically at the Austin combined rate (**8.25%**).
3. **Save Invoice:** Clicking **"Save Invoice"** stores the invoice in browser `localStorage` and increments the sequential counter (`FPS-2026-0001` $\rightarrow$ `FPS-2026-0002`).
4. **Print / PDF:** Clicking **"Print / Save PDF"** invokes the browser print dialog. The document stylesheet (`invoice-print.css`) hides the sidebar and renders a pristine, single-page Letter document.

---

## 🔄 Upstream Engine Sync Protocol (`logo-forge.js`)

`js/logo-forge.js` is an adapted copy of the *Pixel Scroll Forge* WebGL engine. To keep maintenance friction low:

* **Do not modularize `logo-forge.js`:** Keep it whole at ~530 LOC.
* **Upstream Sync Workflow:** When *Pixel Scroll Forge* releases bug fixes (such as frame-delta clamps, seam overlap fixes, or camera matrix updates), compare against `assets/o-scroll.html` and port the changes as a clean git diff.

---

## ⚠️ Known Gaps — Cameron's Action Items

These three items require operational decisions by Cameron Harrell:

### 1. Placeholder Phone Number
* **Current Value:** `(512) 555-0199` (sits in the range reserved for fictional media).
* **Fix Procedure:** Update `phone` in `src/data/site.mjs`:
  ```javascript
  const phone = {
      display: '(512) 555-0199', // Replace with real line
      e164: '+15125550199'       // Replace with real E.164 line
  };
  ```
* **Impact:** Rebuilding via `node build.mjs` updates the header nav, mobile drawer, dispatch emergency bar, footer, and schema.org structured data simultaneously.

### 2. Live Lead Transmission
* **Current State:** Form submissions log to client `localStorage` only.
* **Fix Procedure:** Connect `deliver()` in `js/modules/quote-form.mjs` to a real form endpoint (Formspree, Web3Forms, or Twilio SMS webhook).

### 3. Review Authenticity Policy
* **Current State:** The schema.org metadata claims an aggregate rating of `5.0` based on `28` reviews in `src/data/site.mjs`.
* **Policy Warning:** Major search engines (Google, Bing) penalize unverified review markup.
* **Fix Procedure:** Back the claim with real verified customer reviews, or remove `rating` from `src/data/site.mjs` until verified reviews are collected.
