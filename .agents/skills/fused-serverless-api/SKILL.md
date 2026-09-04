---
name: fused-serverless-api
description: Guidelines for building ultra-lightweight Vercel Serverless Functions using native fetch for Fused Protective Services.
---

# Fused Protective Services - Serverless API Skill

When building or modifying backend endpoints in the `api/` directory, you **MUST** adhere to the following architectural constraints:

## 1. Zero Heavy SDKs
- **DO NOT** use heavy Node.js SDKs like `@supabase/supabase-js`, `stripe`, `twilio`, or `@hubspot/api-client`.
- We rely entirely on native Node.js `fetch()` (Node 18+) to communicate directly with third-party REST APIs. 
- Why? To maintain zero deployment dependencies and keep serverless cold-start times near 0ms.

## 2. API Structure
- All endpoints must be Vercel-compatible Serverless Functions or Edge Functions.
- Export a default async function: `export default async function handler(req, res)`
- Always implement robust CORS headers handling at the top of the function:
  ```javascript
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  ```
- Always handle the `OPTIONS` preflight request immediately.

## 3. Environment Variables
- Never hardcode API keys. 
- Rely on `process.env` for all secrets (e.g., `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `HUBSPOT_WEBHOOK_URL`).
- Provide safe fallbacks or mock data for local development (`serve.py`) when environment variables might not be present.

## 4. Error Handling
- Wrap all third-party `fetch` calls in `try/catch` blocks.
- Log errors via `console.error` for Vercel logging.
- Always return a standard JSON error response (`res.status(500).json({ error: '...' })`) rather than crashing the function.
