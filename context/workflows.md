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
         ├── 0. Gate     → same-origin CORS · honeypot (`website` field) · per-IP limit
         │                 (5 / 10 min) · duplicate window (15 min) via `public.intake_gate`
         ├── 1. Persist  → Supabase REST insert into `client_quotes` / `candidate_applications`
         │                 (DB trigger `trg_triage_quote` sets priority; the row's answer wins)
         ├── 2. Alert    → Resend email to DISPATCH_ALERT_TO; Twilio SMS to DISPATCH_ALERT_SMS_TO
         │                 when priority = emergency
         ├── 3. Confirm  → Resend email to the visitor (reference code, next steps, dispatch line)
         └── 4. Forward  → Optional JSON webhook (Zapier / Slack)
```

Stages 1–4 are independent. The response reports `delivery: { persisted, alerted, smsAlerted, confirmed, forwarded }`. If **no delivery stage** (persist, owner email, owner SMS, webhook) succeeds, the function returns `503 { ok: false, error: 'not_delivered' }` and both form controllers show a "call dispatch directly" message instead of a success screen. A duplicate submission answers `200 { duplicate: true, refCode }` with the original reference; a rate-limited caller gets `429` with `Retry-After`. A tripped honeypot gets a plausible 200 and nothing is delivered — the one deliberate exception, never reachable by a person. The server generates the reference code (`TX-FPS-XXXXXX` / `TX-CAND-XXXXXX`, 6 chars, no 0/O/1/I) and both forms display whatever the server returns.

Shared transports live in `api/_lib/` (`http.mjs`, `supabase.mjs`, `email.mjs`, `sms.mjs`, `gate.mjs`, `intake-messages.mjs`). Message bodies read every fact from `src/data/site.mjs`. Tests: `node --test 'tests/*.test.mjs'` (fetch stubbed, no network).

#### Production environment variables (Vercel)

| Variable | Set by | Purpose |
| :--- | :--- | :--- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Vercel Marketplace (Supabase integration) | Stage 1 persistence. Service role bypasses RLS on the server only. |
| `RESEND_API_KEY` | Vercel Marketplace (Resend integration) | Stage 2 email. **Not yet installed — Sean must accept Resend's marketplace terms in the browser, then `vercel integration add resend --name fused-dispatch-alerts`.** |
| `DISPATCH_ALERT_TO` | Manual (`vercel env add`) | Comma-separated recipients. Currently Sean's inbox; switch to Cameron's dispatch address when known. |
| `DISPATCH_ALERT_FROM` | Manual | Verified `@fusedprotectiveservices.com` sender. Without it, owner alerts fall back to `onboarding@resend.dev` (delivers only to the Resend account owner) and the visitor confirmation is skipped. |
| `DISPATCH_ALERT_SMS_TO`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID` or `TWILIO_FROM` | Manual | Emergency SMS. |
| `INTAKE_HASH_SALT` | Manual, optional | Salts the IP / payload hashes stored in `intake_gate`. |
| `STRIPE_SECRET_KEY` | Manual | `/api/stripe-checkout`. Without it the function answers 503; there is no mock. |
| `DISPATCH_ALERT_WEBHOOK` / `HUBSPOT_WEBHOOK_URL` | Manual, optional | Stage 4 forward. |

Full setup order and verification steps: [`docs/RUNBOOK.md`](file:///Users/cope/projects/fused-protective-services/docs/RUNBOOK.md).

Hosted Supabase project: `fused-protective-services` (ref `zphyvnouierjwjqjvahs`, us-east-1), provisioned 2026-09-08 through the Vercel Marketplace. Migrations in `supabase/migrations/` are applied there and the migration history matches the file names, so `supabase db push` will not try to re-apply them.

#### Offline backup
Both `js/modules/quote-form.mjs` and `js/modules/careers.mjs` still write the payload to `localStorage` (`last_fused_quote`, `last_fused_candidate_app`) before transmitting. If the network itself is unreachable the client falls back to a local reference code; this is a convenience, not a delivery path.

---

## 🗄️ Supabase Backend & Database Architecture

* **PostgreSQL Schema Location:** [`supabase/migrations/`](file:///Users/cope/projects/fused-protective-services/supabase/migrations/) — `20260904000000_fused_core_schema.sql`, `20260908000000_harden_function_search_path.sql`, `20260909000000_intake_gate.sql`
* **Vercel Serverless Functions:** [`api/intake.js`](file:///Users/cope/projects/fused-protective-services/api/intake.js), [`api/stripe-checkout.js`](file:///Users/cope/projects/fused-protective-services/api/stripe-checkout.js), shared code in `api/_lib/`

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
   * Stores client name, dates, payment terms, tax calculations, and line items. `/api/stripe-checkout` reads `total` from this row by `id`; the request body never supplies an amount.

4. **`intake_gate` (Abuse Controls)**
   * Hashes only (`ip_hash`, `dedupe_hash`) plus the `ref_code` they map to; rows expire after a day. No RLS policies: only the service role touches it, through the `intake_gate()` function.

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

Maintained in one place: [`docs/OPEN_QUESTIONS.md`](file:///Users/cope/projects/fused-protective-services/docs/OPEN_QUESTIONS.md). Facts that are still placeholders carry `placeholder: true` in `src/data/site.mjs`; the build prints a warning for each, and `js/modules/env.mjs` + `components/placeholder.css` flag them in red on any host not listed in `site.productionHosts`.
