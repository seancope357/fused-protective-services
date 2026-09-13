# GO-LIVE — Fused Protective Services

> **Status as of 2026-09-13: the software is ready; the business configuration is not.**
> Nothing on this list is a code rewrite. It is licences, accounts, DNS, two legal
> paragraphs, and the operational scaffolding a revenue system needs before it carries
> real money and real details.

**What "live" means here.** Two surfaces launch together:

| Surface | Today | At go-live |
| :--- | :--- | :--- |
| Marketing site + intake | `fused-protective-services.vercel.app` | `fusedprotectiveservices.com` |
| Operations portal | `fused-portal.vercel.app` | `app.fusedprotectiveservices.com` |

The engineering half of this list is specified for the agent team in
[`specs/`](../specs/README.md) — one spec per buildable item, tagged below as **→ SPEC-0NN**.

Setup procedures are in [`RUNBOOK.md`](RUNBOOK.md). The business facts nobody but Cameron
can supply are in [`OPEN_QUESTIONS.md`](OPEN_QUESTIONS.md). **This file is the ordered
gate list** — what must be true before traffic, and who owns each item.

---

## Verified green on 2026-09-13

Re-run before launch; all of it passed on this commit:

- [x] `node build.mjs --check` — generated output matches `src/` byte for byte (8 files).
- [x] `node --test 'tests/*.test.mjs'` — 7 intake tests (gate, honeypot, duplicates, rate limit).
- [x] `cd app && pnpm typecheck` — clean.
- [x] `cd app && pnpm exec vitest run --exclude 'tests/db/**'` — 35 tests.
- [x] `cd app && pnpm build` — Next.js build succeeds, ~40 routes.
- [x] RLS, numbering and invoice DB suites run in CI against Postgres 17 (need a local
      database; not run here).

Also standing: append-only audit log, staff TOTP enforced in the database, login rate
limiting, 8 h/72 h session policy, nonce CSP + HSTS **on the portal**, same-origin CORS
and abuse gate on intake, Stripe webhook as the single payment authority with event
deduplication.

---

## Gate A — Truthfulness and law

**Nothing public goes out while any box here is open.** A licensed security contractor
advertising in Texas is regulated; every item below is either a legal requirement or a
statement the site makes that must be true.

- [ ] **A1 · Texas DPS licence number.** `src/data/site.mjs` → `licenseNumber.value`, then
      `placeholder: false`, then `node build.mjs`. Tex. Occ. Code §1702.284 requires it in
      advertising, and this website is advertising. **Owner: Cameron.**
      ⚠️ **Sequencing trap:** the red PLACEHOLDER flag is hidden on any host listed in
      `site.productionHosts` — which already includes `fused-protective-services.vercel.app`.
      `B00000` is rendering unflagged on the live URL right now, in the footer and in the
      schema.org `identifier`. Connecting the custom domain (C1) before fixing this hides
      the guardrail rather than the problem. Fix A1 first.
      The guardrail itself is made fail-closed by [**SPEC-001**](../specs/SPEC-001-placeholder-guardrail.md);
      the number still has to come from Cameron.
- [ ] **A2 · Prove the dispatch line rings.** `(512) 555-0199` is marked confirmed in
      `src/data/site.mjs`, but `555-01xx` is the North American block reserved for fiction.
      Dial it from an outside phone. If it does not connect, edit `display` and `e164`.
      Every ad, the nav, the drawer, the dispatch bar, the footer, the schema record and
      the confirmation emails read from that one field. **Owner: Cameron / Sean.**
- [ ] **A3 · Attorney review of `/privacy`, `/terms`, `/sms-consent`.** Then `reviewed: true`
      and `reviewedOn` in `src/data/legal.mjs`. Until then all three carry a draft banner
      and are `noindex` — and the SMS consent checkbox on both intake forms links to a page
      marked "draft", which weakens the consent record Twilio's 10DLC campaign depends on.
      **Owner: Cameron.** ([OPEN_QUESTIONS §6](OPEN_QUESTIONS.md))
- [ ] **A4 · Cancellation window and liability terms.** Two `TODO(cameron)` paragraphs in
      `src/data/legal.mjs`. These are the paragraphs that get argued about after a detail
      is cancelled at short notice. **Owner: Cameron.** ([§5](OPEN_QUESTIONS.md))
- [ ] **A5 · Sales tax confirmed with the CPA.** `src/data/invoice.mjs` →
      `tax.defaultRatePct` is 8.25% (Austin). Confirm security services are taxable at the
      job jurisdiction's combined rate, and which clients are exempt. Wrong tax on issued
      invoices is expensive to unwind. **Owner: Cameron.** ([§4](OPEN_QUESTIONS.md))
- [ ] **A6 · `dispatch@fusedprotectiveservices.com` must receive mail.** The privacy policy
      directs correction and deletion requests there, and it is the `from` identity for
      client email. An address that bounces is a broken promise in a published policy.
      **Owner: Sean** (falls out of C1 + C2).

---

## Gate B — Can the business be reached and paid

The site's entire job is to turn a visitor into a lead and a lead into cash. Each item
below is a link in that chain; each has a verification step in the runbook, and none is
done until that step passes.

- [ ] **B1 · Resend: verify the sending domain, install, set `DISPATCH_ALERT_FROM`** on
      both Vercel projects. ([RUNBOOK §2](RUNBOOK.md)) **Owner: Sean.**
      *Until this is done there is no client-facing email at all* — no confirmations, no
      proposals, no briefs, no invoices, no receipts, and **no client sign-in links**, so
      no client can enter the portal. This is the single highest-leverage item on the page.
      **Verify:** submit the quote form with your own address → two emails (owner alert +
      confirmation, same reference code); then Clients → *Invite billing contact* → the
      sign-in link arrives and opens the client portal.
- [ ] **B2 · Point alerts at Cameron.** `DISPATCH_ALERT_TO` and `DISPATCH_ALERT_SMS_TO` on
      both projects, plus Portal → Settings. They currently point at Sean.
      **Owner: Cameron** (supplies inbox + mobile). ([§3](OPEN_QUESTIONS.md))
- [ ] **B3 · Twilio + A2P 10DLC.** Brand registration needs the EIN and takes business
      days — **start it before everything else on this page.** ([RUNBOOK §3](RUNBOOK.md))
      Without it: no emergency pages, no 2-hour unanswered-lead alert, no day-before
      reminders. **Owner: Cameron.**
      **Verify:** emergency-division submission texts `DISPATCH_ALERT_SMS_TO`; reply STOP
      lands a row in `sms_opt_outs`.
- [ ] **B4 · Stripe: live keys, ACH enabled, webhook endpoint + secret.**
      ([RUNBOOK §4](RUNBOOK.md)) **Owner: Cameron.**
      **Verify in test mode first:** pay an invoice with `4242…`, confirm it flips to paid
      with one payment row, then replay the event from the Stripe dashboard and confirm the
      response is `duplicate_event` and nothing changes.
- [ ] **B5 · Run one real transaction in live mode** — a small real invoice, paid by card,
      then refunded — before a client ever sees a pay link. Test keys do not prove a live
      account's payout, ACH or risk settings. **Owner: Sean + Cameron.**

---

## Gate C — Domains and environment separation

- [ ] **C1 · DNS for `fusedprotectiveservices.com` and `app.fusedprotectiveservices.com`.**
      ([RUNBOOK §7](RUNBOOK.md)) Resend cannot verify a domain the business does not
      control, so B1 depends on this. Note that every canonical URL, `og:url`, `sitemap.xml`
      entry and the schema.org record already point at the custom domain — today they point
      at a hostname that does not resolve. **Owner: Cameron** (registrar) **/ Sean** (Vercel).
- [ ] **C2 · `APP_URL` set to the app subdomain and redeployed.** Every emailed link is
      built from it. **Owner: Sean.**
- [ ] **C3 · Stop preview deploys writing to the production database.** → [**SPEC-002**](../specs/SPEC-002-environment-separation.md) The Supabase
      variables are injected into *all* Vercel environments, so every pull-request preview
      of either project reads and writes live client data — and a preview submission lands
      in Cameron's real leads inbox. Point preview at a Supabase branch (or a second
      project) and keep `sk_test_` keys scoped to preview. **Owner: engineering.**
- [ ] **C4 · Add the production domain to `productionHosts`** → [**SPEC-001**](../specs/SPEC-001-placeholder-guardrail.md) in `src/data/site.mjs` and
      consider dropping the `.vercel.app` alias from that list, so preview-style hosts show
      placeholder flags again. **Owner: engineering.**

---

## Gate D — Operating a system that holds money and client details

None of this exists today. It is the difference between software that works and software
you can run a business on.

- [ ] **D1 · Error monitoring.** → [**SPEC-003**](../specs/SPEC-003-error-reporting.md) There is no Sentry, no error reporting, nothing. A failed
      Stripe webhook, a broken cron tick or a 500 on the intake function is currently
      discovered by a customer. Wire one project-wide handler for both Vercel projects and
      alert to a channel someone reads. **Owner: engineering.**
- [ ] **D2 · Uptime checks** → [**SPEC-004**](../specs/SPEC-004-health-and-heartbeat.md) on `/`, `/careers`, `POST /api/intake` (synthetic, honeypot-
      tripped so it delivers nothing), the portal login page, and the hourly
      `/api/cron/tick`. A silently dead cron means no reminders, no overdue chasers and no
      7am digest — with no symptom until revenue is missing. **Owner: engineering.**
- [ ] **D3 · Analytics and conversion measurement.** → [**SPEC-005**](../specs/SPEC-005-conversion-analytics.md) Also absent. Without it nobody can say
      whether the assessment quiz, the estimator or the WebGL intro help or hurt, or what a
      lead costs. Privacy-first and cookieless keeps the privacy policy accurate as written.
      **Owner: Sean.**
- [ ] **D4 · Database backups — and one restore drill.** → [**SPEC-011**](../specs/SPEC-011-incident-and-restore.md) Confirm the Supabase plan's backup
      cadence and point-in-time recovery window, then actually restore into a scratch
      project once. An untested backup is a hypothesis. **Owner: engineering.**
- [ ] **D5 · Secrets inventory and rotation.** ~18 variables across two projects
      ([RUNBOOK §9](RUNBOOK.md)). Record who holds each account, confirm
      `SUPABASE_SERVICE_ROLE_KEY` is server-only in both, and confirm the two
      `NEXT_PUBLIC_*` values are stored **non-sensitive** (a sensitive value bakes the
      literal `[SENSITIVE]` into the browser bundle and auth breaks). **Owner: Sean.**
- [ ] **D6 · Delete `~/.fused-portal-owner-initial-password`** from the build Mac after
      changing the owner password. **Owner: Sean.**
- [ ] **D7 · Both owner accounts enrolled in TOTP.** The database refuses staff data to a
      password-only session once a factor exists — so enrolment is also what proves the
      control works. Create Cameron's account at Portal → Settings → *Add command staff*.
      **Owner: Sean + Cameron.**
- [ ] **D8 · Rollback and incident procedure, written down.** → [**SPEC-011**](../specs/SPEC-011-incident-and-restore.md) Which Vercel deployment to
      promote back to, how to disable the cron, who to call when payments misbehave, and
      the fact that migrations are additive and applied by hand through the dashboard.
      One page in `docs/`. **Owner: engineering.**

---

## Gate E — Quality before spending money on traffic

- [ ] **E1 · Content-Security-Policy on the marketing site.** → [**SPEC-006**](../specs/SPEC-006-marketing-site-csp.md) The portal has a nonce-based
      CSP and HSTS; `vercel.json` at the repo root sets four headers and no CSP — on the
      surface that actually collects names, phone numbers and emails. The code standards
      already forbid inline handlers and inline styles, so a strict policy
      (`self` + the two three.js CDNs + Google Fonts) is mostly a matter of writing it.
      Add HSTS there too. **Owner: engineering.**
- [ ] **E2 · Real social and favicon assets.** → [**SPEC-007**](../specs/SPEC-007-brand-assets.md) `assets/logo.png` is 1.07 MB at 1000×1000 and
      is simultaneously the brand plate, the WebGL voxel source, the favicon and the
      `og:image` — while the page declares `twitter:card: summary_large_image`, which wants
      1200×630. Every share preview is currently a 1 MB square in a wide frame. Ship a
      dedicated OG card and a small favicon set. **Owner: engineering.**
- [ ] **E3 · Mobile performance budget.** → [**SPEC-009**](../specs/SPEC-009-performance-budget.md) The intro assembles ~65,000 voxel cubes over
      WebGL, with three.js pulled from jsDelivr (unpkg fallback). Measure Core Web Vitals
      on a mid-range Android over 4G and set a budget. The reduced-motion and
      no-WebGL fallbacks exist; confirm they look deliberate. **Owner: engineering.**
- [ ] **E4 · Accessibility pass against the stated WCAG 2.1 AA baseline.** → [**SPEC-008**](../specs/SPEC-008-accessibility-gate.md) `context/ui-standards.md`
      claims AA; CI checks drift and unit tests, not accessibility. Run axe over both pages
      plus the portal's forms, and keyboard-walk the quote form, the bookshelf, the protocol
      tablist and the drawer. Add the check to CI so the claim stays true. **Owner: engineering.**
- [ ] **E5 · Search Console + Bing Webmaster, sitemap submitted** after C1 — not before, or
      you index a hostname that does not resolve. **Owner: Sean.**
- [ ] **E6 · Google Business Profile** for Austin and San Antonio, NAP consistent with
      `src/data/site.mjs`. For a local service business this outranks almost everything else
      in E. **Owner: Cameron.**

---

## Gate F — Can Cameron actually run it on day one

- [ ] **F1 · End-to-end dry run, by Cameron, on production.** Submit a lead → convert to a
      quote → send a proposal → accept it from the client portal → the job appears → invoice
      from shifts → pay it → the receipt arrives → leave a review. If any step needs Sean,
      it is not ready. **Owner: Cameron + Sean.**
- [ ] **F2 · Portal → Settings populated:** alert recipients, default deposit %
      ([§7](OPEN_QUESTIONS.md)), tax defaults and any exempt clients, integrations check all
      green. **Owner: Cameron.**
- [ ] **F3 · Decide what happens to candidate applications.** → [**SPEC-010**](../specs/SPEC-010-candidate-ats.md) `/careers` writes to
      `candidate_applications` and emails dispatch, but **the portal has no screen for
      them** — there is no way to review, stage or reject a candidate except in email and
      the Supabase table editor. Either build the ATS inbox or agree explicitly that
      recruiting runs out of the inbox for now. **Owner: Cameron decides, engineering builds.**
- [ ] **F4 · Set expectations on the officer portal.** `/officer` is an honest stub: sign-in,
      role and RLS scoping work; assigned shifts, clock-in and checkpoint scans are Phase 2.
      Do not promise officers an app in recruiting material yet. **Owner: Cameron.**
- [ ] **F5 · Response-time commitment staffed.** The site advertises a response window and
      24/7 dispatch, and the scheduler pages at 2 hours unanswered. Someone must be on the
      other end of that page at 3am. **Owner: Cameron.**
- [ ] **F6 · Reviews.** Nothing to do at launch — reviews are collected after every job and
      published from Portal → Reviews into `src/data/reviews.mjs`. The schema.org rating
      appears only from real reviews, and stays absent until then. ([§13](OPEN_QUESTIONS.md))

---

## Launch sequence

Dependencies, in the order they unblock each other:

```
Day -10   B3 Twilio 10DLC brand registration ......... starts now, takes days
Day -7    C1 DNS  ──►  B1 Resend domain verification  ──►  B2 recipients
          A1 licence number, A2 phone proof, A3/A4 to counsel
Day -3    B4 Stripe (test) ──► B5 one live transaction
          C2 APP_URL  ·  C3 preview/prod split  ·  D5–D7 secrets & accounts
Day -2    D1 monitoring  ·  D2 uptime  ·  D3 analytics  ·  D4 restore drill
          E1 CSP  ·  E2 assets  ·  E4 a11y pass
Day -1    F1 dry run by Cameron, end to end, on production
Day  0    Flip DNS, re-run the verified-green block, E5 submit sitemap, E6 GBP
```

The three long poles are **Twilio 10DLC registration** (business days, EIN required),
**attorney review**, and **DNS → Resend verification**, which is a chain, not three
parallel tasks. Everything else fits in the days around them.

---

## Explicitly not required for launch

So nobody blocks on them: Phase 2 officer operations (roster UI, shift assignment, GPS
clock-in, incident reports, timesheets — the schema seams exist), HubSpot CRM activation,
the client-side PDF generator, a K9 division, and the testimonials section (F6).

---

*Keep this file honest: tick a box only after its verification step passes, and move
anything that turns out to be blocked into [`OPEN_QUESTIONS.md`](OPEN_QUESTIONS.md) with
the name of whoever owns it.*
