---
name: fused-serverless-api
description: Guidelines for building ultra-lightweight Vercel Serverless Functions using native fetch for Fused Protective Services.
---

# Fused Protective Services - Serverless API Skill

When building or modifying backend endpoints in the `api/` directory, you **MUST** adhere to the following architectural constraints:

## 1. Zero Heavy SDKs
- **DO NOT** use heavy Node.js SDKs like `@supabase/supabase-js`, `stripe`, `twilio`, or `@hubspot/api-client` in `api/`.
- Rely on native Node.js `fetch()` (Node 18+) through the transports in `api/_lib/` (`supabase.mjs`, `email.mjs`, `sms.mjs`). Add a transport there rather than calling a vendor URL inline.
- Why? Zero deployment dependencies and near-zero cold starts. (The Next.js portal in `app/` is a separate workspace and may use SDKs.)

## 2. API Structure
- One default export per file: `export default async function handler(req, res)`.
- Shared code lives in `api/_lib/` — the underscore keeps it from deploying as a function.
- Start every handler with `if (!cors(req, res)) return;` from `api/_lib/http.mjs`. It reflects **only the site's own origins**, answers preflight, and sets `Cache-Control: no-store`. Never set `Access-Control-Allow-Origin: *`.
- Business facts (phone, email, company name) come from `src/data/site.mjs`, imported directly. Never restate them.

## 3. Environment Variables
- Never hardcode API keys. Read `process.env` only.
- **No mock data, no fake success.** A missing key is a reported state: return `503` with a stable `error` code (`payments_not_configured`, `not_delivered`) and a plain-language `message`. The visitor is told; the log records it.

## 4. Money
- Amounts are authoritative on the server. Look them up by id from the stored row; never read an amount from the request body.

## 5. Error Handling
- Wrap every third-party `fetch` in `try/catch` and log with `console.error`.
- A stage failure is data (`{ configured, ok }`), not an exception. Report every stage in the response so partial delivery is visible.
- Add a test in `tests/` for every new behaviour; they run with `node --test 'tests/*.test.mjs'` and stub `fetch`.
