# WORKSHEET: the spec-driven pass, in order

Created 2026-11-26. **The sequence is proposed and awaits Sean's sign-off.** Run it with
[`PASS-PROMPT.md`](PASS-PROMPT.md). Each loop takes the first row that is `ready`, has every
dependency `done`, and is not a human gate. Under `pr-only`, a dependency counts as satisfied once its PR is green, and the new branch is cut from that PR's branch. Under `merge-on-green`, it counts once merged.

**The greater goal.** Fused is launched, and Cameron can take a lead through to a paid invoice
on the portal without Sean. Every step below either shortens that path or removes live risk.
Anything that does neither is out of scope for this pass.

**Ground truth when this was written (2026-11-26).** The site is live on
`fusedprotectiveservices.com`. The release gate passes, `tests/*.test.mjs` passes 148/148, and
`main` CI is green. Production still serves internal files (`/PROGRESS.md`,
`/docs/RUNBOOK.md`, `/context/business.md`, `/build.mjs` all return 200 with their contents).
The repo is public. There are 19 uncommitted aerial files on `main`. PR #12 conflicts with
`main` and mixes unrelated CSS changes into it. The portal cron runs daily (`0 13 * * *`),
not hourly.

## Authorization

The agent fills in nothing here. **Sean** sets this line, and the loop obeys it.

```
STANDING_AUTH: pr-only            # set by Sean's "Build now", 2026-11-26
# pr-only        → branch, commit and push the branch, open a PR, stop at CI green. (default)
# merge-on-green → may also squash-merge its own PR to main once CI is green on every job.
# none           → local branch and commits only; no push.
```

Whatever this line says, the loop never does any of the following: deploy by hand, run SQL
against production, change Vercel or Supabase settings, rotate secrets, contact Cameron, or
merge a PR it did not open.

## Status

| # | Step | Size | Owner | Depends | Status |
|:--|:--|:--|:--|:--|:--|
| W0 | Clean `main`: move the aerial work onto its own branch | XS | build, Sean authorizes | — | done: `feat/aerial-estate-refinement` @ `4cf24a9` (pushed, no PR) |
| W1 | SPEC-017: serve only public files | S | build | W0 | in review: PR #15, CI green, preview verified; merge is Sean's |
| W2 | Doc sync: GO_LIVE, specs README, progress tracker | XS | build | W1 | in review: PR (docs/w2-doc-sync) |
| W3 | SPEC-004 re-cut: health checks plus a daily-tick dead-man's switch | M | build | W1 | ready |
| W4 | SPEC-018: claims guardrail and an honest emergency confirmation | S | build | W1 | ready |
| W5 | SPEC-013 resume: emergency lead reaches a phone via Telegram ($0) | M | build | W3 | ready |
| **G1** | **F1 dry run on production: lead → quote → proposal → job → invoice → paid → review** | — | **Cameron and Sean** | W3, W5 | human gate |
| W6 | Response-time measurement (OPERATIONS-PLAN item 5) | S | build | W2 | ready |
| W7 | Job margin (OPERATIONS-PLAN item 4) | S | build | W2 | ready |
| W8 | SPEC-014: finish the officer roster, assignment and coverage (rebase the local branch) | L | build | G1 | blocked |
| W9 | SPEC-015: DPS licence expiry alerts and assignment guard | S | build | W8 | blocked |

When G1 runs, the loop inserts one row per defect it surfaces, directly after G1, as
`W-F1-n`. Those rows go ahead of W6.

**Parked, so do not pick these up.** SPEC-005 (analytics) and SPEC-009 (performance budget)
are cut from launch. SPEC-016 (owner-editable licence; the local branch exists and is never
pushed) waits for Sean's decision between landing and deleting. No more aerial or visual
polish. No clock-in, payroll, incidents or checkpoints. Nothing owned by Cameron: legal text,
tax, Stripe, Twilio, consents.

---

## Steps

Every step inherits the invariants and the definition of done in
[`README.md`](README.md). Each step is one branch and one PR. A new spec file uses the same
sections as SPEC-015: Why, Scope, Design, Acceptance, Test plan, Files, Open decisions.

### W0 · Clean `main`

**Why.** Every branch cut from a dirty `main` inherits 19 unreviewed files.
**Acceptance.** `git status --porcelain` on `main` is empty. The aerial work lives on
`feat/aerial-estate-refinement` as one commit, and `node build.mjs --check` passes on that
branch. Nothing is lost: `git diff main feat/aerial-estate-refinement --stat` shows the same
19 files.

> **Prompt.** Create `feat/aerial-estate-refinement` from `main` and commit exactly the 19
> currently-modified files as `feat(aerial): Hill Country estate refinement (2026-11-23)`.
> Before committing, run `node build.mjs --check` and `node --test tests/*.test.mjs`. Switch
> back to `main` and confirm it is clean. Do not push unless STANDING_AUTH allows it. Do not
> open a PR; real-device review is Sean's step. Record the branch name in the progress
> tracker.

### W1 · SPEC-017: serve only public files

**Why.** Production serves the runbook, the business context, the progress log and the build
script. `.vercelignore` exists only on the build Mac (`.git/info/exclude`), so Git deploys
upload the whole repository root.
**Acceptance.**
1. The only paths that resolve are the generated pages, `css/`, `js/`, `assets/`, `api/`,
   `robots.txt`, `sitemap.xml`, `llms.txt` and the favicon and OG assets. Every other path
   returns 404.
2. The mechanism is committed, is generated or verified by `build.mjs`, and is
   deterministic.
3. A `node --test` test fails if any of these could be served: `PROGRESS.md`, `README.md`,
   `PROJECT_CONTEXT.md`, `build.mjs`, `serve.py`, `docs/`, `context/`, `specs/`, `supabase/`,
   `app/`, `tests/`, `scripts/`, `prototypes/`, `output/`, `advisory-board/`, `.github/`.
4. The CSP and HSTS headers in `vercel.json` are unchanged, unless the spec records why.
5. After deploy, `curl` of each path in item 3 returns 404 and `/`, `/careers` and `/aerial`
   return 200. This is post-merge verification and it goes in the PR body.

> **Prompt.** Write `specs/SPEC-017-public-surface.md`, then implement it. First decide
> between two mechanisms and record the choice under *Open decisions*: a committed
> allowlist-style `.vercelignore` (deny everything, then re-include) or a `build.mjs`
> output directory plus `outputDirectory` in `vercel.json`. Prefer whichever keeps
> `build.mjs --check` byte-stable and leaves `api/` deploying. Check Vercel's documented
> behaviour with Serverless Functions; do not guess it. Test-first: write the failing test,
> then the fix. Keep the existing local-only `.vercelignore` entries covered, and remove
> `/.vercelignore` from `.git/info/exclude` only if the committed file replaces it.

### W2 · Doc sync

**Why.** Agents plan from `docs/GO_LIVE.md` and `specs/README.md`, and both are stale. C1
(domain), the Resend items, A1/A2 (licence, phone) and A6 (dispatch@) are done in fact but
still unticked.
**Acceptance.** Every box ticked carries a dated evidence line (a command and its result). The
`specs/README.md` status table lists 016, 017 and 018 and this worksheet.
`context/progress-tracker.md` names the current unit. Docs only, with no code in the diff.

> **Prompt.** Reconcile `docs/GO_LIVE.md`, `docs/OPEN_QUESTIONS.md`, `specs/README.md`
> and `context/progress-tracker.md` against live evidence. For each item you would tick, run
> the read-only probe (`curl`, `dig`, `gh`, `git log`) and quote its result. Untick nothing
> without evidence. Do not mark anything done that only a human can confirm, such as
> attorney review or Stripe live mode.

### W3 · SPEC-004 re-cut

**Why.** PR #12 conflicts with `main` and bundles a CTA sheen and a mobile CSS pass.
SPEC-004's thresholds (alert at 2 h, red at 3 h) assume an hourly cron. The cron now runs
daily at 13:00 UTC, so the switch as written would fire every day.
**Acceptance.** Every SPEC-004 criterion is met, with thresholds derived from the cron
schedule, not hard-coded. For example: alert after 26 h without a tick, red after 50 h. One
constant is shared with `TICK_HOURS`, and a test fails if the two disagree. The PR contains
no CSS or hero changes. PR #12 is closed with a link to the new PR.

> **Prompt.** Amend `specs/SPEC-004-health-and-heartbeat.md` for the daily tick, and record
> the amendment in the spec. Branch `feat/spec-004-recut` from `main`. Port only the SPEC-004
> commit and the SPEC-003 acceptance-7 test commit from
> `origin/claude/go-live-readiness-fvpa4t` (cherry-pick, then resolve). Leave out `feat(hero)`
> and `style: a mobile pass`. Run the portal gates on Node 22:
> `PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"`. Close #12 only after the new PR is
> green, and only if STANDING_AUTH is not `none`.

### W4 · SPEC-018: claims guardrail and an honest emergency confirmation

**Why.** The live site makes operational claims nobody has verified: "zero breach points", an
AES-256 radio net, GPS/NFC checkpoints and under-45-minute armed dispatch. An emergency inquiry
currently reaches an email inbox only. These are legal and safety exposure, not style.
**Acceptance.**
1. Each operational claim in `src/data/` carries `verified: true|false` and a `source` note.
2. An unverified claim renders flagged on preview hosts, as the placeholder guardrail does,
   and fails `node build.mjs --verify-release`.
3. "Zero breach points" is removed outright.
4. The emergency confirmation and the immediate-threat result show 911 for danger now, plus
   the dispatch line, ahead of any quote language.
5. A test proves "Immediate Known Threat" routes to emergency.

The agent never decides a claim is true. Every claim starts `verified: false`, apart from any
that Sean or Cameron has confirmed in writing in `docs/OPEN_QUESTIONS.md`.

> **Prompt.** Extend the SPEC-001 placeholder guardrail rather than building a second
> mechanism. Inventory the claims with `grep` across `src/data/*.mjs` and list them in the
> spec. Add a new `OPEN_QUESTIONS.md` section, "Claims Cameron must confirm", with one line
> per claim. Do not reword marketing copy beyond deleting "zero breach points" and adding the
> 911 line.
> **Warning:** this turns the release gate red until Cameron confirms the claims, or until
> unconfirmed copy is removed. Say so in the PR body. Removing the copy is Sean's decision.

### W5 · SPEC-013 resume: emergency alerts over Telegram

**Why.** Twilio costs money and the budget is $0. Without this, an emergency lead pages nobody.
**Acceptance.** These are SPEC-013's criteria, plus the following.
1. The alert fires at intake time from `api/intake.mjs` or its portal equivalent, not from
   the daily cron.
2. A missing bot token or chat id is a reported skip (`no_telegram_recipient`), never a
   silent success.
3. Message text contains no PII beyond what the spec allows.
4. Typecheck, tests and a test proving an emergency division triggers the push.

> **Prompt.** Rebase `feat/telegram-owner-alerts` onto `main` into a fresh
> `feat/spec-013-telegram`. Read the spec's *Where it stopped* first and finish the wiring.
> Use native `fetch` through `api/_lib/` (no SDK). Creating the bot and getting Cameron's chat
> id are human steps: list them in the PR body and `docs/RUNBOOK.md`, and do not perform
> them.

### G1 · F1 dry run (human gate)

The loop stops here. It writes `docs/F1-DRY-RUN.md`, a checklist Cameron can follow on his
phone, and prints the gate to Sean. When Sean reports the result, the loop records each
failure as a `W-F1-n` row and resumes.

### W6 · Response-time measurement

**Why.** The site promises response windows, and `first_response_at` is written but never
reported.
**Acceptance.** Portal Today shows the median and the worst time to first response over the
last 30 days, using production rows only (`source_env`). An empty state says "no leads yet".
Tests cover the empty, single and many cases.

> **Prompt.** Read `docs/OPERATIONS-PLAN.md` item 5, write
> `specs/SPEC-019-response-time.md`, then build it. Pure function in `app/src/lib/domain/`,
> tested without a database or clock, plus one query. No migration unless the spec proves one
> is needed.

### W7 · Job margin

**Why.** Cameron cannot see whether bill rate minus pay rate is positive per job.
**Acceptance.** Each job shows its billed amount, its labour cost and its margin, computed
server-side. A missing pay rate shows as "unknown", not as $0. Tests cover that.

> **Prompt.** Read `docs/OPERATIONS-PLAN.md` item 4, write `specs/SPEC-020-job-margin.md`,
> then build it. Money is server-authoritative, so follow the existing invoice maths and do
> not duplicate it.

### W8 · SPEC-014: finish the roster

> **Prompt.** Rebase local `feat/spec-014-officers-coverage` (commit `2079c74`, never pushed)
> onto `main`. Finish what its commit message lists as **STILL TO DO**: assign/unassign and
> assigned/required counts on `/portal/jobs/[id]`, a coverage column on the jobs list, seed
> data, and `app/tests/db` RLS coverage. Apply anything G1 taught about real shifts. The
> migration is additive. Do not apply it to production.

### W9 · SPEC-015: licence expiry

> **Prompt.** Build `specs/SPEC-015-license-expiry.md` on top of W8. Whether an expired
> licence blocks an assignment or only warns is the spec's open decision. If the spec does
> not settle it, stop and ask Sean; do not decide it. Licensing law is **for counsel**.
