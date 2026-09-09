import { NextResponse, type NextRequest } from 'next/server';
import { runTick } from '@/lib/notifications/scheduler';

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
    try {
        const report = await runTick(new Date());
        return NextResponse.json({ ok: true, report });
    } catch (err) {
        console.error('[cron] tick failed:', err);
        return NextResponse.json({ ok: false, error: 'tick_failed' }, { status: 500 });
    }
}
