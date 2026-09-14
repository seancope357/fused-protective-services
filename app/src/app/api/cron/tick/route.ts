import { NextResponse, type NextRequest } from 'next/server';
import { runTick } from '@/lib/notifications/scheduler';
import { deployEnv, isProduction, NON_PRODUCTION_REASON } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Hourly scheduler. Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`. */
export async function GET(request: NextRequest) {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
        console.error('[cron] CRON_SECRET is not set; refusing to run.');
        return NextResponse.json({ ok: false, error: 'cron_not_configured' }, { status: 503 });
    }
    if (request.headers.get('authorization') !== `Bearer ${secret}`) {
        return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
    /* Vercel only runs crons on production deployments, but the route is
       reachable on every preview URL with the shared secret. A tick reminds
       clients, chases invoices and texts the owner; none of that may come from
       a preview. Refuse after authenticating, and say why rather than
       returning an empty report that reads like a quiet hour. */
    if (!isProduction()) {
        console.warn(`[cron] refusing to run outside production (VERCEL_ENV=${deployEnv()}).`);
        return NextResponse.json({ ok: true, skipped: NON_PRODUCTION_REASON, environment: deployEnv() });
    }
    try {
        const report = await runTick(new Date());
        return NextResponse.json({ ok: true, report });
    } catch (err) {
        console.error('[cron] tick failed:', err);
        return NextResponse.json({ ok: false, error: 'tick_failed' }, { status: 500 });
    }
}
