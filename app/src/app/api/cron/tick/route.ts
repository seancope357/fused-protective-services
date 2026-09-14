import { NextResponse, type NextRequest } from 'next/server';
import { runTick } from '@/lib/notifications/scheduler';
import { deployEnv, isProduction, NON_PRODUCTION_REASON } from '@/lib/env';
import { report } from '@/lib/observability';

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
    /* Each rule inside runTick is isolated and reports its own failure
       (SPEC-003 §4), so this catch is for the tick failing to start at all —
       an unconfigured service-role client, most likely. A tick that ran and
       had rules fail still returns 200 with the failures named in the report,
       because the work that did happen happened. */
    try {
        const tick = await runTick(new Date());
        if (tick.failed) {
            console.error(`[cron] ${tick.failed} rule(s) failed: ${tick.failed_rules}`);
        }
        return NextResponse.json({ ok: true, report: tick });
    } catch (err) {
        console.error('[cron] tick failed:', err);
        await report(err, {
            severity: 'fatal',
            source: 'app/api/cron/tick',
            context: { stage: 'tick', reason: 'the scheduler did not start' }
        });
        return NextResponse.json({ ok: false, error: 'tick_failed' }, { status: 500 });
    }
}
