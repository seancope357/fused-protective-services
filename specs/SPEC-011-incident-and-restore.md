# SPEC-011 — Incident response, rollback, and a proven restore
**Gate:** GO_LIVE.md → D4, D8 · **Surface:** infra + docs
**Size:** S · **Depends on:** — · **Human blocker:** the restore drill needs Supabase dashboard access (Sean)

## Why

Two things are missing that only matter on the worst day.

**No rollback procedure.** Two Vercel projects deploy from `main`. Nobody has written down
how to get back to a known-good deployment, how to stop the hourly scheduler, or what to do
when a migration has been applied by hand through the dashboard and the code that needed it
is being reverted. The person doing this will be doing it at speed, possibly at night,
possibly not the person who wrote the change.

**No proven backup.** `docs/GO_LIVE.md` D4 says it plainly: an untested backup is a
hypothesis. Nobody has confirmed what the Supabase plan actually retains, what the
point-in-time recovery window is, or whether a restore produces a working system. The
database holds every lead, client, proposal, job, invoice, payment and audit record — the
business itself, not just its data.

## Scope

**In**
- A written incident and rollback procedure.
- One rehearsed restore, with the result recorded.
- Small mechanical aids where they remove a step from the procedure.

**Out**
- Buying a plan or changing the Supabase tier (Sean).
- Automated failover or multi-region.
- Error and uptime alerting (SPEC-003, SPEC-004 — this is what happens *after* one fires).

## Design

**1 · `docs/INCIDENT.md`**, written to be followed by someone who did not write the code,
under pressure. Short, ordered, concrete, with real commands.

*First minute:* how to tell which surface is affected (health endpoints from SPEC-004),
where the logs are, and who to tell.

*Stop the bleeding:*
- **Roll back a deployment** — promote the previous production deployment in the Vercel
  dashboard for the affected project, with the exact clicks and the CLI equivalent. Name
  the projects (`fused-protective-services`, `fused-portal`) and note that they deploy
  independently, so one can be rolled back without the other.
- **Stop the scheduler** — disable the cron in `app/vercel.json` or rotate `CRON_SECRET`;
  say which is faster and what each costs.
- **Stop taking payments** — remove `STRIPE_SECRET_KEY`; the pay page already degrades
  honestly to "online payment unavailable", so this is safe and reversible.
- **Stop outbound messaging** — remove `DISPATCH_ALERT_FROM` / the Twilio variables; sends
  log as skipped rather than failing.

Each of those is a deliberate property of the existing code — the system was built to
degrade honestly — and the runbook should say so, because someone under pressure needs to
know that removing a key is a safe move rather than a further outage.

*Specific scenarios*, each with the first three steps:
- a payment taken but the invoice not marked paid (replay from the Stripe dashboard; the
  webhook deduplicates by event id, so replay is safe);
- a leaked key (rotation order, and which surface breaks first);
- a bad migration (they are additive and hand-applied, so forward-fix is almost always
  right — say so, and say what the exception looks like);
- the marketing site down but the portal fine, and the reverse;
- Supabase itself unavailable (intake returns 503 honestly; leads are lost, not corrupted
  — state that plainly so nobody invents a queue at 3am).

*Communication:* who tells Cameron, what a client is told when a detail is affected, and
that the dispatch line is the fallback channel for everything.

**2 · `docs/RESTORE-DRILL.md`** — run once, before launch, and recorded:

1. Confirm the plan's actual backup cadence and PITR window from the dashboard. Write the
   numbers down; do not assume.
2. Restore to a scratch project.
3. Point a local portal checkout at it.
4. Verify: row counts across the main tables match; `pnpm test:db` passes against it; RLS
   policies came back (a restore that loses policies is a data breach, not a recovery);
   the invoice number sequence is intact and does not reissue a used number.
5. Record elapsed time, data loss window, and anything that did not come back.
6. Delete the scratch project.

Step 4 is the whole point. "The restore completed" is not the same as "the system works".

**3 · Mechanical aids, only where they remove a step.** A `app/scripts/verify-restore.mjs`
that takes a connection string and prints table counts, policy presence and sequence state.
Nothing more — an incident script nobody has run is another thing to debug during an
incident.

**4 · Link it.** `docs/RUNBOOK.md` §8 points at both; `docs/GO_LIVE.md` D4 and D8 cite them
as their verification.

## Acceptance

1. `docs/INCIDENT.md` covers every rollback and scenario in design 1, with commands or
   exact dashboard paths — no "investigate the issue" steps.
2. Each stop-the-bleeding action names what breaks and what degrades honestly.
3. `docs/RESTORE-DRILL.md` records a drill that **was actually run**, dated, with the
   real backup cadence, PITR window, elapsed time and data-loss window.
4. The drill's verification step confirms row counts, `pnpm test:db` green against the
   restored database, RLS policies present, and the invoice sequence intact.
5. `verify-restore.mjs` runs against a connection string and prints the three checks.
6. Both documents are reachable from `docs/RUNBOOK.md` §8 and cited by `docs/GO_LIVE.md`.
7. Anything the drill found that does not come back cleanly is written down and, if it is
   fixable in code, has a follow-up spec proposed in the PR.

## Test plan

Mostly procedural — the deliverable is a rehearsed procedure, not a feature.

- `app/tests/`: a unit test over `verify-restore.mjs`'s report shape against a fixture, so
  it does not itself break unnoticed.
- The drill is the test. A restore document written without running one fails acceptance 3,
  and saying so is better than a document that reads well and has never been exercised.
- Re-read `docs/INCIDENT.md` against SPEC-003 and SPEC-004 once those land, so the alert an
  engineer receives names the runbook section that handles it.

## Files

`docs/INCIDENT.md` · `docs/RESTORE-DRILL.md` · `app/scripts/verify-restore.mjs` ·
`app/tests/verify-restore.test.ts` · `docs/RUNBOOK.md` §8 · `docs/GO_LIVE.md` D4, D8

## Open decisions

- **Who is on call?** Not an agent's decision, but the document needs a name in it. Leave a
  marked `TODO(cameron)` in the communication section rather than inventing a rota — the
  same convention `src/data/` uses for facts only Cameron can supply.
- **PITR:** if the current Supabase plan has no point-in-time recovery, say so in the drill
  document with the actual exposure in hours, and raise the upgrade as a cost question for
  Sean. Do not quietly accept a 24-hour data-loss window on a system that mints invoice
  numbers.
- **Scope of `verify-restore.mjs`:** resist growing it. Three checks that are always run
  beat twelve that are not.
