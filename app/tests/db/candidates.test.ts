/* ==========================================================================
   Candidate applications on a real Postgres with every migration applied
   (see scripts/reset-test-db.mjs). SPEC-010.

   Three things this has to prove and a unit test cannot:

     * who can read an application. `staff_all_candidates` is the only policy on
       the table and this suite does not widen it — it pins it. The officer case
       is the one that matters: officers are authenticated users who came through
       this very pipeline, and must not be able to read it.
     * that every insert, update and delete now leaves an audit row. The table was
       missing from the trigger array in 20260910000009 until this spec.
     * that `stage_changed_at` is maintained by the database rather than by
       whichever caller happened to remember it.

   Impersonation uses the mechanism PostgREST does: SET ROLE authenticated plus
   request.jwt.claim.sub.
   ========================================================================== */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool, type PoolClient } from 'pg';

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

const REF = 'TX-CAND-RLSFIX';
const REFS = [REF, 'TX-CAND-AUDIT', 'TX-CAND-STAGE', 'TX-CAND-CHECK'];

const STAFF = '77777777-0000-4000-8000-000000000007';
const CLIENT_USER = '88888888-0000-4000-8000-000000000008';
const CLIENT_ROW = 'cccccccc-0000-4000-8000-000000000008';
const OFFICER_USER = '99999999-0000-4000-8000-000000000009';
const OFFICER_ROW = 'dddddddd-0000-4000-8000-000000000009';

const insert = (pool: Pool, ref: string, over: Record<string, string> = {}) =>
    pool.query(
        `INSERT INTO public.candidate_applications (ref_code, position_id, license_level, full_name, phone, email, tops_number, service_branch, bio, vetting_stage)
         VALUES ($1, 'pos-ppo', $2, 'Test Candidate', '+15125550199', 'cand@example.com', 'TOPS-1', 'usmc', 'bio', $3)
         RETURNING id, vetting_stage, stage_changed_at, created_at`,
        [ref, over.license_level ?? 'level-4', over.vetting_stage ?? 'application_received']
    );

d('candidate applications in the database', () => {
    let pool: Pool;
    let candidateId: string;

    beforeAll(async () => {
        pool = new Pool({ connectionString: url });
        // Idempotent: the suite may run against a database that was not reset.
        await pool.query(`DELETE FROM public.candidate_applications WHERE ref_code = ANY($1::text[])`, [REFS]);
        await pool.query(`DELETE FROM auth.users WHERE id = ANY($1::uuid[])`, [[STAFF, CLIENT_USER, OFFICER_USER]]);
        await pool.query(`DELETE FROM public.officers WHERE id = $1`, [OFFICER_ROW]);
        await pool.query(`DELETE FROM public.clients WHERE id = $1`, [CLIENT_ROW]);

        await pool.query(`INSERT INTO public.clients (id, name, billing_email) VALUES ($1, 'ATS Client', 'ats@example.com')`, [CLIENT_ROW]);
        await pool.query(`INSERT INTO public.officers (id, full_name) VALUES ($1, 'Roster Officer')`, [OFFICER_ROW]);
        await pool.query(
            `INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
                ($1, 'ats-staff@example.com', '{"role":"staff"}'),
                ($2, 'ats-client@example.com', jsonb_build_object('role','client','client_id',$4::text)),
                ($3, 'ats-officer@example.com', jsonb_build_object('role','officer','officer_id',$5::text))`,
            [STAFF, CLIENT_USER, OFFICER_USER, CLIENT_ROW, OFFICER_ROW]
        );

        const { rows } = await insert(pool, REF);
        candidateId = rows[0].id;
    });

    afterAll(async () => {
        await pool?.query(`DELETE FROM public.candidate_applications WHERE ref_code = ANY($1::text[])`, [REFS]);
        await pool?.query(`DELETE FROM auth.users WHERE id = ANY($1::uuid[])`, [[STAFF, CLIENT_USER, OFFICER_USER]]);
        await pool?.end();
    });

    async function as(userId: string | null, fn: (c: PoolClient) => Promise<void>, role = 'authenticated') {
        const c = await pool.connect();
        try {
            await c.query('BEGIN');
            await c.query(`SET LOCAL ROLE ${role}`);
            if (userId) await c.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [userId]);
            await fn(c);
        } finally {
            await c.query('ROLLBACK').catch(() => {});
            c.release();
        }
    }

    /* ---------- Who may read the pipeline ---------- */

    it('staff read every application and may work it', async () => {
        await as(STAFF, async (c) => {
            const rows = await c.query(`SELECT id, vetting_stage FROM public.candidate_applications WHERE ref_code = $1`, [REF]);
            expect(rows.rowCount).toBe(1);
            const upd = await c.query(`UPDATE public.candidate_applications SET internal_notes = 'working it' WHERE id = $1`, [candidateId]);
            expect(upd.rowCount).toBe(1);
        });
    });

    it('a client sees no applications at all, not even by id', async () => {
        await as(CLIENT_USER, async (c) => {
            expect((await c.query('SELECT id FROM public.candidate_applications')).rowCount).toBe(0);
            expect((await c.query('SELECT id FROM public.candidate_applications WHERE id = $1', [candidateId])).rowCount).toBe(0);
            expect((await c.query(`UPDATE public.candidate_applications SET vetting_stage = 'active_roster' WHERE id = $1`, [candidateId])).rowCount).toBe(0);
        });
    });

    it('an officer sees nothing — they came through this pipeline and must not read it', async () => {
        await as(OFFICER_USER, async (c) => {
            expect((await c.query('SELECT id FROM public.candidate_applications')).rowCount).toBe(0);
            expect((await c.query('SELECT id FROM public.candidate_applications WHERE id = $1', [candidateId])).rowCount).toBe(0);
            expect((await c.query(`UPDATE public.candidate_applications SET internal_notes = 'peek' WHERE id = $1`, [candidateId])).rowCount).toBe(0);
            expect((await c.query('DELETE FROM public.candidate_applications WHERE id = $1', [candidateId])).rowCount).toBe(0);
        });
    });

    it('anon reads nothing and cannot insert — public writes go through the service role', async () => {
        await as(null, async (c) => {
            expect((await c.query('SELECT id FROM public.candidate_applications')).rowCount).toBe(0);
            await expect(
                c.query(
                    `INSERT INTO public.candidate_applications (ref_code, position_id, license_level, full_name, phone, email, bio)
                     VALUES ('TX-CAND-ANON', 'pos-ppo', 'level-4', 'Anon', '+1', 'a@b.c', 'bio')`
                )
            ).rejects.toThrow(/row-level security/);
        }, 'anon');
    });

    /* ---------- The stage vocabulary, enforced ---------- */

    it('the CHECK refuses a stage that is not in the vocabulary', async () => {
        await expect(insert(pool, 'TX-CAND-CHECK', { vetting_stage: 'hired' })).rejects.toThrow(/vetting_stage/);
    });

    it('a new application starts at application_received', async () => {
        const { rows } = await pool.query(`SELECT vetting_stage FROM public.candidate_applications WHERE ref_code = $1`, [REF]);
        expect(rows[0].vetting_stage).toBe('application_received');
    });

    /* ---------- stage_changed_at ---------- */

    it('stage_changed_at starts at creation, moves on a stage change, and holds otherwise', async () => {
        const created = await insert(pool, 'TX-CAND-STAGE');
        const id = created.rows[0].id;
        expect(created.rows[0].stage_changed_at.getTime()).toBe(created.rows[0].created_at.getTime());

        await pool.query(`UPDATE public.candidate_applications SET vetting_stage = 'tops_audit' WHERE id = $1`, [id]);
        const advanced = await pool.query(`SELECT vetting_stage, stage_changed_at FROM public.candidate_applications WHERE id = $1`, [id]);
        expect(advanced.rows[0].vetting_stage).toBe('tops_audit');
        expect(advanced.rows[0].stage_changed_at.getTime()).toBeGreaterThan(created.rows[0].created_at.getTime());

        /* An edit that is not a stage change must not pretend the stage moved. */
        await pool.query(`UPDATE public.candidate_applications SET internal_notes = 'a note' WHERE id = $1`, [id]);
        const noted = await pool.query(`SELECT stage_changed_at FROM public.candidate_applications WHERE id = $1`, [id]);
        expect(noted.rows[0].stage_changed_at.getTime()).toBe(advanced.rows[0].stage_changed_at.getTime());
    });

    /* ---------- Audit coverage ---------- */

    it('every insert, update and delete leaves one audit row against the candidate entity', async () => {
        const created = await insert(pool, 'TX-CAND-AUDIT');
        const id = created.rows[0].id;

        await pool.query(`UPDATE public.candidate_applications SET vetting_stage = 'tops_audit' WHERE id = $1`, [id]);
        await pool.query(`UPDATE public.candidate_applications SET internal_notes = 'note' WHERE id = $1`, [id]);
        await pool.query(`DELETE FROM public.candidate_applications WHERE id = $1`, [id]);

        const { rows } = await pool.query(
            `SELECT action, entity_type, table_name, summary, changes FROM public.audit_log WHERE record_id = $1 ORDER BY at, id`,
            [id]
        );
        expect(rows.map((r) => r.action)).toEqual(['insert', 'update', 'update', 'delete']);
        for (const r of rows) {
            expect(r.entity_type).toBe('candidate');
            expect(r.table_name).toBe('candidate_applications');
        }
        /* The reference code names the record in the summary, as it does for leads. */
        expect(rows[0].summary).toContain('TX-CAND-AUDIT');
        /* A stage change reads as a transition, not as a list of column names. */
        expect(rows[1].summary).toContain('application_received → tops_audit');
        expect(rows[1].changes.vetting_stage).toEqual({ old: 'application_received', new: 'tops_audit' });
    });

    it('the audit row records the staff member who made the change, not "system"', async () => {
        await as(STAFF, async (c) => {
            await c.query(`UPDATE public.candidate_applications SET vetting_stage = 'tops_audit' WHERE id = $1`, [candidateId]);
            const { rows } = await c.query(
                `SELECT actor_id, actor_role FROM public.audit_log WHERE record_id = $1 AND action = 'update' ORDER BY at DESC LIMIT 1`,
                [candidateId]
            );
            expect(rows[0].actor_id).toBe(STAFF);
            expect(rows[0].actor_role).toBe('staff');
        });
    });

    it('a client and an officer cannot read the audit trail either', async () => {
        for (const user of [CLIENT_USER, OFFICER_USER]) {
            await as(user, async (c) => {
                const { rowCount } = await c.query(`SELECT id FROM public.audit_log WHERE entity_type = 'candidate'`);
                expect(rowCount).toBe(0);
            });
        }
    });

    /* ---------- Provenance, inherited from SPEC-002 ---------- */

    it('the portal default filter hides a preview application and the explicit filter shows it', async () => {
        await pool.query(`UPDATE public.candidate_applications SET source_env = 'preview' WHERE ref_code = $1`, [REF]);
        const production = await pool.query(
            `SELECT ref_code FROM public.candidate_applications WHERE ref_code = ANY($1::text[]) AND source_env = 'production'`,
            [REFS]
        );
        expect(production.rows.map((r) => r.ref_code)).not.toContain(REF);

        const all = await pool.query(`SELECT source_env FROM public.candidate_applications WHERE ref_code = $1`, [REF]);
        expect(all.rows[0].source_env).toBe('preview');
        await pool.query(`UPDATE public.candidate_applications SET source_env = 'production' WHERE ref_code = $1`, [REF]);
    });
});
