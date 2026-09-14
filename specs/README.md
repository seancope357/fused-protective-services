# SPECS — the buildable half of go-live

[`docs/GO_LIVE.md`](../docs/GO_LIVE.md) lists everything that must be true before launch.
About half of it is accounts, DNS, licence numbers and attorney review — no agent can do
those. **This directory is the other half: the engineering work, specified well enough
that an agent can pick one up cold and build it.**

Each spec is one branch and one pull request. Take the lowest-numbered `Ready` spec that
has nothing unbuilt in its `Depends on` line.

---

## Status

| # | Spec | Gate | Size | Depends on | Status |
| :-- | :--- | :--- | :--- | :--- | :--- |
| [001](SPEC-001-placeholder-guardrail.md) | Fail-closed placeholder guardrail | A1 | S | — | ✅ **Done** |
| [002](SPEC-002-environment-separation.md) | Preview must not touch production | C3, C4 | M | — | ✅ **Done** (code; branch is Sean's) |
| [003](SPEC-003-error-reporting.md) | Error reporting and alerting | D1 | M | 002 | ✅ **Done** (2 criteria untested — GO_LIVE D1b) |
| [004](SPEC-004-health-and-heartbeat.md) | Health checks + cron dead-man's switch | D2 | M | 003 | **Ready** |
| [005](SPEC-005-conversion-analytics.md) | Cookieless conversion analytics | D3 | M | 002 | ⏸ **Recommended cut from launch** |
| [006](SPEC-006-marketing-site-csp.md) | CSP + HSTS for the marketing site | E1 | M | — | ✅ **Done** (Chromium swept; FF/Safari at first deploy) |
| [007](SPEC-007-brand-assets.md) | Favicon, OG card, page weight | E2 | S | — | ✅ **Done** (−960 KB) |
| [008](SPEC-008-accessibility-gate.md) | Accessibility conformance gate in CI | E4 | M | — | ◐ **Audited**, gate staged; fixes in wave 3 |
| [009](SPEC-009-performance-budget.md) | Performance budget for the intro | E3 | M | 006, 007 | ⏸ **Recommended cut from launch** |
| [010](SPEC-010-candidate-ats.md) | Candidate ATS in the portal | F3 | L | 002 | ✅ **Done** (emails wait on B1) |
| [011](SPEC-011-incident-and-restore.md) | Incident, rollback and restore drill | D4, D8 | S | — | ◐ **Docs done**, drill unrun (Sean) |
| [012](SPEC-012-portal-mobile-first.md) | Portal mobile-first, ready for Cameron | F1 | L | — | ✅ **Done** on `feat/portal-mobile-first` (Cameron's first sign-in proves criterion 8) |

**Status as of 2026-09-14.** Seven of eleven are done: 001, 002, 003, 006, 007, 010, 011,
plus 008 audited with its gate staged pending two brand-token decisions. **004** (uptime +
cron dead-man's switch) is the one genuinely unbuilt spec that still matters for launch —
its dependency, 003, has now landed. **005** and **009** are recommended cut from launch
scope: analytics tells you how launch went and a perf budget prevents future regression;
neither is a precondition for launching, and each adds surface area on day one.

What actually blocks launch now is not in this directory — it is Twilio 10DLC registration,
attorney review, and DNS → Resend. See [`docs/GO_LIVE.md`](../docs/GO_LIVE.md).

## Not buildable here

Do not open a spec for these — they are accounts, facts or signatures, tracked in
[`docs/OPEN_QUESTIONS.md`](../docs/OPEN_QUESTIONS.md): the DPS licence number, the dispatch
phone line, attorney review, cancellation and liability terms, sales-tax confirmation,
Resend/Twilio/Stripe accounts, DNS, Google Business Profile, and Cameron's dry run.
Several specs below *prepare* for one of those; none can complete one.

---

## Invariants every spec inherits

These are not restated in each spec. Breaking one fails review no matter how good the
feature is. Sources: [`context/code-standards.md`](../context/code-standards.md),
[`context/index.md`](../context/index.md), and the two skills in `.agents/skills/`.

1. **Generated files are never hand-edited.** `index.html`, `careers.html`, `invoice.html`,
   `privacy.html`, `terms.html`, `sms-consent.html`, `css/site.css`, `css/invoice.css`.
   Change `src/`, run `node build.mjs`, commit source and regenerated output together.
2. **The repository root has no `package.json` and never will.** No npm dependency may be
   added to the static site or to `api/`. CI steps may use `npx` with a pinned version;
   that adds nothing a contributor must install. `app/` is a separate workspace and may
   use SDKs.
3. **`api/` uses native `fetch` through the transports in `api/_lib/`.** No vendor SDKs.
   One default export per file. Every handler starts with `if (!cors(req, res)) return;`.
4. **No mock data and no fake success.** A missing key is a reported state: `503` with a
   stable `error` code and a plain-language `message`. Never claim a send that did not
   happen.
5. **Business facts come from `src/data/`.** Never restate a phone number, rate, division
   name or URL in a template, a script or a portal module. The portal reads the same files
   through `app/shared/` (`scripts/sync-shared.mjs`).
6. **Escaped by default.** Interpolate through the `html` tagged template from
   `src/lib/html.mjs`; `raw()` only on markup this repository generated.
7. **CSS is layered and explicitly ordered.** `@layer tokens, base, layout, components,
   utilities`. New component styles go in `src/styles/components/`, are registered in
   `STYLE_ORDER` in `build.mjs`, and stay under 300 lines.
8. **Builds are deterministic.** Never read the clock, the environment or the network at
   build time. `node build.mjs --check` must pass on any machine on any date.
9. **Migrations are additive and forward-only.** New file in `supabase/migrations/`,
   `YYYYMMDDHHMMSS_name.sql`, `IF NOT EXISTS` throughout, RLS on every new table, and
   cross-table policies through `SECURITY DEFINER` helpers so the policy graph stays
   acyclic. Never edit an applied migration.
10. **Every new behaviour gets a test.** `tests/*.test.mjs` (`node --test`, `fetch`
    stubbed) for the static side; `app/tests/` (vitest) for the portal; `app/tests/db/`
    for anything with an RLS or SQL consequence.

## Definition of done

A spec is done when all of this is true — not when the code works locally.

- [ ] Every acceptance criterion in the spec is met.
- [ ] `node build.mjs --check` — clean.
- [ ] `node --test 'tests/*.test.mjs'` — green.
- [ ] `cd app && pnpm typecheck && pnpm test && pnpm build` — green (portal specs).
- [ ] `cd app && pnpm test:db` — green (any spec with a migration).
- [ ] CI green on the PR, both jobs.
- [ ] Docs updated where the change alters a documented procedure: `docs/RUNBOOK.md` for a
      new env var or setup step, `docs/GO_LIVE.md` to tick the gate, `PROGRESS.md` for the
      milestone, `context/` when an invariant or seam changed.
- [ ] Any new environment variable is added to the RUNBOOK §9 index with its project and
      what breaks without it — and the code degrades honestly when it is absent.
- [ ] The PR body says which spec it implements and what was deliberately left out.

## Working agreement

- **One branch per spec:** `feat/spec-00X-short-slug`, based on `main`.
- **Do not widen the scope.** Everything a spec lists under *Out of scope* stays out; if
  you find something that belongs in another spec, note it in the PR, don't fix it.
- **Unresolved decision → stop and ask.** Each spec has an *Open decisions* section with a
  recommendation. If the recommendation is wrong for a reason you discovered while
  building, say so in the PR rather than silently choosing differently.
- **If a spec turns out to be wrong, amend the spec in the same PR.** A spec that no longer
  matches the code is worse than no spec.

## Spec template

```markdown
# SPEC-0NN — Title
**Gate:** GO_LIVE.md → X1 · **Surface:** static site | portal | both | infra
**Size:** S/M/L · **Depends on:** — · **Human blocker:** —

## Why            the problem in the code today, with evidence
## Scope          In / Out — the Out list is binding
## Design         the approach, and why this one
## Acceptance     numbered, each independently checkable
## Test plan      what proves it, at which layer
## Files          expected to change
## Open decisions each with a recommendation
```
