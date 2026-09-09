# OPEN QUESTIONS — blocked on Cameron (and two on Sean)

Every item here is a business fact the code cannot invent, or an account only a human
can open. Each names the file or setting and what happens if it is left alone.
Placeholders are flagged in red on every non-production host so none can ship quietly.

## 1. Dispatch phone number — resolved 2026-09-09

`(512) 555-0199` confirmed by Sean as the dispatch line; `placeholder` is now false in
`src/data/site.mjs`. Note: 555-01xx is the block reserved for fiction in the North
American numbering plan; if the line does not ring, edit `display` and `e164` there.

## 2. Texas DPS Private Security licence number

- **TODO(cameron):** the company licence number (format `B12345` or `C12345`).
- **File:** `src/data/site.mjs` → `licenseNumber.value`, set `placeholder: false`.
- **Renders in:** footer, schema.org `identifier`, proposal and invoice headers.
- **If left:** `B00000` is shown. Tex. Occ. Code §1702.284 requires the number in advertising.

## 3. Dispatch alert recipients

- **TODO(cameron):** the inbox and mobile number for lead alerts and daily digests.
- **Where:** Portal → Settings (owner email, owner phone), or Vercel env
  `DISPATCH_ALERT_TO` / `DISPATCH_ALERT_SMS_TO` on both projects.
- **If left:** alerts go to Sean's inbox; emergency texts go nowhere.

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
