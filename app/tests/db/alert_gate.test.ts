/* ==========================================================================
   The alert dedupe window on a real database (SPEC-003).

   The in-process fallback is tested in tests/report.test.mjs; this file tests
   the shared window, which is the one that actually holds when a storm is
   spread across a dozen Fluid Compute instances.

   Three things the migration has to get right:
     1. one alert per key per window, with every suppressed occurrence counted;
     2. the count carried into the first alert after the window closes, and
        reset once it has been carried;
     3. no cross-talk with the intake rate limiter, which shares the table.
   ========================================================================== */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

type Verdict = { allowed: boolean; suppressed: number };

d('public.alert_gate', () => {
    let pool: Pool;

    const gate = async (key: string, windowSeconds = 900): Promise<Verdict> => {
        const { rows } = await pool.query('SELECT public.alert_gate($1, $2) AS v', [key, windowSeconds]);
        return rows[0].v as Verdict;
    };

    /* The only way to cross a fifteen-minute window inside a test: age the row
       the function will read next, exactly as the passage of time would. */
    const ageWindow = (key: string, seconds: number) =>
        pool.query(
            `UPDATE public.intake_gate
                SET created_at = created_at - make_interval(secs => $2)
              WHERE ip_hash = 'alert:' || $1`,
            [key, seconds]
        );

    beforeAll(async () => {
        pool = new Pool({ connectionString: url });
        await pool.query(`DELETE FROM public.intake_gate WHERE ip_hash LIKE 'alert:%'`);
    });
    afterAll(async () => {
        await pool.query(`DELETE FROM public.intake_gate WHERE ip_hash LIKE 'alert:%'`);
        await pool.end();
    });

    it('lets the first occurrence through with nothing to carry', async () => {
        expect(await gate('first')).toEqual({ allowed: true, suppressed: 0 });
    });

    it('holds every further occurrence inside the window, and counts them', async () => {
        await gate('storm');
        for (let i = 1; i <= 5; i++) {
            expect(await gate('storm')).toEqual({ allowed: false, suppressed: i });
        }
    });

    it('carries the suppressed count into the next alert, then starts again from zero', async () => {
        await gate('carry');
        for (let i = 0; i < 3; i++) await gate('carry');

        await ageWindow('carry', 901);
        expect(await gate('carry')).toEqual({ allowed: true, suppressed: 3 });

        /* Carried once, and only once: the next email must not re-report the
           same three occurrences on top of its own. */
        expect(await gate('carry')).toEqual({ allowed: false, suppressed: 1 });
        await ageWindow('carry', 901);
        expect(await gate('carry')).toEqual({ allowed: true, suppressed: 1 });
    });

    it('keeps one row per key however long the storm runs', async () => {
        await gate('bounded');
        for (let i = 0; i < 200; i++) await gate('bounded');
        const { rows } = await pool.query(
            `SELECT COUNT(*)::int AS n, MAX(suppressed_count)::int AS suppressed
               FROM public.intake_gate WHERE ip_hash = 'alert:bounded'`
        );
        expect(rows[0]).toEqual({ n: 1, suppressed: 200 });
    });

    it('honours a shorter window when an incident needs one', async () => {
        await gate('short', 60);
        expect(await gate('short', 60)).toEqual({ allowed: false, suppressed: 1 });
        await ageWindow('short', 61);
        expect(await gate('short', 60)).toEqual({ allowed: true, suppressed: 1 });
    });

    it('stores only the hash: no message, no stack, no address', async () => {
        await gate('opaque-key');
        const { rows } = await pool.query(
            `SELECT ip_hash, dedupe_hash, ref_code FROM public.intake_gate WHERE ip_hash = 'alert:opaque-key'`
        );
        expect(rows[0]).toEqual({ ip_hash: 'alert:opaque-key', dedupe_hash: 'alert:opaque-key', ref_code: 'alert' });
    });

    /* The reuse is only safe if the two tenants cannot see each other. They
       share a table, an index and a cleanup job — and nothing else. */
    it('does not disturb the intake rate limiter that shares the table', async () => {
        const ip = 'intake-ip-hash-for-alert-gate-test';
        await pool.query(`DELETE FROM public.intake_gate WHERE ip_hash = $1`, [ip]);

        /* A storm of alerts must not consume the visitor's five submissions. */
        for (let i = 0; i < 50; i++) await gate('noisy-neighbour');

        for (let i = 0; i < 5; i++) {
            const { rows } = await pool.query(
                `SELECT public.intake_gate($1, $2, $3, 5, 600, 900) AS v`,
                [ip, `dedupe-${i}`, `TX-FPS-AG${i}`]
            );
            expect(rows[0].v.allowed).toBe(true);
        }
        const { rows: sixth } = await pool.query(
            `SELECT public.intake_gate($1, 'dedupe-6', 'TX-FPS-AG6', 5, 600, 900) AS v`, [ip]
        );
        expect(sixth[0].v.allowed).toBe(false);

        /* And the alert gate cannot be starved by intake traffic either. */
        expect(await gate('unrelated-key')).toEqual({ allowed: true, suppressed: 0 });

        await pool.query(`DELETE FROM public.intake_gate WHERE ip_hash = $1`, [ip]);
    });

    /* SECURITY DEFINER on a table with RLS and no policies: the grant is the
       whole access control, so it is worth asserting rather than assuming. */
    it('is executable by the service role and by nobody else', async () => {
        const privilege = async (role: string) => {
            const { rows } = await pool.query(
                `SELECT has_function_privilege($1, 'public.alert_gate(text,int)', 'EXECUTE') AS allowed`, [role]
            );
            return rows[0].allowed as boolean;
        };
        expect(await privilege('anon')).toBe(false);
        expect(await privilege('authenticated')).toBe(false);
        expect(await privilege('service_role')).toBe(true);
    });
});
