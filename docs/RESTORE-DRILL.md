# RESTORE DRILL — Fused Protective Services

> # ⚠️ THIS DRILL HAS NOT BEEN RUN.
>
> **Status: NOT RUN. Every result field below is empty and must stay empty until someone
> has actually done this.**
>
> This document is a *procedure ready to execute*, not a record. Nobody has confirmed the
> Supabase plan's backup cadence, nobody has confirmed the point-in-time recovery window,
> and no restore of this database has ever been attempted. **The backup is a hypothesis.**
>
> **Owner: Sean. Running this closes [`GO_LIVE.md`](GO_LIVE.md) D4. It must be done before
> launch.** It needs Supabase dashboard access and the ability to create and delete a
> scratch project — which is why no agent could run it and why the results are blank.
>
> Do not tick D4, and do not let anyone cite this file as evidence of a working backup,
> until §6 is filled in and signed.

The database holds every lead, client, proposal, job, invoice, payment and audit record —
the business itself, not just its data. Step 4 is the whole point of the exercise:
*"the restore completed"* is not the same as *"the system works"*.

Budget **90 minutes**. Run it against production, on a quiet morning, with Cameron told in
advance that you are doing it. Nothing here writes to the production project.

---

## Before you start

- Supabase dashboard access to project `zphyvnouierjwjqjvahs` (RUNBOOK §1), and permission
  to create and delete a second project on the same organisation.
- A local checkout of this repository on `main`, with `cd app && pnpm install` done.
- `psql` on `PATH` (the verification script and `pnpm test:db` both need it).
- The production connection string, read-only, for the row counts in step 1. Supabase →
  **Project Settings → Database → Connection string**.
- Somewhere to paste numbers as you go. Fill this document in *as you work*, not afterwards
  from memory — the elapsed times are the part people reconstruct wrongly.

---

## 1 · Confirm what the plan actually retains

**Write the numbers down. Do not assume them, and do not copy them from Supabase's pricing
page — read them from this project's dashboard.**

Supabase → the project → **Database → Backups**. Record what that page says, and separately
whether the **Point in Time Recovery** tab is available or offers an upgrade.

| Fact | Where it comes from | Value |
| :--- | :--- | :--- |
| Supabase plan | Project Settings → Billing | |
| Backup cadence | Database → Backups | |
| Backups retained for | Database → Backups | |
| Point-in-time recovery available? | Database → Backups → Point in Time Recovery | |
| PITR window (hours) | same | |
| **Worst-case data loss window** | cadence, or PITR window if enabled | |
| Recorded by / date | | |

> **If this plan has no PITR, say so here in hours, plainly, and stop to raise it with Sean
> as a cost question before launch.** A nightly backup on a system that mints sequential
> invoice numbers and records payments means that after a restore you can reissue an invoice
> number that a client has already been asked to pay. That is a billing dispute, not an
> inconvenience. Do not quietly accept a 24-hour window; record the decision either way.

Also record, from production, the numbers you are going to compare against — the same
tables the script in step 4 counts:

```bash
cd app
node scripts/verify-restore.mjs "$PRODUCTION_READONLY_CONNECTION_STRING" | tee /tmp/before.txt
```

## 2 · Restore into a scratch project

1. Supabase → **New project** in the same organisation. Name it `fused-restore-drill`.
   Choose the same region as production. Note the moment you start.
2. Restore the most recent backup into it. Supabase → the **production** project →
   **Database → Backups** → the backup → *Restore*, targeting the scratch project (with PITR
   enabled, pick a timestamp instead and record which one you chose).
3. Note the moment the restore reports complete, and anything the dashboard warned about.

> If the dashboard offers no way to restore into a *different* project, stop and record that
> here. It changes the whole procedure: the only restore path is then in-place over
> production, which is not something to discover during an incident. Raise it with Sean.

## 3 · Point a local portal at it

```bash
cd app
cp .env.example .env.drill        # then edit .env.drill:
#   SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL  → the scratch project
#   SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY → the scratch project's keys
#   STRIPE_SECRET_KEY, RESEND_API_KEY, TWILIO_*  → leave EMPTY
#   CRON_SECRET → leave EMPTY
pnpm dev
```

**Leave every Stripe, Resend and Twilio key empty, and leave `CRON_SECRET` empty.** The
portal degrades honestly without them (see [`INCIDENT.md`](INCIDENT.md) §2), and a drill
that emails real clients or charges a real card is worse than no drill. Confirm at
**Portal → Settings → Integrations** that they read `missing` before you click anything else.

Sign in. Open Clients, Invoices, Jobs, and one client's invoice. Record whether the data
looks right, not just whether the pages render.

## 4 · Verify — this is the whole point

### 4a · Row counts, RLS policies, invoice sequence

```bash
cd app
node scripts/verify-restore.mjs "$SCRATCH_CONNECTION_STRING" | tee /tmp/after.txt
diff /tmp/before.txt /tmp/after.txt
```

The script prints exactly three checks and exits non-zero if any fails: table counts across
the 20 tables, RLS enabled plus policy count per table, and the invoice sequence state
against the highest invoice number actually issued.

| Check | Expected | Result |
| :--- | :--- | :--- |
| Table counts match production | every table within the data-loss window | |
| Any table unexpectedly empty | none | |
| RLS enabled on all 20 tables | yes | |
| Policies present | `intake_gate` and `stripe_events` are service-role-only and correctly have none; every other table has at least one | |
| Invoice sequence ahead of the highest issued number | yes | |

**A restore that loses RLS policies is a data breach, not a recovery.** If the RLS check
fails, stop and treat it as the finding of the drill.

### 4b · The schema still satisfies its own tests

```bash
cd app
TEST_DATABASE_URL="$SCRATCH_CONNECTION_STRING" pnpm exec vitest run tests/db
```

`tests/db/rls.test.ts` proves a client cannot read another client's invoice;
`tests/db/invoices.test.ts` proves concurrent minting never collides and that a replayed
Stripe event is a no-op. Run them against the **restored** database, not a fresh one.

> These tests insert rows. That is fine on a scratch project and is why step 2 uses one.
> Never point `TEST_DATABASE_URL` at production — `pnpm test:db` runs
> `scripts/reset-test-db.mjs`, which **drops and recreates the database**. Use
> `pnpm exec vitest run tests/db` directly, as above, so nothing is dropped.

| Check | Result |
| :--- | :--- |
| `tests/db/rls.test.ts` | |
| `tests/db/invoices.test.ts` | |

### 4c · The invoice sequence does not reissue a used number

The sequence is `public.invoice_number_seq`; numbers are minted as `FPS-YYYY-####` by
`public.next_invoice_number()` on insert. A restored database whose sequence is behind the
highest issued number will hand out a number a client has already been invoiced for.

```sql
SELECT last_value, is_called FROM public.invoice_number_seq;
SELECT max(invoice_number) FROM public.invoices;
```

Check 3 of `verify-restore.mjs` compares these for you. If it fails, the fix is
`SELECT setval('public.invoice_number_seq', <highest issued>, true);` — record that you had
to do it, because it means every restore needs that step and it belongs in `INCIDENT.md`.

| Check | Result |
| :--- | :--- |
| `last_value` | |
| Highest issued invoice number | |
| Sequence would reissue a used number? | |

## 5 · Delete the scratch project

Supabase → `fused-restore-drill` → **Project Settings → General → Delete project**. Do this
the same day: it is a full copy of every client record the business holds, and an
unsupervised copy of the database is its own incident. Delete `.env.drill` too.

| | |
| :--- | :--- |
| Scratch project deleted on | |
| `.env.drill` deleted | |

## 6 · Record the result

**Fill this in the day you run it. Leave it blank if you did not run it.**

| | |
| :--- | :--- |
| **Date run** | |
| **Run by** | |
| Supabase plan at the time | |
| Backup cadence | |
| PITR window | |
| Backup (or PITR timestamp) restored from | |
| **Elapsed: start → restore complete** | |
| **Elapsed: start → verified working** | |
| **Data-loss window observed** (newest production row missing from the restore) | |
| Row counts matched? | |
| RLS policies present? | |
| `pnpm exec vitest run tests/db` green? | |
| Invoice sequence intact? | |
| **Anything that did not come back** | |
| **Verdict** | |

### Findings and follow-ups

Anything that did not come back cleanly goes here, with what was done about it. A finding
that is fixable in code gets a follow-up spec proposed in the pull request — see
[`specs/README.md`](../specs/README.md).

| # | Finding | Fixable in code? | Follow-up |
| :--- | :--- | :--- | :--- |
| | | | |

### Things to watch for, from reading the schema

Not findings — these are the places this database is most likely to come back wrong, so
look at them deliberately rather than waiting to be surprised:

- **`public.invoice_number_seq`.** Sequence values are not transactional; a restore can land
  the sequence behind the invoices table. §4c.
- **RLS policies and `SECURITY DEFINER` helpers.** The policy graph depends on helper
  functions with `SET search_path = ''`. A restore that brings back tables but not policies
  looks completely healthy in the portal — the service-role client bypasses RLS — and is
  wide open to any client session. Only §4a and `tests/db/rls.test.ts` will tell you.
- **`auth.users`.** Sign-in identities live in Supabase's `auth` schema, not `public`. If the
  restore does not carry `auth` across, every staff and client account is gone even though
  `public.profiles` and `public.clients` are intact. Sign in during step 3 to find out.
- **`stripe_events`.** This table is what makes a replayed Stripe event a no-op. Restored
  empty, a replay double-counts a payment. Check its count specifically.
- **`notifications`.** The dedupe keys here are what stop the scheduler resending. Restored
  empty, the next hourly tick can re-send overdue reminders and review requests to real
  clients. Worth knowing before you point a real deployment at a restored database.
