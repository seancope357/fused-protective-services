import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { deployEnv } from '@/lib/env';
import { readHeartbeat, staleness, STALE_UNHEALTHY_MS } from '@/lib/heartbeat';

/* ==========================================================================
   GET /api/health — the portal's liveness, configuration and heartbeat check.

   SPEC-004. Public and unauthenticated by design, so an external monitor can
   poll it from outside our network without holding a credential — which means
   every rule from api/health.mjs applies here verbatim:

     booleans only in `configured`; no URL; no Supabase project ref; no stack
     trace or dependency error string; no count of anything the business does.

   The portal carries one thing the marketing site does not: the scheduler
   heartbeat. This is the layer of the dead-man's switch that survives the
   deployment being dead, because a process cannot alert about its own death.
   `/api/cron/tick` marks each run; if that mark goes stale, this endpoint goes
   red within the hour and the monitor pages someone.

   `heartbeat.age_minutes` is deliberately a DURATION, not the timestamp. The
   timestamp would say when our scheduler last ran, which is an operational
   detail about a private system; the age says only "recent" or "not", which is
   the entire question a monitor is asking.
   ========================================================================== */

export const dynamic = 'force-dynamic';

const PROBE_TIMEOUT_MS = 2500;

/** Presence, never any part of a value. See the header. */
function configured() {
    const has = (name: string) => Boolean(String(process.env[name] ?? '').trim());
    return {
        resend: has('RESEND_API_KEY') && has('DISPATCH_ALERT_FROM'),
        twilio: has('TWILIO_ACCOUNT_SID') && has('TWILIO_AUTH_TOKEN')
            && (has('TWILIO_FROM') || has('TWILIO_MESSAGING_SERVICE_SID')),
        stripe: has('STRIPE_SECRET_KEY') && has('STRIPE_WEBHOOK_SECRET'),
        sentry: has('SENTRY_DSN'),
        cron: has('CRON_SECRET'),
        ops_alerts: has('OPS_ALERT_TO') || has('DISPATCH_ALERT_TO')
    };
}

/** Bounded, content-free reachability. An empty table is a healthy one, so this
    asks only whether PostgREST answers — never what it holds. Without the
    timeout a hung database makes the monitor time out instead of receiving a
    503, and "no response" and "database unreachable" are different incidents. */
async function supabaseReachable(): Promise<'ok' | 'unreachable'> {
    try {
        const result = await Promise.race([
            supabaseAdmin().from('settings').select('key', { head: true, count: undefined }).limit(0),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('probe timed out')), PROBE_TIMEOUT_MS))
        ]);
        return (result as { error?: unknown } | null)?.error ? 'unreachable' : 'ok';
    } catch {
        return 'unreachable';
    }
}

export async function GET() {
    const [supabase, beat] = await Promise.all([supabaseReachable(), readHeartbeat()]);
    const gap = staleness(beat);

    /* Two independent reasons to be unhealthy, reported separately so the alert
       names the right one. A scheduler that has never run on this deployment is
       not stale — a fresh preview has simply not ticked yet — so `known: false`
       is reported and does not fail the check. */
    const ok = supabase === 'ok' && !gap.unhealthy;

    return NextResponse.json({
        ok,
        env: deployEnv(),
        checks: {
            supabase,
            scheduler: !gap.known ? 'never_run' : gap.unhealthy ? 'stale' : 'ok'
        },
        heartbeat: {
            known: gap.known,
            age_minutes: gap.ageMs === null ? null : Math.floor(gap.ageMs / 60000),
            stale_after_minutes: Math.floor(STALE_UNHEALTHY_MS / 60000),
            failed_rules: beat?.failed_rules?.length ?? 0
        },
        configured: configured(),
        at: new Date().toISOString()
    }, {
        status: ok ? 200 : 503,
        /* A cached health check is a lie with a timestamp on it. */
        headers: { 'Cache-Control': 'no-store' }
    });
}
