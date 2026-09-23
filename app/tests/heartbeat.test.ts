/* ==========================================================================
   SPEC-004 — the scheduler heartbeat and its two dead-man's-switch layers.

   The tick drives every time-based thing the business does, and if it stops,
   nothing reports it: every symptom is an absence. These tests cover the marks
   that turn an absence into an alert, and — through the same harness — close
   SPEC-003 acceptance 8, which had been implemented but never proven.
   ========================================================================== */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { staleness, STALE_ALERT_MS, STALE_UNHEALTHY_MS, HEARTBEAT_KEY } from '@/lib/heartbeat';

/* 15:00 UTC is 10am Central — deliberately NOT the 7am digest hour. At 12:00Z
   the digest rule runs, and with a double that returns shape-less rows it
   throws, so a "quiet hour" test would silently have been measuring rule
   isolation instead of the heartbeat. */
const NOW = new Date('2026-09-23T15:00:00Z');
const agoMs = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

describe('staleness', () => {
    it('a scheduler that has never run is not stale', () => {
        /* A fresh deployment has simply not ticked yet. Alerting on that would
           page on every preview and train everyone to ignore the page. */
        for (const beat of [null, {} as never, { last_tick_at: '' } as never]) {
            const s = staleness(beat, NOW);
            expect(s).toMatchObject({ known: false, ageMs: null, alert: false, unhealthy: false });
        }
    });

    it('a recent tick is healthy and silent', () => {
        const s = staleness({ last_tick_at: agoMs(30 * 60 * 1000) }, NOW);
        expect(s.known).toBe(true);
        expect(s.alert).toBe(false);
        expect(s.unhealthy).toBe(false);
    });

    it('alerts past 2h but is not yet unhealthy — one late tick must not page AND go red', () => {
        const s = staleness({ last_tick_at: agoMs(STALE_ALERT_MS + 60_000) }, NOW);
        expect(s.alert).toBe(true);
        expect(s.unhealthy).toBe(false);
    });

    it('goes unhealthy past 3h', () => {
        const s = staleness({ last_tick_at: agoMs(STALE_UNHEALTHY_MS + 60_000) }, NOW);
        expect(s.alert).toBe(true);
        expect(s.unhealthy).toBe(true);
    });

    it('is exclusive at the boundary, so an exactly-on-time tick never alerts', () => {
        expect(staleness({ last_tick_at: agoMs(STALE_ALERT_MS) }, NOW).alert).toBe(false);
        expect(staleness({ last_tick_at: agoMs(STALE_UNHEALTHY_MS) }, NOW).unhealthy).toBe(false);
    });

    it('an unparseable timestamp reads as unknown, not as infinitely stale', () => {
        /* Treating corrupt data as a 40-year-old heartbeat would page about an
           outage that is really a bad row. */
        const s = staleness({ last_tick_at: 'not a date' }, NOW);
        expect(s).toMatchObject({ known: false, alert: false, unhealthy: false });
    });

    it('a heartbeat from the future clamps to zero rather than going negative', () => {
        /* Clock skew between the scheduler and the reader is normal. */
        const s = staleness({ last_tick_at: new Date(NOW.getTime() + 5 * 60_000).toISOString() }, NOW);
        expect(s.ageMs).toBe(0);
        expect(s.alert).toBe(false);
    });
});

/* ---------------------------------------------------------------------- */

describe('runTick heartbeat and rule isolation', () => {
    beforeEach(() => vi.resetModules());
    afterEach(() => vi.restoreAllMocks());

    /** Loads the scheduler with a doubled database and a captured reporter. */
    async function withTick(opts: Parameters<typeof import('./helpers/supabase-double')['createSupabaseDouble']>[0]) {
        const { createSupabaseDouble } = await import('./helpers/supabase-double');
        const double = createSupabaseDouble(opts);
        const reports: { severity?: string; context?: Record<string, unknown> }[] = [];

        vi.doMock('@/lib/supabase/admin', () => ({ supabaseAdmin: () => double.client }));
        vi.doMock('@/lib/observability', () => ({
            report: async (_err: unknown, o: Record<string, unknown>) => { reports.push(o); }
        }));
        vi.doMock('@/lib/shared', async (orig) => ({
            ...(await orig() as object), appUrl: () => 'https://portal.example'
        }));

        const { runTick } = await import('@/lib/notifications/scheduler');
        return { runTick, double, reports };
    }

    it('records a heartbeat in settings under the reserved key (acceptance 4)', async () => {
        const { runTick, double } = await withTick({ rows: {} });
        const result = await runTick(NOW);
        /* An empty database is a QUIET hour, not a broken one: no leads to
           chase, no jobs tomorrow, nothing overdue. Asserting that here keeps
           the double honest — if a shape mismatch made rules throw, this test
           would be measuring rule isolation by accident instead of measuring
           the heartbeat. */
        expect(result.failed_rules ?? '(none)').toBe('(none)');

        const written = double.writesTo('settings');
        expect(written.length).toBe(1);
        const payload = written[0].payload as { key: string; value: Record<string, unknown> };
        expect(payload.key).toBe(HEARTBEAT_KEY);
        expect(payload.value.last_tick_at).toBe(NOW.toISOString());
        expect(typeof payload.value.duration_ms).toBe('number');
    });

    it('a late tick reports exactly once at error severity AND still completes (acceptance 5)', async () => {
        const { runTick, double, reports } = await withTick({
            rows: { settings: [{ value: { last_tick_at: agoMs(4 * 60 * 60 * 1000) } }] }
        });
        const result = await runTick(NOW);

        const missed = reports.filter((r) => r.context?.previous_tick_at);
        expect(missed.length).toBe(1);
        expect(missed[0].severity).toBe('error');
        expect(missed[0].context?.gap_hours).toBeGreaterThanOrEqual(4);

        /* The alert is the point; refusing to work because we were late would
           turn one missed hour into two. */
        expect(result.at).toBe(NOW.toISOString());
        expect(double.writesTo('settings').length).toBe(1);
    });

    it('an on-time tick reports nothing about the gap', async () => {
        const { reports, runTick } = await withTick({
            rows: { settings: [{ value: { last_tick_at: agoMs(45 * 60 * 1000) } }] }
        });
        await runTick(NOW);
        expect(reports.filter((r) => r.context?.previous_tick_at)).toHaveLength(0);
    });

    it('ONE FAILING RULE DOES NOT ABORT THE REST (SPEC-003 acceptance 8, GO_LIVE D1b)', async () => {
        /* This is the criterion that mattered most and had only ever been
           verified by reading the code. Its failure mode is silent: a rule that
           throws early takes the reminders, the chasers and the digest with it,
           and the only symptom is a quiet week. */
        const { runTick, double, reports } = await withTick({
            rows: {},
            failOn: { invoices: 'throw' }
        });

        const result = await runTick(NOW);

        /* The tick completed rather than propagating. */
        expect(result.at).toBe(NOW.toISOString());
        /* The failure was named, not swallowed. */
        expect(Number(result.failed ?? 0)).toBeGreaterThan(0);
        expect(reports.some((r) => r.severity === 'error')).toBe(true);
        /* Tables after the failing one were still read — the proof that the
           run continued rather than stopping at the first throw. */
        expect(double.reads.length).toBeGreaterThan(1);
        /* And the heartbeat still recorded the run: it DID happen, badly. */
        expect(double.writesTo('settings').length).toBe(1);
    });
});
