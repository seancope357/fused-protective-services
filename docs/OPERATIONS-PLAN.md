# OPERATIONS PLAN — what Cameron needs to actually run the business on this

> [`GO_LIVE.md`](GO_LIVE.md) answers *"what must be true before traffic?"* — licences,
> accounts, DNS, legal. **This file answers a different question: "once it is live, can
> Cameron run a security company on it?"** They are not the same question, and the second
> one is not a launch blocker. Nothing here should delay launch.

**Written 2026-10-07.** Every claim below was checked against the running database and the
source, and the evidence is quoted. Where an earlier assessment was wrong, it is corrected
here rather than quietly dropped.

---

## The one-paragraph summary

The portal is a genuinely good **lead-to-cash** system: lead → quote → proposal with
e-acceptance → job → invoice → Stripe payment → client portal → reviews, all mobile-first
and tested. What it is not yet is a **guard-company operations console**. The schema models
officers, assignments, clock-in, licence expiry, pay rates and required headcount — and
almost none of it is read by any screen. The result is a portal where **you cannot add a
guard**, and therefore cannot answer the three questions a staffing business lives on:

1. Is every post covered tonight?
2. Is anyone about to work on an expired DPS licence?
3. Did I make money on that job?

---

## Evidence: the schema is ahead of the UI

Checked 2026-10-07 by grepping `app/src/` for each column. These are not missing features
to design from scratch; they are tables nobody reads.

| Already in the database | Read anywhere in `app/src/`? |
| :--- | :--- |
| `officers` (incl. `dps_license_level`, `dps_license_number`) | **No UI at all.** No `src/lib/actions/officers.ts` exists — there is no write path to create an officer |
| `officers.dps_license_expires_on` | **Zero references.** Nothing reads it, nothing alerts on it |
| `shift_assignments` (who works which shift) | **One reference in the whole app** — `notifications/scheduler.ts:73`, the `job_unstaffed_24h` count. No screen shows an assignment |
| `shift_assignments.clock_in_at / lat / lng / clock_out_at` | **Zero references.** Columns exist, unused |
| `shifts.pay_rate_cents` | **Zero references.** Margin is never computed (`bill_rate_cents` *is* used, for the billing estimate) |
| `shifts.officers_required` | Used for the billing estimate and the job form — but **never compared against assignments**, so "short-staffed" is not a state the UI can show |
| `client_quotes.first_response_at` | Written when a lead is answered (`actions/leads.ts`), shown on one lead page — **never aggregated**, so the advertised response time is unmeasured |

Row counts on the production database the same day: `officers` 0 · `shifts` 0 ·
`jobs` 0 · `quotes` 0 · `proposals` 0 · `payments` 0 · `settings` 0 · `clients` 0.
One lead, one invoice, one profile (Sean).

### A correction

An earlier verbal assessment called "show assigned/required on Today" the cheapest
high-value win, on the assumption it was a pure read over existing data. **That was
wrong.** A coverage indicator is worthless while nothing can create an assignment — it
would read `0/2` forever. Roster and assignment have to land first, or with it. The
genuinely independent quick wins are **margin** and **response time** (items 4 and 5).

---

## Ordered plan

Ordering is by *what protects or earns money*, with each item's real dependency — not by
how easy it is to build.

### 0 · Run the chain once, by hand — **no code** · owner: Cameron + Sean

GO_LIVE **F1**. Zero quotes, jobs or payments have ever existed. Everything below is
written against a system whose happy path has never carried a single row. Push one fake
client through quote → proposal → accept → job → invoice → pay → receipt before building
anything new. Expect to find three small things; that is the point.

> This is the highest-value item on the page and it is not an engineering task.

### 1 · Officers roster, shift assignment, and coverage — **SPEC-014** · size L

The operational core, and the gap that makes the portal unusable for its actual purpose.
Create and edit officers; assign them to shifts; see `assigned / required` per shift and
per job; surface short-staffed jobs on Today where Cameron already looks. A
`job_unstaffed_24h` page at 24 hours is a smoke alarm — this is the dashboard that stops
the fire.

**Why first:** an uncovered post is the failure that loses a client permanently and may
breach a contract. Nothing else on this list carries that risk.

### 2 · DPS licence expiry alerts — **SPEC-015** · size S · depends on 1

`dps_license_expires_on` is already a column. Warn at 30 / 14 / 7 days, show expiring
credentials on Today, and block (or loudly flag) assigning an officer whose licence
expires before the shift ends. For a DPS-regulated contractor an expired commission is a
compliance and insurance exposure, not a nicety.

**Depends on 1** only because officers must be creatable before expiry can be tracked.

### 3 · Clock-in / clock-out — size M · depends on 1

The columns exist, including lat/lng. Turns "assigned" into "actually showed up", and is
the raw material for timesheets and for invoicing from worked hours rather than scheduled
hours. Officer-facing; `/officer` is currently an honest 23-line stub that says so.

### 4 · Job margin — size S · **independent, buildable today**

`shifts.bill_rate_cents` and `shifts.pay_rate_cents` both exist per shift. Show
bill − pay per shift, per job, and a monthly margin figure beside "Collected this month".
In a staffing business the spread *is* the business, and right now the dashboard reports
revenue as though it were profit.

### 5 · Response-time measurement — size S · **independent, buildable today**

`first_response_at` is already written on every answered lead. Compute median and worst
first-response time, and show it against the window the website advertises. The scheduler
already pages at 2 hours unanswered; this is how Cameron finds out whether the promise on
the site is being kept before a client does.

### 6 · Deferred, deliberately

Incident reports with photos, timesheet/payroll export, invoicing reconciled to worked
hours, checkpoint scans, a K9 division, HubSpot activation, the client-side PDF generator.
All are real, none protects revenue the way 1–2 do. The schema seams exist; revisit after
Phase 1 is genuinely in use.

---

## What this plan does **not** change

- **Launch is not blocked by any of it.** Keep shipping GO_LIVE.
- No new third-party dependency, no new vendor, no schema rewrite — items 1–5 are reads and
  writes over tables that already exist, plus one additive migration at most.
- Every spec inherits the ten invariants in [`../specs/README.md`](../specs/README.md).
  In particular: no fake success, business facts stay in `src/data/`, migrations additive,
  and every new behaviour gets a test.

## Sequencing note

Items **4** and **5** are small, independent, and buildable with no dependency on anything
else. If Cameron's first sign-in slips, or SPEC-014 needs a design conversation, take 4 and
5 in the meantime — each is a self-contained PR that makes the dashboard tell the truth
about money and about the response promise.
