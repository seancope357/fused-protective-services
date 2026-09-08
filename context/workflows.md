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

---

## 🔌 External Integration Seams

### The Live Ingestion Pipeline (`/api/intake`)

Submissions from the Security Detail Quote form (`#securityQuoteForm`) and Candidate Application form (`#candidateApplicationForm`) are transmitted asynchronously to `/api/intake`.

```
[Browser Quote / Careers Form]
         │ (POST /api/intake)
         ▼
[Ingestion Layer]
  • Local: serve.py Handler (persists directly to PostgreSQL `fused_protective_services`)
  • Production: api/intake.js (Vercel Function, zero dependencies)
         │
         ├── 1. Persist  → Supabase REST insert into `client_quotes` / `candidate_applications`
         │                 (DB trigger `trg_triage_quote` sets priority; the row's answer wins)
         ├── 2. Alert    → Resend email to DISPATCH_ALERT_TO (subject carries 🚨 EMERGENCY / ⚠️ PRIORITY)
         └── 3. Forward  → Optional JSON webhook (HubSpot / Zapier / Slack)
```

The three stages are independent. The response reports `delivery: { persisted, alerted, forwarded }`. If **every configured stage fails** the function returns `503 { ok: false, error: 'not_delivered' }` and both form controllers show a "call dispatch directly" message instead of a success screen. The server generates the reference code (`TX-FPS-XXXXXX` / `TX-CAND-XXXXXX`, 6 chars, no 0/O/1/I) and both forms display whatever the server returns.

#### Production environment variables (Vercel)

| Variable | Set by | Purpose |
| :--- | :--- | :--- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Vercel Marketplace (Supabase integration) | Stage 1 persistence. Service role bypasses RLS on the server only. |
| `RESEND_API_KEY` | Vercel Marketplace (Resend integration) | Stage 2 email. **Not yet installed — Sean must accept Resend's marketplace terms in the browser, then `vercel integration add resend --name fused-dispatch-alerts`.** |
| `DISPATCH_ALERT_TO` | Manual (`vercel env add`) | Comma-separated recipients. Currently Sean's inbox; switch to Cameron's dispatch address when known. |
| `DISPATCH_ALERT_FROM` | Manual, optional | Defaults to `Fused Dispatch <onboarding@resend.dev>`, which Resend only delivers to the account owner. Set to a verified `@fusedprotectiveservices.com` sender once the domain is connected. |
| `DISPATCH_ALERT_WEBHOOK` / `HUBSPOT_WEBHOOK_URL` | Manual, optional | Stage 3 forward. |

Hosted Supabase project: `fused-protective-services` (ref `zphyvnouierjwjqjvahs`, us-east-1), provisioned 2026-09-08 through the Vercel Marketplace. Migrations in `supabase/migrations/` are applied there and the migration history matches the file names, so `supabase db push` will not try to re-apply them.

#### Offline backup
Both `js/modules/quote-form.mjs` and `js/modules/careers.mjs` still write the payload to `localStorage` (`last_fused_quote`, `last_fused_candidate_app`) before transmitting. If the network itself is unreachable the client falls back to a local reference code; this is a convenience, not a delivery path.

---

## 🗄️ Supabase Backend & Database Architecture

* **PostgreSQL Schema Location:** [`supabase/migrations/20260904000000_fused_core_schema.sql`](file:///Users/cope/projects/fused-protective-services/supabase/migrations/20260904000000_fused_core_schema.sql)
* **Edge Function Dispatcher:** [`supabase/functions/intake-dispatcher/index.ts`](file:///Users/cope/projects/fused-protective-services/supabase/functions/intake-dispatcher/index.ts)
* **Vercel Serverless Function:** [`api/intake.js`](file:///Users/cope/projects/fused-protective-services/api/intake.js)

### Relational Tables & Triage Triggers

1. **`client_quotes` (Inbound Leads & Bookings)**
   * Primary key: `id` (UUID), Unique Reference: `ref_code` (`TX-FPS-####`).
   * Core fields: `full_name`, `company`, `phone`, `email`, `service_division`, `armed_preference`, `deployment_location`, `schedule`, `notes`.
   * State Machine: `status` (`new` $\rightarrow$ `contacted` $\rightarrow$ `audit_scheduled` $\rightarrow$ `proposal_sent` $\rightarrow$ `dispatched` $\rightarrow$ `closed_won` / `closed_lost`).
   * Priority: `priority` (`standard`, `priority`, `emergency`).
   * Automated Trigger: `trg_triage_quote` automatically evaluates division and threat keywords, escalating to `emergency` for *Emergency Tactical Dispatch* or *Level IV PPO*.

2. **`candidate_applications` (Officer Recruiting & ATS)**
   * Primary key: `id` (UUID), Unique Reference: `ref_code` (`TX-CAND-####`).
   * Core fields: `position_id`, `license_level`, `full_name`, `phone`, `email`, `tops_number`, `service_branch`, `bio`.
   * Vetting Pipeline: `vetting_stage` (`application_received` $\rightarrow$ `tops_audit` $\rightarrow$ `background_mmpi2` $\rightarrow$ `range_physical` $\rightarrow$ `command_interview` $\rightarrow$ `active_roster` / `rejected`).

3. **`invoices` (Operational Billing)**
   * Primary key: `id` (UUID), Unique Reference: `invoice_number` (`FPS-YYYY-####`).
   * Stores client name, dates, payment terms, tax calculations, and line items.

---

## 📊 HubSpot CRM Integration Bridge

When Cameron connects his HubSpot account, inbound leads and candidates flow into two separate HubSpot pipelines:

### 1. Deals Pipeline (Client Security Quotes)
| Supabase Column | HubSpot Deal / Contact Property | Purpose |
| :--- | :--- | :--- |
| `full_name` | `firstname` + `lastname` | Primary contact |
| `phone` | `phone` | Instant mobile dial / SMS |
| `email` | `email` | Proposal & invoice delivery |
| `service_division` | `fused_division` (Custom Property) | Service type (`DIV-01` to `DIV-06`) |
| `armed_preference` | `armed_status` (Custom Property) | Level III/IV Armed vs Level II |
| `deployment_location` | `detail_location` (Custom Property) | Venue address / city |
| `schedule` | `detail_schedule` (Custom Property) | Deployment dates / shift hours |
| `notes` | `threat_parameters` (Custom Property) | Threat assessment & VIP parameters |
| `ref_code` | `dealname` (`"TX-FPS-#### // [Client Name]"`) | Deal identifier |
| `priority` | `priority` (`High` if `emergency`) | 45-minute response flag |

### 2. Tickets / Recruiting Pipeline (Officer Applicants)
* Inbound candidate records route to HubSpot **Service / Operations Tickets**:
* Stages map directly to Fused's 5-stage vetting protocol: `Application Received` $\rightarrow$ `TOPS Audit` $\rightarrow$ `MMPI-2 Background` $\rightarrow$ `Range Qualification` $\rightarrow$ `Command Interview` $\rightarrow$ `Active Roster`.
* Custom fields: `tops_license_number`, `service_branch`, `licensure_level`.

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

### 2. Dispatch Alert Recipient
* **Current State:** Leads persist to the hosted Supabase project and, once Resend is installed, email `DISPATCH_ALERT_TO` (currently Sean).
* **Fix Procedure:** Get Cameron's dispatch email and update `DISPATCH_ALERT_TO` in Vercel for all three environments. For SMS on emergency priority, add Twilio (see Backlog).

### 3. Review Authenticity Policy
* **Current State:** The schema.org metadata claims an aggregate rating of `5.0` based on `28` reviews in `src/data/site.mjs`.
* **Policy Warning:** Major search engines (Google, Bing) penalize unverified review markup.
* **Fix Procedure:** Back the claim with real verified customer reviews, or remove `rating` from `src/data/site.mjs` until verified reviews are collected.
