# OPEN QUESTIONS — blocked on Cameron (and two on Sean)

The ordered launch gates that consume these answers live in
[`GO_LIVE.md`](GO_LIVE.md).

Every item here is a business fact the code cannot invent, or an account only a human
can open. Each names the file or setting and what happens if it is left alone.
Placeholders are flagged in red on every host, production included, so none can ship quietly.

## 1. Dispatch phone number — resolved 2026-09-09, re-confirmed 2026-11-23

`(512) 555-0199` confirmed by Sean as the dispatch line; `placeholder` is false in
`src/data/site.mjs`. On 2026-11-23 Sean confirmed it is a real, working number, which
closes the earlier worry about the 555-01xx fiction block.

## 2. Texas DPS Private Security licence number — resolved 2026-11-23

- **Number:** `B32355001`, the company licence. Cameron sent it; Sean confirmed it on
  2026-11-23. It replaced `01766480` (supplied 2026-09-14), which was never confirmed as the
  company licence. Renders in the footer, schema.org `identifier`, proposal and invoice headers.
- **Address:** Sean decided on 2026-11-23 not to show a street address. (37 TAC §35.9 asks for
  the DPS-record address in advertising unless it is residential.)
- **Still open (optional):** Cameron's personal Level IV PPO number, if he wants it shown
  alongside the company licence. It cannot replace the company licence.

## 3. Dispatch alert recipients — email resolved 2026-11-23; mobile open

- **Email:** `DISPATCH_ALERT_TO` on both Vercel projects is
  `dispatch@fusedprotectiveservices.com` (Cameron's Zoho inbox) plus Sean's address during
  launch. Drop Sean from the list once Cameron is running it. Portal → Settings is empty, so
  the environment variable governs (a saved `owner_email` would override it).
- **`OPS_ALERT_TO`** is Sean's address on both projects, so error alerts never reach the
  dispatch inbox.
- **TODO(cameron):** the mobile number for emergency texts (`DISPATCH_ALERT_SMS_TO`, or
  Portal → Settings → owner phone). Needs Twilio (§10) first.
- **Note:** nothing is emailed until Resend is set up (§8).

## 4. Sales tax

- **TODO(cameron):** confirm with the CPA that security services are taxable at the
  combined rate of the job's jurisdiction, and which clients are exempt.
- **File:** `src/data/invoice.mjs` → `tax.defaultRatePct` (8.25% Austin). Per-client and
  per-site overrides and a tax-exempt flag exist in the portal.
- **If left:** every new client defaults to 8.25%.

## 5. Cancellation policy and liability terms

- **TODO(cameron):** cancellation window and fee; limitation of liability and indemnity.
- **File:** `src/data/legal.mjs` (Terms of Service, two `TODO(cameron)` paragraphs).
- **If left:** the terms page shows the placeholders inside a visible draft banner.

## 6. Attorney review of the legal pages

- **TODO(cameron):** have counsel review `privacy`, `terms` and `sms-consent`, then set
  `reviewed: true` and `reviewedOn` in `src/data/legal.mjs`.
- **If left:** the pages carry a "Draft — pending attorney review" banner and are
  `noindex`. The SMS consent checkbox on the forms links to the draft.

## 7. Deposit policy

- **TODO(cameron):** default deposit percentage for new engagements, if any.
- **Where:** Portal → Settings → *Default deposit %*; per-quote override on every quote.
- **If left:** quotes default to no deposit. Deposit and balance invoicing work when set.

## 8. Resend marketplace terms and sending domain

- **TODO(sean):** accept Resend's terms in the Vercel dashboard, install, verify the
  domain, set `DISPATCH_ALERT_FROM` on both projects (`docs/RUNBOOK.md` §2).
- **Ready since 2026-11-23:** the domain receives mail (Zoho), and `_dmarc` is published at
  `p=none`. When Resend gives its records: its MX and SPF normally sit on a `send.`
  subdomain, so the root SPF (`v=spf1 include:zohomail.com ~all`) stays as it is. If Resend
  asks for a root SPF include, **merge** it into that one record; two root SPF records
  break both senders.
- **If left:** no client-facing email at all — no confirmations, proposals, briefs,
  invoices, receipts, and **no client sign-in links** (clients cannot use the portal).

## 9. Portal Git settings — resolved 2026-09-09

Root directory, outside-root files and the Git connection are set; the portal deploys on every push to `main`.

## 10. Twilio account and 10DLC registration

- **TODO(cameron):** EIN and business details for A2P brand registration
  (`docs/RUNBOOK.md` §3).
- **If left:** no SMS: no emergency pages, no 2-hour unanswered-lead alerts, no
  day-before reminders, no proposal-accepted texts.

## 11. Stripe live keys and webhook

- **TODO(cameron):** a Stripe account with ACH enabled; keys and webhook secret
  (`docs/RUNBOOK.md` §4).
- **If left:** invoices send with a pay link that says online payment is unavailable and
  asks for a check; nothing marks itself paid except manual entry in the portal.

## 12. Custom domain

- **TODO(cameron):** DNS for `fusedprotectiveservices.com` and `app.fusedprotectiveservices.com`.
- **If left:** the site stays at `fused-protective-services.vercel.app`, the portal at
  `fused-portal.vercel.app`; Resend cannot verify a domain the business does not control.

## 13. Reviews on the website

- Nothing required now. Reviews are collected after every job; publish permitted ones
  in Portal → Reviews and paste the export into `src/data/reviews.mjs`. The schema.org
  rating appears only from real reviews.

## 11. Client logo consent (COTA, Texas Tribune Festival)

- **TODO(cameron):** written OK from Circuit of The Americas (an email from his contact is
  enough) to show its logo in the "Trusted at" band. COTA's ticket policy bars commercial
  use of its logo without prior written consent. Sean shipped the logo on 2026-11-23 with
  this still open.
- **File:** `src/data/proof.mjs` → the COTA entry's `logo`.
- **TODO(cameron):** the same written OK from The Texas Tribune for the Texas Tribune
  Festival logo (added 2026-11-23), and what work Fused did there.
- **If either objects:** set that entry's `logo: null`; the band falls back to the name as a wordmark.
