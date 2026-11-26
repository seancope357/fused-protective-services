import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { TICK_HOURS } from '@/lib/notifications/conditions';

const HOUR_MS = 60 * 60 * 1000;

/* ==========================================================================
   SCHEDULER HEARTBEAT — SPEC-004

   `/api/cron/tick` (daily on Hobby; see TICK_HOURS) drives every time-based thing
   the business does: the unanswered-lead alert, day-before reminders, the unstaffed-job warning,
   review requests, overdue chasers at day 1/7/14, and the 7am digest.

   If it stops, NOTHING REPORTS IT. Every symptom is an absence — a lead nobody
   chased, an invoice nobody pursued, a morning with no digest — and absences
   do not page anyone. The first person to notice is the owner, weeks later,
   wondering why business went quiet.

   So the tick writes down that it ran, and two different things read that mark:

     1. The tick itself, at the start of the next run. This catches a scheduler
        that STALLED AND RECOVERED — a gap an external monitor polling for a
        200 never sees, because by the time it looks, everything is fine again.

     2. The health endpoint. This catches a scheduler that is simply DEAD,
        which layer 1 cannot: a process cannot alert about its own death.

   Neither layer subsumes the other, which is why there are two.

   It lives in `public.settings` (key TEXT PRIMARY KEY, value JSONB) rather
   than a new table — checked before choosing, per the spec's open decision.
   One row does not justify a migration, a new RLS policy and another table for
   a reviewer to reason about. `settings` is staff-read under RLS and the
   scheduler writes with the service role, so the heartbeat is not public.
   ========================================================================== */

export const HEARTBEAT_KEY = 'scheduler_heartbeat';

/** Thresholds derive from the tick interval, which MUST match the cron in
    app/vercel.json (a test enforces it). Hobby only guarantees a run lands
    somewhere within its scheduled hour, so a gap of TICK_HOURS ± 1h is on time.

    Alert: one tick plus 2h. Late beyond the landing window, so a run was
    genuinely missed or badly delayed, not merely late in its hour.
    (Daily cron: 26h. Hourly: 3h.) */
export const STALE_ALERT_MS = (TICK_HOURS + 2) * HOUR_MS;

/** Unhealthy: two ticks plus 2h, a whole run missed. Health goes red well after
    the alert, so the page and the alert do not arrive together for one late tick
    that then recovers on its own. (Daily cron: 50h. Hourly: 4h.) */
export const STALE_UNHEALTHY_MS = (2 * TICK_HOURS + 2) * HOUR_MS;

export type Heartbeat = {
    last_tick_at: string;
    duration_ms?: number;
    failed_rules?: string[];
    rules?: Record<string, number | string>;
    env?: string;
};

/** The heartbeat as last written, or null if the scheduler has never run here.
    Never throws: a health check that 500s because it could not read the mark
    reports the wrong outage. */
export async function readHeartbeat(): Promise<Heartbeat | null> {
    try {
        const { data } = await supabaseAdmin()
            .from('settings').select('value').eq('key', HEARTBEAT_KEY).maybeSingle();
        const value = (data as { value?: Heartbeat } | null)?.value;
        return value?.last_tick_at ? value : null;
    } catch {
        return null;
    }
}

/** Records that a tick completed. Never throws: failing to write the mark must
    not fail the tick that just did the work — the work happened, and losing the
    receipt is the lesser problem. */
export async function writeHeartbeat(beat: Heartbeat): Promise<void> {
    try {
        await supabaseAdmin()
            .from('settings')
            .upsert({ key: HEARTBEAT_KEY, value: beat, updated_at: new Date().toISOString() },
                { onConflict: 'key' });
    } catch {
        /* Deliberately swallowed. The caller reports its own failures. */
    }
}

/** How far past due the scheduler is, and what that means.
    A heartbeat that has never been written is NOT stale — a fresh deployment
    has simply not ticked yet, and paging about that on every preview would be
    noise. It becomes visible the first time a tick is expected and missing. */
export function staleness(beat: Heartbeat | null, now: Date = new Date()): {
    known: boolean; ageMs: number | null; alert: boolean; unhealthy: boolean;
} {
    if (!beat?.last_tick_at) return { known: false, ageMs: null, alert: false, unhealthy: false };
    const last = Date.parse(beat.last_tick_at);
    if (!Number.isFinite(last)) return { known: false, ageMs: null, alert: false, unhealthy: false };
    const ageMs = Math.max(0, now.getTime() - last);
    return {
        known: true,
        ageMs,
        alert: ageMs > STALE_ALERT_MS,
        unhealthy: ageMs > STALE_UNHEALTHY_MS
    };
}
