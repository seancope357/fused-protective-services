# SPEC-017 — The marketing site serves only public files
**Gate:** E (security hygiene) · **Surface:** marketing site deploy · **Size:** S · **Depends on:** —
**Human blocker:** none

## Why

On 2026-11-26, production returned **200 with the real file contents** for `/PROGRESS.md`,
`/docs/RUNBOOK.md`, `/context/business.md`, `/build.mjs` and `/specs/README.md`. The static
project's Root Directory is the repository root, and Vercel serves every file it uploads.
The only `.vercelignore` was local to the build Mac (listed in `.git/info/exclude`), so Git
deploys uploaded the whole repository: the runbook, the business context, the open-questions
list, the migrations and the portal's source.

## Scope

**In**
- A committed, allowlist-style root `.vercelignore`: `/*`, then `!` entries for the public
  surface only.
- A committed `app/.vercelignore`, so the portal project never falls back to the root
  allowlist.
- `tests/public-surface.test.mjs`, which evaluates the committed rules against `git ls-files`.

**Out of scope**
- Making the GitHub repository private. That is Sean's decision, and the repo stays public
  until he makes it.
- CSP, HSTS and any change to `vercel.json`.
- Moving the site into a build output directory, which would change the committed-output
  layout for every page.

## Design

Vercel documents an allowlist form: start with `/*`, and every following line starts with
`!` ([docs](https://vercel.com/docs/deployments/vercel-ignore#allowlist)). The public
surface is:

| Path | Why it uploads |
|:--|:--|
| `*.html`, `vercel.json`, `robots.txt`, `sitemap.xml`, `llms.txt` | Generated pages and deploy config |
| `css/`, `js/`, `assets/` | Front-end runtime. `assets/aerial/PROVENANCE.md` is linked from `/aerial` |
| `api/` | Serverless functions |
| `src/data/`, `src/lib/` | `api/intake.mjs` imports `src/data/site.mjs` (and through it `src/lib/html.mjs`) at runtime |

**Accepted trade-off.** `src/data/*.mjs` and `src/lib/html.mjs` are readable as raw files.
They hold the same business facts the rendered pages show. `src/templates/` and
`src/styles/` stay out.

**Monorepo precedence.** Vercel uses a project's own `.vercelignore` in preference to the
root one ([docs](https://vercel.com/docs/deployments/vercel-ignore#monorepos)). Without
`app/.vercelignore`, the portal (Root Directory `app`, "include source files outside the
root directory" on) would inherit `/*` and lose its build inputs. The portal file excludes
only env files, logs, `node_modules` and `.next`, which matches what the portal uploads today.

## Acceptance

1. `node --test tests/public-surface.test.mjs` passes: no tracked internal path uploads, and
   every page, asset, function and api-imported module does.
2. The `ignore` package, the gitignore implementation Vercel's tooling uses, produces the same
   upload set. This was checked in scratch on 2026-11-26 and is recorded in the PR body.
3. Both PR preview deployments (static and portal) build.
4. **After merge:** `curl` of `/PROGRESS.md`, `/docs/RUNBOOK.md`, `/context/business.md`,
   `/build.mjs` and `/specs/README.md` returns 404. `/`, `/careers`, `/aerial` and
   `/assets/aerial/PROVENANCE.md` return 200. A real `POST /api/intake` is not sent;
   `OPTIONS /api/intake` answering is enough to prove the function deployed.

## Test plan

- Unit: the matcher self-test, then the four surface assertions against `git ls-files`.
- Cross-check: the `ignore` package over the same file list. It runs in scratch and is not a
  repo dependency (invariant 2).
- Deploy: preview builds for both projects, then the post-merge `curl` probes.

## Files

- `.vercelignore` (new, committed; replaces the local-only file)
- `app/.vercelignore` (new)
- `tests/public-surface.test.mjs` (new)
- `.git/info/exclude` (local: `/.vercelignore` line removed; the board lines stay)

## Open decisions

- **Mechanism: settled.** An allowlist `.vercelignore` rather than a build output directory.
  It keeps `node build.mjs --check` byte-stable and `api/` deploying unchanged.
- **Repository visibility:** for Sean.
