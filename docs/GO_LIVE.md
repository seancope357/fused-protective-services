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
      **Verify:** `node build.mjs --verify-release` — exits 1 and names every field still
      marked `placeholder: true`, exits 0 when none remain. Run it immediately before the
      DNS cutover (C1); CI runs the same command in the `release-gate` job, which fires on
      tags and manual dispatch only.
      ⚠️ **The site says so out loud until this is fixed.**
      [**SPEC-001**](../specs/SPEC-001-placeholder-guardrail.md) (shipped) made the guardrail
      fail-closed: the red PLACEHOLDER flag now renders beside `B00000` on **every** host,
      production included, with no JavaScript involved. That is intended pressure, not a
      defect — the alternative is advertising a licence number that is not ours. Connecting
      the custom domain no longer hides it.
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
- [ ] **C3 · Stop preview deploys writing to the production database.** → [**SPEC-002**](../specs/SPEC-002-environment-separation.md) (code shipped)
      **The code half is done.** Every row from a non-production deployment is
      labelled `source_env`; outside production the owner email, emergency SMS,
      visitor confirmation and webhook are all skipped and honestly reported as
      `non_production_env`; the scheduler refuses to run; the portal shows a red
      banner naming the environment and Supabase project ref; and the leads inbox,
      dashboard and nav badge read production rows only. The production scheduler
      also filters to production rows, so a preview lead can no longer page a phone
      even while previews still share the database.
      **What is left is Sean's, in a dashboard:** create the Supabase `preview`
      branch and scope the variables to it ([RUNBOOK §1a](RUNBOOK.md)). Until then
      previews still *read and write* production data — labelled and silent, but
      present. **Owner: Sean.**

- [x] **C4 · `productionHosts` no longer carries a deploy alias.** Done in
      [**SPEC-001**](../specs/SPEC-001-placeholder-guardrail.md): `src/data/site.mjs` lists
      only the apex and `www`. Note the list has a second consumer —
      `api/_lib/http.mjs` builds the CORS origin allowlist from it — so preview deployments
      now rely on `VERCEL_URL` / `VERCEL_BRANCH_URL` at runtime for their own origin, which
      they already did. **Owner: engineering.**

---

## Gate D — Operating a system that holds money and client details

None of this exists today. It is the difference between software that works and software
you can run a business on.

- [x] **D1 · Error monitoring.** ✅ Built — [**SPEC-003**](../specs/SPEC-003-error-reporting.md).
      Asymmetric by design, because the constraints are: `api/_lib/report.mjs` is a
      zero-dependency reporter for the static site and `api/` (structured log line always, ops
      email at `error` severity, wrapped so a throw inside the reporter can never take down the
      handler it was reporting from — proven by a test that makes the transport throw);
      `@sentry/nextjs` in the portal, **server and edge runtimes only**, `tracesSampleRate: 0`,
      no session replay. Browser errors reach `/api/client-error` with no PII — never a form
      value, never the query string. Alerts are deduplicated through `public.alert_gate` so ten
      thousand failures produce a handful of emails with a suppressed count, not ten thousand.
      *Two things worth knowing:* the Sentry SDK is server-side only (confirmed by grepping the
      built client bundle: zero occurrences), so it needed **no portal CSP change** — and a test
      now pins `connect-src` so whoever adds a browser SDK gets a failing test telling them a
      security review is due. **Owner: engineering — done.**
- [ ] **D1a · Error alerting is dark until B1.** The reporter skips with `no_verified_sender`
      and emails nothing until `DISPATCH_ALERT_FROM` is set — it logs every time, and never
      claims a send it did not make. This follows SPEC-003 to the letter, but note the
      codebase's own convention differs: owner-audience mail elsewhere falls back to Resend's
      `onboarding@resend.dev`, which only delivers to the Resend account owner. If Sean wants
      alerts before B1 and is the account owner, it is a one-line change in each reporter.
      **Owner: engineering, decide with B1.**
- [ ] **D1b · Two acceptance criteria are implemented but untested.** Stated rather than
      quietly counted as done: (7) the Stripe webhook reports before every non-2xx with the
      event id in context, and (8) a failing cron rule does not abort the remaining rules.
      Both were verified by reading the code, not by a test. Acceptance 8 is the one that
      matters — a rule that aborts the tick means no reminders and no overdue chasers, with no
      symptom. Needs a chainable Supabase double that throws for one table.
      **Owner: engineering.**
- [ ] **D1c · Set `OPS_ALERT_TO`.** Without it, alerts fall back to `DISPATCH_ALERT_TO` and a
      stack trace reaches whoever is on the dispatch line rather than an engineer. With
      neither set, `report()` records the skip as `no_recipient`. **Owner: Sean.**
- [ ] **D2 · Uptime checks** → [**SPEC-004**](../specs/SPEC-004-health-and-heartbeat.md) on `/`, `/careers`, `POST /api/intake` (synthetic, honeypot-
      tripped so it delivers nothing), the portal login page, and the hourly
      `/api/cron/tick`. A silently dead cron means no reminders, no overdue chasers and no
      7am digest — with no symptom until revenue is missing. **Owner: engineering.**
- [ ] **D3 · Analytics and conversion measurement.** → [**SPEC-005**](../specs/SPEC-005-conversion-analytics.md) Also absent. Without it nobody can say
      whether the assessment quiz, the estimator or the WebGL intro help or hurt, or what a
      lead costs. Privacy-first and cookieless keeps the privacy policy accurate as written.
      **Owner: Sean.**
- [ ] **D4 · Database backups — and one restore drill.** → [**SPEC-011**](../specs/SPEC-011-incident-and-restore.md)
      The procedure is written and ready to run: [`RESTORE-DRILL.md`](RESTORE-DRILL.md).
      **It has not been run.** Nobody has confirmed the plan's backup cadence or
      point-in-time recovery window, and no restore of this database has ever been
      attempted — an untested backup is a hypothesis. It needs Supabase dashboard
      access and a scratch project, so no agent could do it. **Owner: Sean.**
      **Verify:** every result field in RESTORE-DRILL.md §6 filled in and signed,
      with `verify-restore.mjs` and `pnpm test:db` green against the restored
      database. If the plan has no PITR, that is a cost decision to make before
      launch, not after.

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
- [x] **D8 · Rollback and incident procedure, written down.** → [**SPEC-011**](../specs/SPEC-011-incident-and-restore.md)
      [`INCIDENT.md`](INCIDENT.md): first-minute triage across both Vercel projects,
      four reversible stop-the-bleeding actions each naming what breaks and what
      degrades honestly, five scenarios with their first three steps, and who tells
      whom. Writing it corrected four things this runbook had wrong — see the note in
      [RUNBOOK §8](RUNBOOK.md). Re-read it once SPEC-003 and SPEC-004 land, so the
      alert an engineer receives names the section that handles it.
      The drill's verifier (`app/scripts/verify-restore.mjs`) now runs in CI on every
      push, against the freshly migrated database, after the test suite has put rows in
      it — so its SQL is proven continuously rather than first discovered broken during
      an incident. Both cases were checked by hand before wiring it up: a populated
      database (20/20 tables, 39 policies, sequence at 236) and a virgin restore
      (all tables empty, next mint 1); both exit 0. **Owner: engineering.**

---

## Gate E — Quality before spending money on traffic

- [x] **E1 · CSP and HSTS on the marketing site.** ✅ Built — [**SPEC-006**](../specs/SPEC-006-marketing-site-csp.md).
      Every page ships `default-src 'self'` with **no allowlisted origin**, no `unsafe-inline`
      and no `unsafe-eval`; `frame-ancestors 'none'` with `X-Frame-Options: DENY` to agree with
      it; HSTS `max-age=63072000; includeSubDomains; preload`. The spec proposed allowlisting
      the two three.js CDNs and Google Fonts — instead three.js and all three typefaces are
      now served from our own origin, so the policy needs no exception at all. `vercel.json` is
      **generated** by `build.mjs` (it carries a sha256 per inline `<script>`, which moves
      whenever `src/data/` changes) and is covered by `--check`; a hand edit fails the build.
      `serve.py` reads the same header set back, so a violation surfaces locally.
      *Verified:* zero violations on all six pages in Chromium with the policy **enforcing**,
      plus an 18/18 negative control proving the policy is actually live — injected `<style>`,
      `style=""`, inline `onclick` and cross-origin `fetch` all blocked, CSSOM still working.
      Zero violations alone is also what a *missing* policy looks like, which is why the
      negative control is the evidence that counts. **Owner: engineering — done.**
- [ ] **E1a · Sweep Firefox and Safari once a preview deploy exists.** Chromium was swept
      locally; the other two engines were not, because they are not installed here. Nothing in
      this policy is engine-divergent (no nonces, no `strict-dynamic`, no reporting endpoint),
      so this is confirmation rather than expected work. **Owner: engineering, at first deploy.**
- [ ] **E1b · HSTS preload submission — do NOT do this yet.** `preload` in the header is only a
      declaration of intent until the domain is submitted at hstspreload.org. Removal from that
      list takes months, so submit only once the apex and `www` both serve HTTPS correctly.
      **Owner: Sean, after C1/C2.**
- [x] **E2 · Brand assets right-sized.** → [**SPEC-007**](../specs/SPEC-007-brand-assets.md)
      The favicon was the 1,095,464-byte brand plate; it is now `assets/icon-32.png`
      at **575 bytes**, with an apple-touch icon and a 512 icon linked alongside.
      `assets/og-card.png` is a **composed** 1200×630 card (178 KB) declared with
      `og:image:width`, `:height`, `:alt`, `:type` — not a square logo letterboxed into
      a wide frame. The brand plate and the voxel source share one 134 KB WebP at full
      resolution. **A first view of `/` drops 959,959 bytes**, measured in a real browser
      against both branches. `build.mjs` now refuses to build, check or release if a
      referenced asset is missing. Derivatives come from `./scripts/build-assets.sh` and
      are committed; the build still imports no image library.
      *Worth knowing:* the spec's premise was wrong and ASSETS disproved it — cube
      placement never used the source resolution (`GRID_ROWS` is already 256 and the
      master has no alpha channel), so the plate shrank by **re-encoding**, not
      downscaling: smaller than a 512 downscale and measurably sharper.
      **Still open:** the Twitter/X and Facebook validators both need a public URL, so
      run them as the last step of this gate after DNS cutover (C1). **Owner: engineering.**

- [ ] **E3 · Mobile performance budget.** → [**SPEC-009**](../specs/SPEC-009-performance-budget.md) The intro assembles ~65,000 voxel cubes over
      WebGL, with three.js pulled from jsDelivr (unpkg fallback). Measure Core Web Vitals
      on a mid-range Android over 4G and set a budget. The reduced-motion and
      no-WebGL fallbacks exist; confirm they look deliberate. **Owner: engineering.**
- [ ] **E4 · Accessibility pass against the stated WCAG 2.1 AA baseline.** → [**SPEC-008**](../specs/SPEC-008-accessibility-gate.md)
      **Audited; gate staged, not armed.** [`A11Y-AUDIT.md`](A11Y-AUDIT.md) (2026-09-14)
      records the full pass: 48 axe violations, every one `color-contrast` and serious,
      **42 of them from a single token**, plus twelve manual findings each carrying file,
      line, selector, rule id and the exact fix. The portal's sign-in screen is clean.
      The keyboard funnel works end to end, including escaping the scroll-driven intro —
      measured against the real 350vh track, not the collapsed fallback.
      The `a11y` job runs on every push and PR and reports every violation, but carries
      `continue-on-error: true` because the remaining defects live in files SPEC-006 and
      SPEC-007 own. No axe rule is disabled anywhere.
      **To close this gate:** land the audit's Part E fix list, delete that one line, and
      add `a11y` to required checks. Two items need a design decision first — **A-01**, the
      `--text-tertiary` value, and **A11Y-05**, the gold gradient on interactive faces;
      `context/ui-standards.md` owns both tokens. **Owner: engineering.**
      *Already fixed here:* **A11Y-01/02** — the skip link on `/` pointed at
      `#capabilities`, three sections into `<main>`, so a keyboard or screen-reader visitor
      skipped the entire hero and never reached either primary CTA. `/careers` was the same.
      Both now target `#main`, and all four `<main>` elements carry `tabindex="-1"` so
      activation actually moves focus rather than relying on Chrome's fallback.

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
- [x] **F3 · Candidate ATS.** ✅ Built — [**SPEC-010**](../specs/SPEC-010-candidate-ats.md).
      `/portal/candidates` lists, filters and stages applications from `/careers`, production
      rows only; `/portal/candidates/[id]` carries the full application, internal notes,
      assignment, rejection and the audit timeline. Stages advance one at a time and cannot
      skip; a rejection can be re-opened; every change is audited with actor and diff.
      Two things stay human: the candidate emails do not send until **B1** (verified Resend
      sender) — until then they render, log and skip with `no_verified_sender` — and reaching
      `active_roster` deliberately creates no `officers` row, so activating an officer
      (pay rate, assignments) remains a manual Phase 2 step. *Verify:* Portal → Candidates,
      stage a test application through to rejection and re-open it; the Activity feed links
      the row. **Owner: engineering — done.**
- [ ] **F3a · Settle the application retention period.** The privacy policy now says a
      careers application is kept with its hiring record and, for a hired applicant, for as
      long as DPS record-keeping requires — which is true of what the system does today:
      **nothing deletes applications automatically.** A fixed period (SPEC-010 proposed 24
      months for unsuccessful applicants) cannot be published until either a deleter ships or
      counsel sets the floor, because a policy must not promise a purge that does not run.
      Decide with the same counsel review as **A3**; if a period is set, engineering adds the
      deletion to the cron tick and the policy sentence changes with it.
      **Owner: Cameron + counsel decides, engineering builds.**
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
