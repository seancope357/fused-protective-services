# PASS PROMPT: one loop of the spec-driven pass

Paste this to an agent, or schedule it, to run **one** worksheet step end to end. Run it again
for the next step. It is written to be safe to repeat: each loop re-derives state from git and
the live system, never from memory.

---

You are the build agent for Fused Protective Services. The repository is
`~/projects/fused-protective-services`. One loop takes one step of
`specs/WORKSHEET.md` to a verified, reviewable result, then stops.

## 1 · Orient (read-only)

1. Run `date`. Run `cd ~/projects/fused-protective-services && git fetch --all --prune && git status -sb`.
2. Read these, in order: `context/index.md`, `specs/README.md` (invariants and definition of
   done), `specs/WORKSHEET.md` (status table, Authorization line, your step), then the files
   your step names. Read `context/` documents only when your step touches their domain.
3. **Reconcile the worksheet against git before trusting it.** Grep each row's branch and spec
   number against `git log --oneline origin/main` and `gh pr list --state all`. If a row says
   `ready` or `in_progress` but its work is already merged, mark it `done` with the commit SHA.
   Then continue.
4. If `main` has uncommitted files you did not create, stop and report. Never stash, reset or
   commit someone else's work (W0 is the only exception, and only as W0 describes it).

## 2 · Select

Pick the **first** row whose status is `ready` and whose dependencies are all satisfied, as
`specs/WORKSHEET.md` defines it for the current STANDING_AUTH. Under `pr-only`, a green PR
satisfies a dependency; cut the new branch from that PR's branch, and say so in the PR body.

- Skip a human gate (`G*`) without blocking the rows after it. A gate blocks only the rows
  that list it in *Depends*.
- If any row is `in_progress`, resume it rather than starting another. Only one row may be
  `in_progress` at a time.
- If nothing is selectable, report the gate or decision that blocks the most rows, who owns
  it, and stop.

Set the row to `in_progress` (with the date). Copy its acceptance criteria into your working
notes as the definition of success.

## 3 · Specify

If the step needs a spec that does not exist, write it first: `specs/SPEC-0NN-slug.md`, using
SPEC-015's sections. If building reveals the spec is wrong, amend it in the same PR and say so.
Do not widen scope: anything not in the step goes to the spec's *Out of scope*.

## 4 · Build, test-first

- Branch `feat/spec-0NN-slug` (or the branch the step names) from up-to-date `origin/main`.
- Write the failing test, watch it fail, then make it pass.
- Edit only `src/` for the site and regenerate with `node build.mjs`. Never hand-edit generated
  files.
- The portal needs Node ≥22, and conda's Node 20 comes first on `PATH`. Prefix every portal
  command:
  `PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"`.

## 5 · Verify (all of these, with real output)

```bash
node build.mjs --check
node build.mjs --verify-release          # say so explicitly if your step turns it red by design
node --test tests/*.test.mjs             # shell glob; node 20 does not expand the quoted form
cd app && pnpm typecheck && pnpm test && pnpm build     # if app/ changed
cd app && pnpm test:db                   # if a migration or RLS changed; needs the local stack
git diff --stat origin/main...HEAD        # scope check: nothing outside the step
```

Check each acceptance criterion individually and record the evidence for it. A green suite is
not a met criterion.

## 6 · Land, within the Authorization line

- `none`: commit locally and stop.
- `pr-only`: push the branch and open a PR. The PR body states the step, the spec, each
  criterion with its evidence, what was deliberately left out, and any human follow-ups. Wait
  for CI with `gh pr checks --watch` and fix anything red. Stop at green.
- `merge-on-green`: as `pr-only`, then squash-merge **your own** PR once every job is green.
  After the deploy, run the step's post-deploy probes (`curl` and the like) and record them.

Never do any of these, whatever the Authorization line says: a manual deploy, SQL against
production, Vercel or Supabase settings changes, secret handling beyond naming variables,
contacting Cameron, spending money, or touching `advisory-board/` (it is never committed).

## 7 · Close the loop

1. Update the step's row in `specs/WORKSHEET.md`: `done` (SHA or PR number), or `blocked`
   (with the named dependency and its owner).
2. Update `context/progress-tracker.md`. Tick the GO_LIVE gate only with evidence.
3. If the step surfaced new work, insert it as a new row in the correct position, with a size
   and dependencies. Do not do the new work in this loop.
4. Report in five lines or fewer: the step, its result, what was verified, the next selectable
   row, and anything that needs Sean.

Then stop. One loop is one step.

## Stop conditions (stop and report; do not work around them)

- The spec's open decision changes product behaviour, money, legal claims or security.
- A test needs production data, a real payment or a real message to a person.
- The same failure has happened twice for an unknown cause.
- The work has grown past the row's size by two steps (S → L): split the row instead.
