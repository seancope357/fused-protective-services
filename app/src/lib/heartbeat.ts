import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';

/* ==========================================================================
   SCHEDULER HEARTBEAT — SPEC-004

   `/api/cron/tick` drives every time-based thing the business does: the 2-hour
   unanswered-lead alert, day-before reminders, the unstaffed-job warning,
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

/** The tick runs hourly. Two hours means one invocation was genuinely missed,
    not merely late — tight enough to catch a real outage the same morning,
    loose enough to survive a single skipped run without crying wolf. */
export const STALE_ALERT_MS = 2 * 60 * 60 * 1000;

/** Health goes red an hour after the alert fires, so the page and the alert do
    not arrive together for one late tick that then recovers on its own. */
export const STALE_UNHEALTHY_MS = 3 * 60 * 60 * 1000;

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
