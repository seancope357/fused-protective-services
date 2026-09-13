# SPEC-001 — Fail-closed placeholder guardrail
**Gate:** GO_LIVE.md → A1 · **Surface:** static site
**Size:** S · **Depends on:** — · **Human blocker:** none to build (A1 itself waits on Cameron)

## Why

`src/data/site.mjs` carries `licenseNumber.value = 'B00000'` with `placeholder: true`. The
guardrail against shipping it is a red flag rendered beside the value — but
`js/modules/env.mjs` only reveals that flag when `window.location.hostname` is **not** in
`site.productionHosts`, and that list already contains
`fused-protective-services.vercel.app`, the current public URL:

```js
// js/modules/env.mjs
if (!hosts.includes(host)) document.documentElement.dataset.env = 'preview';
```

So on the live site today, `B00000` renders in the footer and as the schema.org
`identifier` with **no flag at all** (`index.html:54`, `index.html:1105`). The guardrail is
loudest exactly where it matters least and silent where it matters most. Tex. Occ. Code
§1702.284 requires the real number in advertising.

Two further weaknesses: the flag depends on JavaScript running at all, and `build.mjs`
only `console.warn`s, which nothing enforces.

## Scope

**In**
- Invert the flag so a placeholder is visible by default and suppressed only deliberately.
- A release gate that exits non-zero while any placeholder remains.
- Remove the `.vercel.app` alias from `productionHosts`.

**Out**
- Supplying the licence number or the phone number (Cameron; `OPEN_QUESTIONS.md` §2).
- Any change to what the placeholder looks like beyond what inversion requires.
- Making the per-push CI fail on placeholders — that would block all other work today.

## Design

**1 · Fail-closed rendering.** A placeholder flag renders whenever `placeholder: true`, on
every host, with no JavaScript involved. `src/styles/components/placeholder.css` currently
hides the flag unless `html[data-env="preview"]`; invert it to show by default. The flag is
already in the generated markup, so this is a CSS change plus removing the placeholder
branch from `js/modules/env.mjs`.

The honest consequence: while Cameron has not supplied the licence number, the live site
says so out loud. That is the intended pressure — the alternative is advertising a licence
number that is not ours.

**2 · Release gate.** Add `node build.mjs --verify-release`: runs the normal `--check`,
then exits `1` listing any field still `placeholder: true`. Deterministic, no clock, no
network. Wire it into a `release-gate` GitHub Actions job that runs **only** on
`workflow_dispatch` and on tags — never on push or PR, so today's work is not blocked.
`docs/GO_LIVE.md` gate A1 cites it as the verification step, and it becomes the thing Sean
runs immediately before the DNS cutover.

**3 · `productionHosts`.** Drop `fused-protective-services.vercel.app`. That alias is a
staging URL, not the production site; leaving it in the list is what created the hole.
Keep the apex and `www`.

## Acceptance

1. With `licenseNumber.placeholder: true`, the flag is present and visible in `index.html`
   served from any host, including one listed in `productionHosts`, with JavaScript
   disabled.
2. Setting `placeholder: false` and rebuilding removes both the flag markup and any
   reserved space — no empty gap, no layout shift.
3. `node build.mjs --verify-release` exits `1` and names every pending placeholder while
   any remains; exits `0` when none do.
4. `node build.mjs` and `node build.mjs --check` keep their current behaviour and exit
   codes, still printing the warning.
5. The `release-gate` workflow job does not run on push or pull request.
6. `productionHosts` no longer contains a `.vercel.app` host.
7. `node build.mjs --check` passes with the regenerated output committed.

## Test plan

- `tests/placeholder-gate.test.mjs` (`node --test`): spawn `node build.mjs --verify-release`
  in a temp checkout with `placeholder` true → exit 1, message names the field; with it
  false → exit 0. Assert `--check` still exits 0 in both cases.
- Assert against generated `index.html` that the flag markup is present when the fixture
  has a placeholder, and absent when it does not.
- Manual: load the built page with JavaScript disabled and confirm the flag is visible.

## Files

`src/styles/components/placeholder.css` · `js/modules/env.mjs` · `src/data/site.mjs`
(`productionHosts`) · `build.mjs` (`--verify-release`) · `.github/workflows/ci.yml` (new
gated job) · `tests/placeholder-gate.test.mjs` · regenerated HTML/CSS · `docs/GO_LIVE.md`
A1 verification line.

## Open decisions

- **Does the flag show on the real production domain?** *Recommended: yes.* Fail-closed is
  the entire point, and an unflagged fake licence number in advertising is a regulatory
  problem, not a cosmetic one. **Fallback if Sean rejects it:** keep host-gating but remove
  the `.vercel.app` alias (acceptance 6 alone), which fixes today's specific hole but
  leaves the mechanism able to hide a placeholder again the moment a host is added to the
  list. Ask before choosing the fallback.
- **Does `env.mjs` survive?** It has no other consumer once the placeholder branch is gone.
  Delete the module and its call site rather than leaving a no-op.
