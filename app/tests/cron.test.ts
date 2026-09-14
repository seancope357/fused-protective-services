/* ==========================================================================
   /api/cron/tick refuses to run outside production (SPEC-002).

   The route is reachable on every preview URL, and a tick reminds clients,
   chases invoices and texts the owner. `runTick` is never reached here: it
   would need a real Supabase service-role client, so if the guard ever stops
   working these tests fail loudly rather than quietly hitting the network.
   ========================================================================== */

import { afterEach, describe, expect, it } from 'vitest';
import type { NextRequest } from 'next/server';
import { GET } from '@/app/api/cron/tick/route';

const SECRET = 'cron-secret-for-tests';

const request = (authorization?: string) =>
    ({ headers: new Headers(authorization ? { authorization } : {}) }) as unknown as NextRequest;

const saved = { ...process.env };
afterEach(() => { process.env = { ...saved }; });

describe('cron tick', () => {
    it('skips, and says why, on a preview deployment', async () => {
        process.env.CRON_SECRET = SECRET;
        process.env.VERCEL_ENV = 'preview';

        const res = await GET(request(`Bearer ${SECRET}`));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ ok: true, skipped: 'non_production_env', environment: 'preview' });
    });

    it('skips when VERCEL_ENV is absent, rather than assuming production', async () => {
        process.env.CRON_SECRET = SECRET;
        delete process.env.VERCEL_ENV;

        const res = await GET(request(`Bearer ${SECRET}`));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ ok: true, skipped: 'non_production_env', environment: 'development' });
    });

    it('still refuses an unauthenticated caller before it says anything about the environment', async () => {
        process.env.CRON_SECRET = SECRET;
        process.env.VERCEL_ENV = 'preview';

        const res = await GET(request('Bearer wrong'));
        expect(res.status).toBe(401);
        expect(await res.json()).toEqual({ ok: false, error: 'unauthorized' });
    });

    it('reports a missing CRON_SECRET rather than running', async () => {
        delete process.env.CRON_SECRET;
        process.env.VERCEL_ENV = 'production';

        const res = await GET(request('Bearer anything'));
        expect(res.status).toBe(503);
        expect(await res.json()).toEqual({ ok: false, error: 'cron_not_configured' });
    });
});
