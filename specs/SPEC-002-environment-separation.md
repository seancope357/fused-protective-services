# SPEC-002 — Preview deploys must not touch production
**Gate:** GO_LIVE.md → C3, C4 · **Surface:** static site + portal + infra
**Size:** M · **Depends on:** — · **Human blocker:** the Supabase branch (Sean, dashboard)

## Why

The Supabase variables are injected by the Vercel Marketplace integration into **every**
environment (`docs/RUNBOOK.md` §1). Both Vercel projects build a preview for every pull
request. So today:

- a form submission on any preview URL writes a real row to `client_quotes`;
- it lands in Cameron's Leads inbox as a real lead;
- the scheduler's 2-hour unanswered-lead rule will page about it;
- anyone with a preview link can read production data through the portal preview.

This already happened on PR #10: two previews deployed, both pointed at the production
project. The failure mode is not hypothetical and it gets worse the moment alerts are
switched on (Gate B).

## Scope

**In**
- A single source of truth for "which environment am I?" on both surfaces.
- Row-level provenance so non-production writes are identifiable and filterable.
- Suppression of every outbound side effect (email, SMS, webhook) outside production.
- A loud, visible marker on any non-production portal page.
- The documented dashboard procedure for the Supabase branch.

**Out**
- Creating the Supabase branch or setting the variables (Sean, in dashboards).
- Any change to production data.
- Reworking the Marketplace integration.

## Design

**1 · One environment module per surface.** `api/_lib/env.mjs` (zero-dep) and
`app/src/lib/env.ts`, both deriving from `VERCEL_ENV` (`production` | `preview` |
`development`, absent locally → `development`). Export `deployEnv()` and
`isProduction()`. Nothing else reads `process.env.VERCEL_ENV` directly.

**2 · Provenance, not prevention.** Additive migration adds `source_env TEXT NOT NULL
DEFAULT 'production'` to `client_quotes` and `candidate_applications`, plus an index on
`(source_env, created_at DESC)`. `api/intake.mjs` writes `deployEnv()` into it.

Defence in depth rather than a hard refusal: a preview that cannot write is a preview
nobody can test intake on. A preview whose writes are *labelled* is testable and harmless.

**3 · Side effects are production-only.** In `api/intake.mjs`, when `!isProduction()`:
owner email, emergency SMS, visitor confirmation and the webhook are all skipped and
reported in the existing per-stage `delivery` object with reason `non_production_env` —
using the same honest-reporting shape the handler already has, never a fake success. The
Supabase write still happens, labelled. Same rule in the portal's notification engine
(`app/src/lib/notifications/engine.ts`): log the attempt with the skip reason, send
nothing. The scheduler (`/api/cron/tick`) refuses to run outside production and returns
`{ ok: true, skipped: 'non_production_env' }`.

**4 · The portal says where it is.** A banner on every non-production page, rendered in
`app/src/app/layout.tsx`, naming the environment and the Supabase project it is pointed
at. Someone looking at a preview must never mistake it for the live portal.

**5 · Leads inbox defaults to production.** `app/src/app/portal/leads/page.tsx` and the
dashboard queries filter `source_env = 'production'` by default, with a filter control to
show the rest. Counts in `app/src/app/portal/layout.tsx` filter the same way, or the badge
will count test rows.

**6 · `productionHosts`.** SPEC-001 removes the `.vercel.app` alias. If SPEC-001 has not
landed when this one does, do it here instead and note the overlap in the PR.

**7 · The dashboard half.** Document in `docs/RUNBOOK.md` §1: create a Supabase branch for
preview, override `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`NEXT_PUBLIC_*` at the preview
scope on both projects, keep `sk_test_` Stripe keys preview-scoped. Include the
verification: submit on a preview, confirm the row lands in the branch and **not** in
production.

## Acceptance

1. `deployEnv()` returns `production` only when `VERCEL_ENV === 'production'`, on both
   surfaces.
2. Intake outside production persists the row with `source_env` set, and reports every
   delivery stage as skipped with `non_production_env`. Nothing is emailed or texted.
3. Intake in production behaves exactly as it does today, with `source_env: 'production'`.
4. `/api/cron/tick` outside production sends nothing and says so in its response.
5. The notification engine outside production logs each intended send with the skip reason
   and dispatches none.
6. Every portal page outside production shows the environment banner.
7. Leads list, dashboard and nav counts exclude non-production rows unless the filter is on.
8. The migration is additive, re-runnable, and backfills existing rows to `'production'`.
9. `docs/RUNBOOK.md` §1 documents the branch procedure and its verification.

## Test plan

- `tests/intake.test.mjs` additions: with `VERCEL_ENV=preview`, assert the response reports
  skipped stages, the stubbed `fetch` records the Supabase insert with `source_env:
  'preview'`, and **no** Resend or Twilio call was made. With `VERCEL_ENV=production`,
  assert today's behaviour is unchanged.
- `app/tests/notifications.test.ts`: engine dispatches nothing outside production, and the
  log records the intent.
- `app/tests/db/`: `source_env` defaults to `'production'`; the leads query with the
  default filter excludes a `'preview'` row.
- Manual after Sean's dashboard work: submit on a preview URL, confirm the row is in the
  branch and production is untouched.

## Files

`api/_lib/env.mjs` · `api/intake.mjs` · `app/src/lib/env.ts` ·
`app/src/lib/notifications/engine.ts` · `app/src/app/api/cron/tick/route.ts` ·
`app/src/app/layout.tsx` · `app/src/app/portal/layout.tsx` ·
`app/src/app/portal/leads/page.tsx` · `app/src/app/portal/page.tsx` ·
`app/src/lib/domain/queries.ts` · `supabase/migrations/<ts>_source_env.sql` ·
`app/src/styles/app.css` · `tests/intake.test.mjs` · `app/tests/` · `docs/RUNBOOK.md`

## Open decisions

- **Label or refuse?** *Recommended: label* (design 2). Refusing breaks the ability to test
  intake on a preview, which is the main reason previews exist. The side-effect suppression
  in design 3 is what actually protects Cameron's inbox.
- **Supabase branch or a second project?** *Recommended: branch* — it tracks the migrations
  in the repository and costs nothing extra. Sean's call; the code is identical either way.
- **Does `source_env` belong on the portal's own tables too** (quotes, jobs, invoices)?
  *Recommended: no.* Those rows are only created by an authenticated staff session; the
  banner plus a separate database is sufficient. Revisit if a preview ever creates one.
