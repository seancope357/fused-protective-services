# SPEC-005 — Cookieless conversion analytics
**Gate:** GO_LIVE.md → D3 · **Surface:** static site
**Size:** M · **Depends on:** SPEC-002 · **Human blocker:** privacy wording rides Gate A3 (attorney review)

## Why

There is no analytics of any kind — verified, no tag, no script, no vendor. The site is an
elaborate conversion funnel (assembly intro → bookshelf → 60-second assessment → budget
estimator → intake form) and **nobody can say whether any stage of it works.**

Concretely, these are unanswerable today: does the WebGL intro help or cost us leads; do
people who finish the assessment convert better; where does the form lose people; what
does a lead cost once traffic is being paid for (Gate E5/E6). Launching a lead engine
with no instrumentation means discovering a broken funnel from a quiet inbox.

## Scope

**In**
- First-party, cookieless event collection for the marketing and careers pages.
- The funnel events that answer the questions above.
- A minimal read surface so the numbers are actually looked at.
- The privacy-policy change that makes the collection honest.

**Out**
- Any third-party analytics vendor or script (see decisions).
- Portal analytics — it is `noindex`, internal, and already has the audit log.
- Attribution across sessions or devices. Explicitly not built.
- A/B testing.

## Design

**1 · First-party, no vendor.** The zero-dependency skill forbids external CDNs, and a
third-party tag would also widen the CSP that SPEC-006 is narrowing and add processors to
the privacy policy. So: `js/modules/analytics.mjs` → `POST /api/event` → a `site_events`
table. No cookies, no fingerprinting, no third party, nothing to disclose beyond one more
first-party store.

**2 · What is collected, exhaustively.** Anything not on this list is a spec violation.

```
event            one of the fixed vocabulary below
session          random id, sessionStorage only, dies with the tab, never persisted
page             pathname only — never the query string, never a hash
referrer_host    hostname only, never the full referring URL
viewport         bucketed: 'sm' | 'md' | 'lg'
at               server timestamp
source_env       from SPEC-002
```

No IP stored (the edge sees it; the row does not keep it). No user agent. No names, emails,
phone numbers or free text — ever, from any field. A reviewer should be able to read the
whole table and learn nothing about any individual.

**3 · Event vocabulary**, fixed in `src/data/analytics.mjs` so the client, the endpoint's
allowlist and any future reporting all read one list — the same anti-drift rule
`quoteValue` follows:

`page_view` · `assembly_settled` (fires on `--assembly-settled`, not `--assembly` — the
dual-clock contract) · `assembly_fallback` · `division_opened` (division `quoteValue`) ·
`assessment_started` · `assessment_completed` (recommended `quoteValue`) ·
`estimator_used` · `quote_form_started` · `quote_form_submitted` · `quote_form_failed` ·
`careers_prequal_run` · `candidate_form_submitted`

The endpoint rejects anything not in the list, so a typo cannot quietly create a new event
name that splits a funnel in two.

**4 · Consent and signals.** Honour `navigator.doNotTrack` and Global Privacy Control: if
either is set, send nothing at all. No cookie banner — there are no cookies to consent to,
which is the point of building it this way.

**5 · Endpoint.** `api/event.mjs`: `cors()` first, same-origin only, validate against the
allowlist, rate limit per IP through `public.intake_gate` exactly as intake does, insert,
return `204`. Failures are silent to the browser and reported at `info` (SPEC-003) —
analytics must never degrade the page.

**6 · Client.** `sendBeacon` where available, `fetch(..., {keepalive: true})` otherwise.
Batched, capped per page load, and entirely inside a `try/catch` — a broken analytics
module must not stop the quote form from working.

**7 · Reading the numbers.** A `/portal/insights` page: a funnel table over a chosen date
range (sessions → assessment completed → form started → submitted), the division breakdown,
and fallback rate. Staff-only, reusing the portal's existing table styling. A dataset
nobody reads is worth nothing.

**8 · Privacy policy.** `src/data/legal.mjs` currently says technical information is
recorded "for security and abuse prevention" — which does not cover analytics. Add a plain
sentence to *What we collect* describing first-party, cookieless usage measurement with no
third-party sharing, and confirm *Who we share it with* stays accurate (it does — no new
processor). The pages are already `reviewed: false`, so this lands before counsel sees
them, which is the right order.

## Acceptance

1. No cookie is set and no third-party request is made by the analytics path.
2. Every stored column is on the design-2 list; no free text, no PII, no full URL, no UA.
3. An event name outside the `src/data/analytics.mjs` vocabulary is rejected with `400` and
   nothing is stored.
4. DNT or GPC set → zero network calls from the module.
5. `assembly_settled` fires from `--assembly-settled`, never from `--assembly`.
6. Throwing anywhere inside the analytics module leaves the quote form fully functional —
   proven by a test that makes the transport throw.
7. Rate limiting rejects a flood from one IP without affecting other visitors.
8. `/portal/insights` renders the funnel for a date range and is unreachable signed out.
9. Non-production events are labelled and excluded from the portal view by default.
10. The privacy policy describes the collection, and `node build.mjs --check` is clean.

## Test plan

- `tests/event.test.mjs`: allowlist enforcement; cross-origin rejected; rate limit; the
  inserted row contains exactly the permitted keys (assert the key set, so a later addition
  of a PII field fails the test).
- `app/tests/`: funnel aggregation arithmetic over a fixture, including a zero-traffic range.
- `app/tests/db/`: `site_events` is staff-read, anon-insert only, and no policy allows a
  client or officer to read it.
- Manual: with DNT on, confirm zero requests in the network panel.

## Files

`src/data/analytics.mjs` · `js/modules/analytics.mjs` · `js/app.mjs` ·
`js/modules/{assessment,estimator,quote-form,bookshelf,careers}.mjs` (emit points) ·
`api/event.mjs` · `supabase/migrations/<ts>_site_events.sql` ·
`app/src/app/portal/insights/page.tsx` · `app/src/app/portal/layout.tsx` (nav) ·
`src/data/legal.mjs` · `tests/event.test.mjs` · `app/tests/` · regenerated output

## Open decisions

- **First-party or a hosted vendor?** *Recommended: first-party, as designed.* Plausible or
  Vercel Web Analytics would be an hour's work, but both mean an external script (against
  the zero-dependency skill), a wider CSP (against SPEC-006) and a new processor in the
  privacy policy right before counsel reviews it. Building it here costs one table and one
  endpoint and keeps all three clean.
- **Retention:** *Recommended: 400 days, enforced by a scheduled delete in the existing
  cron tick.* State the number in the privacy policy so the page and the database agree.
- **Bot filtering:** *Recommended: drop obvious crawler traffic at the endpoint* by
  excluding requests with no `sessionStorage`-backed session id. Do not build a bot
  heuristic; the funnel only needs to be directionally right.
