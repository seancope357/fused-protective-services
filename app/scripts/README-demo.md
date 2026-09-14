# Local demo portal and responsive capture

A seeded local portal, and one command that signs in and captures every
portal screen at four widths with layout, accessibility and tap-target
checks. Local stack only — nothing here touches the hosted Supabase project
or Vercel.

## 1. Start the local stack (repository root)

```bash
supabase start -x vector
```

Applies `supabase/migrations`. Ports are 546xx (API `http://127.0.0.1:54621`,
DB `54622`, Studio `54623`, Inbucket `54624`) so the stack runs beside other
projects' local stacks. `-x vector` skips the log shipper, which cannot mount
the Docker socket under Colima; nothing in the portal needs it. TOTP MFA is
enabled in `supabase/config.toml`, as in production.

## 2. Seed (app/)

```bash
pnpm demo:seed
```

Writes `app/.env.local` from `supabase status` (local keys only; refuses to
overwrite a file pointing at a non-local Supabase), wipes and re-seeds the
operational tables, and writes `app/.demo/`:

| File | Holds |
| :--- | :--- |
| `owner.json` | `owner@demo.fps.local` — password and TOTP secret |
| `client.json` | `client@demo.fps.local`, scoped to Moontower Hospitality Group (signs in by magic link) |
| `officer.json` | `officer@demo.fps.local` |
| `ids.json` | one record id per detail route, a pay token and a review token |

To sign in by hand as the owner, take a current code from the secret:
`node -e "import('./scripts/demo-lib.mjs').then(m => console.log(m.totp(require('./.demo/owner.json').totpSecret)))"`.

Re-run the seed any time; numbers (`Q-`, `J-`, `FPS-`) restart so captures
compare like for like. Dates are relative to today in America/Chicago.

## 3. Run the portal on 3100 (app/)

```bash
pnpm dev --port 3100
```

## 4. Capture (app/, second terminal)

```bash
pnpm screens                              # label "after"
SCREENS_LABEL=before pnpm screens         # any label
SCREENS_ONLY='^portal-job' VIEWPORTS_ONLY='^phone' pnpm screens   # partial; merges into report.json
```

Output lands in `app/.demo/screens/<label>/`:

- `<viewport>/<screen>.png` — full-page, for `phone-320` (320×640), `phone`
  (375×812), `tablet` (768×1024), `desktop` (1280×800)
- `report.json` — per screen × viewport: HTTP status, final path, horizontal
  overflow in px with the offending elements, console errors, axe violations
  by rule (WCAG 2.0/2.1 A+AA, 2.2 AA) with example targets, and on phone and
  tablet every interactive element under 44×44 px; plus a per-viewport summary

The run fails a screen on status ≥ 400, a redirect away from the requested
page, console errors, or horizontal page overflow. Axe findings and small
targets are recorded, not failed on.

## Capturing a baseline from another checkout

Run a second checkout's dev server on another port against the same stack and
point the capture at this worktree's `.demo`:

```bash
# in the other checkout's app/, after copying .env.local, tests/responsive.test.ts
# and scripts/demo-lib.mjs into it
pnpm dev --port 3200
RESPONSIVE_PORTAL_URL=http://localhost:3200 SCREENS_LABEL=before \
  DEMO_DIR=/path/to/this/worktree/app/.demo pnpm exec vitest run tests/responsive.test.ts
```

## Troubleshooting

- **"Too many sign-in attempts. Wait 15 minutes and try again."** The capture signs in through the
  real login gate (5 attempts per email, 10 per address, per 15 minutes). Repeated runs use it up.
  `pnpm demo:seed` clears the local gate window along with the data, so re-seed instead of waiting.
- **The run says it passed but produced no screenshots.** Check the exit code of `pnpm screens`
  itself: piping it (`pnpm screens | tail`) reports the pipe's status, not the suite's. A failed
  sign-in skips every capture and still writes an empty `report.json`.
- **`supabase start` fails mounting the Docker socket** under Colima: start with `-x vector`.
