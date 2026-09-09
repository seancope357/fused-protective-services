# OPEN QUESTIONS — blocked on Cameron

Every item here is a business fact the code cannot invent. Each names the file to
edit and what happens if it is left alone. Placeholders are flagged in red on
every non-production host so none of them can ship quietly.

## 1. Dispatch phone number

- **TODO(cameron):** the real 24/7 dispatch line.
- **File:** `src/data/site.mjs` → `phone.display`, `phone.e164`, set `placeholder: false`.
- **Renders in:** nav, mobile drawer, dispatch bar, footer, schema.org, every
  confirmation email and SMS.
- **If left:** every call button on the live site dials `(512) 555-0199`, a number in
  the range reserved for fiction. Leads who prefer to call are lost.

## 2. Texas DPS Private Security licence number

- **TODO(cameron):** the company licence number (format `B12345` or `C12345`).
- **File:** `src/data/site.mjs` → `licenseNumber.value`, set `placeholder: false`.
- **Renders in:** footer, schema.org `identifier`.
- **If left:** the footer shows `B00000`. Texas Occupations Code §1702.284 requires
  the licence number in advertising; a missing or false number is a compliance
  exposure on a client-facing site.

## 3. Dispatch alert recipients

- **TODO(cameron):** the inbox and mobile number that should receive lead alerts.
- **Where:** Vercel env `DISPATCH_ALERT_TO` (email) and `DISPATCH_ALERT_SMS_TO` (E.164).
- **If left:** alerts go to Sean's inbox; emergency texts go nowhere.

## 4. Sales tax on security services

- **TODO(cameron):** confirm with the CPA that security services are taxable in
  Texas at the combined rate for the job's jurisdiction, and whether any client is
  exempt.
- **File:** `src/data/invoice.mjs` → `tax.defaultRatePct` (8.25% Austin combined).
- **If left:** invoices tax every job at the Austin rate. A San Antonio job
  (8.25% as well today) is fine; other jurisdictions and exempt clients are not.

## 5. Reviews

- **TODO(cameron):** none required now. The false 5.0 / 28-review claim is gone.
- **File:** `src/data/reviews.mjs`. Populate only from reviews collected through
  the platform with permission to publish.
- **If left:** no rating markup. That is the correct state until real reviews exist.

## 6. Resend marketplace terms

- **TODO(sean):** accept Resend's terms in the Vercel dashboard (a human must),
  then `vercel integration add resend --name fused-dispatch-alerts`, then set
  `DISPATCH_ALERT_FROM` after the domain is verified. Steps in `docs/RUNBOOK.md` §2.
- **If left:** leads persist to the database and nobody is emailed or confirmed.

## 7. Twilio account and 10DLC registration

- **TODO(cameron):** an EIN and business details are needed for A2P 10DLC brand
  registration. Steps in `docs/RUNBOOK.md` §3.
- **If left:** no emergency SMS. The site promises a 45-minute dispatch that
  nobody is paged for.

## 8. Custom domain

- **TODO(cameron):** point `fusedprotectiveservices.com` DNS at Vercel and add the
  domain to the `fused-protective-services` project; add `app.` for the portal.
- **If left:** the live site remains at `fused-protective-services.vercel.app`;
  Resend cannot verify a sending domain the business does not control; every
  email link points at a domain that does not resolve.
