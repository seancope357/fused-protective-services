/* ==========================================================================
   Row provenance on a real database (SPEC-002).

   Proves the three things the migration has to get right: existing rows are
   production rows, an unstamped insert is a production row, and the inbox's
   default filter hides everything else while the explicit filter shows it.
   ========================================================================== */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

const REFS = ['TX-FPS-SRCPRD', 'TX-FPS-SRCPRV', 'TX-FPS-SRCDEV', 'TX-FPS-SRCDEF'];

d('client_quotes.source_env', () => {
    let pool: Pool;

    const insert = (ref: string, sourceEnv?: string) =>
        sourceEnv === undefined
            ? pool.query(
                `INSERT INTO public.client_quotes (ref_code, full_name, phone, email, service_division, armed_preference, deployment_location, schedule)
                 VALUES ($1, 'Provenance Test', '+15125550100', 'p@example.com', 'Commercial & Property Patrol', 'Armed (Level III / IV)', 'Austin, TX', 'TBD')
                 RETURNING source_env`,
                [ref]
            )
            : pool.query(
                `INSERT INTO public.client_quotes (ref_code, full_name, phone, email, service_division, armed_preference, deployment_location, schedule, source_env)
                 VALUES ($1, 'Provenance Test', '+15125550100', 'p@example.com', 'Commercial & Property Patrol', 'Armed (Level III / IV)', 'Austin, TX', 'TBD', $2)
                 RETURNING source_env`,
                [ref, sourceEnv]
            );

    /* One fixture, built once: three labelled rows and one written the way a
       client of the old schema would write it, with no source_env at all. */
    let defaulted: string;
    beforeAll(async () => {
        pool = new Pool({ connectionString: url });
        await pool.query(`DELETE FROM public.client_quotes WHERE ref_code = ANY($1::text[])`, [REFS]);
        await insert('TX-FPS-SRCPRD', 'production');
        await insert('TX-FPS-SRCPRV', 'preview');
        await insert('TX-FPS-SRCDEV', 'development');
        const { rows } = await insert('TX-FPS-SRCDEF');
        defaulted = rows[0].source_env;
    });

    afterAll(async () => {
        await pool?.query(`DELETE FROM public.client_quotes WHERE ref_code = ANY($1::text[])`, [REFS]);
        await pool?.end();
    });

    it('defaults to production, so rows written before this column existed stay real leads', () => {
        expect(defaulted).toBe('production');
    });

    it('refuses a value that is not a deployment environment', async () => {
        await expect(insert('TX-FPS-SRCBAD', 'staging')).rejects.toThrow();
    });

    it('the default inbox filter shows production rows and hides the rest', async () => {
        const { rows } = await pool.query(
            `SELECT ref_code FROM public.client_quotes
             WHERE ref_code = ANY($1::text[]) AND source_env = 'production'
             ORDER BY ref_code`,
            [REFS]
        );
        expect(rows.map((r) => r.ref_code)).toEqual(['TX-FPS-SRCDEF', 'TX-FPS-SRCPRD']);
    });

    it('the explicit filter shows every environment', async () => {
        const { rows } = await pool.query(
            `SELECT source_env FROM public.client_quotes WHERE ref_code = ANY($1::text[]) ORDER BY ref_code`,
            [REFS]
        );
        expect(rows.map((r) => r.source_env).sort()).toEqual(['development', 'preview', 'production', 'production']);
    });
});

d('candidate_applications.source_env', () => {
    let pool: Pool;
    const refs = ['TX-CAND-SRCDEF', 'TX-CAND-SRCPRV'];

    beforeAll(async () => {
        pool = new Pool({ connectionString: url });
        await pool.query(`DELETE FROM public.candidate_applications WHERE ref_code = ANY($1::text[])`, [refs]);
    });

    afterAll(async () => {
        await pool?.query(`DELETE FROM public.candidate_applications WHERE ref_code = ANY($1::text[])`, [refs]);
        await pool?.end();
    });

    it('defaults to production and accepts a preview label', async () => {
        const base = `INSERT INTO public.candidate_applications (ref_code, position_id, license_level, full_name, phone, email, bio`;
        const defaulted = await pool.query(
            `${base}) VALUES ($1, 'general-roster', 'level-3', 'Cand', '+15125550101', 'c@example.com', 'bio') RETURNING source_env`,
            [refs[0]]
        );
        expect(defaulted.rows[0].source_env).toBe('production');

        const labelled = await pool.query(
            `${base}, source_env) VALUES ($1, 'general-roster', 'level-3', 'Cand', '+15125550101', 'c@example.com', 'bio', 'preview') RETURNING source_env`,
            [refs[1]]
        );
        expect(labelled.rows[0].source_env).toBe('preview');
    });
});
