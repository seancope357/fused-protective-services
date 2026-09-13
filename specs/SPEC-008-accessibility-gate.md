# SPEC-008 — Accessibility conformance gate in CI
**Gate:** GO_LIVE.md → E4 · **Surface:** static site + portal
**Size:** M · **Depends on:** — · **Human blocker:** none

## Why

`context/ui-standards.md` states a **WCAG 2.1 AA baseline** as a project standard. Nothing
verifies it. CI runs a drift check, unit tests, RLS proofs and a build — no accessibility
check of any kind. The claim is currently an aspiration with no mechanism behind it.

The site is also unusually dependent on custom interaction: a scroll-driven WebGL intro, a
sliding "bookshelf" of divisions, an ARIA tablist for the deployment protocol, a
multi-step quiz, slider-driven estimators, and a mobile drawer with focus trapping. Every
one of those is a place where keyboard and screen-reader support is hand-built and can
regress silently.

There is also a legal dimension worth stating plainly: a business selling protective
services to the public, advertising on a public website, should not have a front door that
a blind or motor-impaired customer cannot open.

## Scope

**In**
- An automated axe scan of every public page, failing CI on violations.
- The same for the portal's main authenticated screens.
- A recorded manual audit of the things axe cannot check.
- Fixes for everything the first run finds.

**Out**
- WCAG AAA.
- Redesigning any component (fix the accessibility defect; keep the design).
- A full screen-reader certification programme.

## Design

**1 · Automated, without a root dependency.** The root has no `package.json` and keeps
none. So the scan is a **CI-only step** using `npx` with a pinned version — nothing a
contributor must install, nothing added to the repository:

```yaml
- run: python3 serve.py &          # existing zero-dependency preview server
- run: npx --yes @axe-core/cli@<pinned> http://localhost:5050/ /careers /privacy /terms /sms-consent /invoice
       --exit 1 --tags wcag2a,wcag2aa,wcag21a,wcag21aa
```

A new `a11y` job in `.github/workflows/ci.yml`, parallel to `site` and `portal`.

**2 · Portal screens.** `app/` already has dependencies, so `@axe-core/playwright` is
legitimate there. Scan signed-out `/login` plus, with a seeded staff session, the portal
dashboard, leads list, a quote editor and an invoice — the screens Cameron lives in. Reuse
the existing test-database harness (`app/scripts/reset-test-db.mjs`).

**3 · Fix, then gate.** The first run will find violations; that is the point. Order the
work: fix everything found, land the fixes and the gate in the same PR so `main` is never
knowingly red. If a violation needs a design decision, raise it rather than suppressing it
— **no axe rule may be disabled without a one-line justification in the PR** naming why the
rule does not apply, and never to make the build pass.

**4 · The manual audit** — axe catches roughly a third of WCAG issues and none of the ones
this site is most likely to have. Record the result as `docs/A11Y-AUDIT.md`, dated, with
the tester and the environment. Minimum coverage:

- **Keyboard only, no mouse, whole funnel:** nav and drawer (focus trap, `Esc`, focus
  restored to the opener), bookshelf expand/collapse, protocol tablist (arrow keys,
  `Home`/`End`), assessment quiz, estimator sliders (arrows and `Page Up`/`Down`), the
  intake form and its error states, the careers filters and accordion.
- **Screen reader:** VoiceOver/Safari and NVDA/Firefox through a complete quote submission.
  `#formStatus` is a live region — confirm the success and failure messages are actually
  announced, and that the reference code is readable.
- **Scroll-driven intro:** it must be possible to reach the content **without scrolling**
  — by keyboard alone, and with the skip link. A visitor who cannot perform a scroll
  gesture must not be trapped at the top of the page. Verify the skip link is the first
  focusable element and lands on `#main`.
- **`prefers-reduced-motion`:** every animation clamped — assembly, reveals, the careers
  hero, the ambient canvas and the cursor spotlight.
- **Zoom to 200%** and a 320 px viewport with no horizontal scroll and nothing clipped.
- **Contrast:** the gold-on-carbon palette measured against AA for both body and large
  text, including the gold-on-gold gradient states and the placeholder flag.
- **Forms:** every input has a programmatic label; errors are associated via
  `aria-describedby`; nothing communicates state by colour alone.

## Acceptance

1. The `a11y` job runs on every push and PR and fails the build on any violation at the
   four configured tag levels.
2. Zero violations across all six public pages at the time of merge.
3. Zero violations on the portal screens listed in design 2.
4. Every fix preserves the existing visual design.
5. `docs/A11Y-AUDIT.md` exists, dated, covering every bullet in design 4, with findings and
   their resolution.
6. Any disabled rule carries a written justification; no rule is disabled to pass.
7. The keyboard path through a complete quote submission works with no mouse, and is
   recorded.
8. Reduced motion clamps every animation named in design 4.
9. Nothing conveys required state by colour alone.

## Test plan

The CI job is the regression test. Beyond it:

- Add the a11y job to the required-checks list so it cannot be bypassed.
- A unit test in `tests/` asserting the skip link is the first focusable element in the
  generated HTML — cheap, and it protects the single most important keyboard affordance
  from a template reshuffle.
- Re-run the manual audit whenever a component in design 4 changes; note that in
  `context/ui-standards.md` so it is a standing obligation, not a one-off.

## Files

`.github/workflows/ci.yml` · `app/package.json` (+`@axe-core/playwright`, `playwright`) ·
`app/tests/a11y.test.ts` · `docs/A11Y-AUDIT.md` · `context/ui-standards.md` ·
`src/templates/**` and `src/styles/**` as the findings require · `tests/skip-link.test.mjs`
· regenerated output

## Open decisions

- **`npx` in CI, or a devDependency in `app/` for the static pages too?** *Recommended:
  `npx` for the static site.* It keeps the promise that a contributor needs nothing
  installed to work on the site, which is a real property of this repository worth
  protecting. Pin the version so the gate cannot move under us.
- **If a finding needs a design change** (a contrast ratio that fails at the brand's gold,
  say): stop and raise it. Do not silently darken the palette, and do not suppress the
  rule. `context/ui-standards.md` owns the tokens.
- **Scope of the portal scan:** start with the five screens named. Widening it later is
  cheap; a slow, flaky a11y job that everyone learns to ignore is not.
