/* ==========================================================================
   Row-level security, proved against a real Postgres with the migrations
   applied (see scripts/reset-test-db.mjs). Impersonation uses the same
   mechanism PostgREST does: SET ROLE authenticated + request.jwt.claim.sub.
   ========================================================================== */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool, type PoolClient } from 'pg';

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

const A = { user: '11111111-0000-4000-8000-000000000001', client: 'aaaaaaaa-0000-4000-8000-000000000001', invoice: 'aaaaaaaa-1111-4000-8000-000000000001' };
const B = { user: '22222222-0000-4000-8000-000000000002', client: 'bbbbbbbb-0000-4000-8000-000000000002', invoice: 'bbbbbbbb-1111-4000-8000-000000000002' };
const OWNER = '33333333-0000-4000-8000-000000000003';
const OFFICER = { user: '44444444-0000-4000-8000-000000000004', officer: 'dddddddd-0000-4000-8000-000000000004' };

d('RLS isolation', () => {
    let pool: Pool;
    beforeAll(async () => {
        pool = new Pool({ connectionString: url });
        const run = (sql: string, params: unknown[] = []) => pool.query(sql, params);
        // Idempotent: the suite may run against a database that was not reset.
        await run(`DELETE FROM auth.users WHERE id = ANY($1::uuid[])`, [[A.user, B.user, OWNER, OFFICER.user, '55555555-0000-4000-8000-000000000005']]);
        await run(`DELETE FROM public.proposals WHERE id = 'aaaaaaaa-5555-4000-8000-000000000001'`);
        await run(`DELETE FROM public.jobs WHERE id IN ('aaaaaaaa-3333-4000-8000-000000000001', 'bbbbbbbb-3333-4000-8000-000000000002')`);
        await run(`DELETE FROM public.invoices WHERE id = ANY($1::uuid[])`, [[A.invoice, B.invoice]]);
        await run(`DELETE FROM public.quotes WHERE client_id = ANY($1::uuid[])`, [[A.client, B.client]]);
        await run(`DELETE FROM public.clients WHERE id = ANY($1::uuid[])`, [[A.client, B.client]]);
        await run(`DELETE FROM public.officers WHERE id = $1`, [OFFICER.officer]);
        await run(`INSERT INTO public.clients (id, name, billing_email) VALUES ($1, 'Client A', 'a@example.com'), ($2, 'Client B', 'b@example.com')`, [A.client, B.client]);
        await run(`INSERT INTO public.officers (id, full_name) VALUES ($1, 'Officer One')`, [OFFICER.officer]);
        await run(`INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
              ($1, 'a@example.com', jsonb_build_object('role','client','client_id',$3::text)),
              ($2, 'b@example.com', jsonb_build_object('role','client','client_id',$4::text)),
              ($5, 'owner@example.com', '{"role":"owner"}'),
              ($6, 'officer@example.com', jsonb_build_object('role','officer','officer_id',$7::text))`,
            [A.user, B.user, A.client, B.client, OWNER, OFFICER.user, OFFICER.officer]);
        await run(`INSERT INTO public.invoices (id, client_id, client_name, status, subtotal_cents, tax_cents, total_cents) VALUES
              ($1, $2, 'Client A', 'sent', 10000, 825, 10825), ($3, $4, 'Client B', 'sent', 20000, 1650, 21650)`, [A.invoice, A.client, B.invoice, B.client]);
        await run(`INSERT INTO public.sites (id, client_id, name) VALUES ('aaaaaaaa-2222-4000-8000-000000000001', $1, 'Site A'), ('bbbbbbbb-2222-4000-8000-000000000002', $2, 'Site B')`, [A.client, B.client]);
        await run(`INSERT INTO public.jobs (id, client_id, division_quote_value, title, starts_at, ends_at) VALUES
              ('aaaaaaaa-3333-4000-8000-000000000001', $1, 'x', 'Job A', now() + interval '1 day', now() + interval '1 day 6 hours'),
              ('bbbbbbbb-3333-4000-8000-000000000002', $2, 'x', 'Job B', now() + interval '2 day', now() + interval '2 day 6 hours')`, [A.client, B.client]);
        await run(`INSERT INTO public.shifts (id, job_id, starts_at, ends_at, bill_rate_cents) VALUES
              ('aaaaaaaa-4444-4000-8000-000000000001', 'aaaaaaaa-3333-4000-8000-000000000001', now() + interval '1 day', now() + interval '1 day 6 hours', 6500),
              ('bbbbbbbb-4444-4000-8000-000000000002', 'bbbbbbbb-3333-4000-8000-000000000002', now() + interval '2 day', now() + interval '2 day 6 hours', 6500)`);
        await run(`INSERT INTO public.shift_assignments (shift_id, officer_id) VALUES ('aaaaaaaa-4444-4000-8000-000000000001', $1)`, [OFFICER.officer]);
        await run(`WITH q AS (INSERT INTO public.quotes (client_id, division_quote_value, bill_rate_cents) VALUES ($1, 'x', 6500) RETURNING id)
              INSERT INTO public.proposals (id, quote_id, client_id, title, scope, terms, status)
              SELECT 'aaaaaaaa-5555-4000-8000-000000000001', q.id, $1, 'P', 'S', 'T', 'sent' FROM q`, [A.client]);
    });
    afterAll(async () => { await pool?.end(); });

    async function as(userId: string | null, fn: (c: PoolClient) => Promise<void>) {
        const c = await pool.connect();
        try {
            await c.query('BEGIN');
            await c.query('SET LOCAL ROLE authenticated');
            if (userId) await c.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [userId]);
            await fn(c);
        } finally {
            await c.query('ROLLBACK').catch(() => {});
            c.release();
        }
    }

    it('client A sees only its own invoices, never client B\'s, even by id', async () => {
        await as(A.user, async (c) => {
            const all = await c.query('SELECT id FROM public.invoices');
            expect(all.rows.map((r) => r.id)).toEqual([A.invoice]);
            const byId = await c.query('SELECT id FROM public.invoices WHERE id = $1', [B.invoice]);
            expect(byId.rowCount).toBe(0);
            const clients = await c.query('SELECT id FROM public.clients');
            expect(clients.rows.map((r) => r.id)).toEqual([A.client]);
            const sites = await c.query('SELECT name FROM public.sites');
            expect(sites.rows.map((r) => r.name)).toEqual(['Site A']);
            const jobs = await c.query('SELECT title FROM public.jobs');
            expect(jobs.rows.map((r) => r.title)).toEqual(['Job A']);
        });
    });

    it('a client cannot write another client\'s rows or read drafts', async () => {
        await pool.query(`UPDATE public.invoices SET status = 'draft' WHERE id = $1`, [A.invoice]);
        await as(A.user, async (c) => {
            expect((await c.query('SELECT id FROM public.invoices')).rowCount).toBe(0);
            const upd = await c.query(`UPDATE public.invoices SET client_name = 'hacked' WHERE id = $1`, [B.invoice]);
            expect(upd.rowCount).toBe(0);
            const del = await c.query('DELETE FROM public.clients WHERE id = $1', [B.client]);
            expect(del.rowCount).toBe(0);
        });
        await pool.query(`UPDATE public.invoices SET status = 'sent' WHERE id = $1`, [A.invoice]);
    });

    it('a client may accept its own sent proposal and nothing else', async () => {
        await as(B.user, async (c) => {
            const foreign = await c.query(`UPDATE public.proposals SET status = 'accepted', accepted_name = 'Mallory' WHERE id = 'aaaaaaaa-5555-4000-8000-000000000001'`);
            expect(foreign.rowCount).toBe(0);
        });
        await as(A.user, async (c) => {
            await c.query('SAVEPOINT sp');
            await expect(c.query(`UPDATE public.proposals SET status = 'draft' WHERE id = 'aaaaaaaa-5555-4000-8000-000000000001'`)).rejects.toThrow(/row-level security/);
            await c.query('ROLLBACK TO SAVEPOINT sp');
            const ok = await c.query(`UPDATE public.proposals SET status = 'accepted', accepted_name = 'Jane' WHERE id = 'aaaaaaaa-5555-4000-8000-000000000001'`);
            expect(ok.rowCount).toBe(1);
        });
    });

    it('the owner sees everything; an unscoped signed-in user sees nothing', async () => {
        await as(OWNER, async (c) => {
            const ids = (await c.query('SELECT id FROM public.invoices')).rows.map((r) => r.id);
            expect(ids).toEqual(expect.arrayContaining([A.invoice, B.invoice]));
            expect((await c.query('SELECT id FROM public.client_quotes')).rowCount).toBe(0);
        });
        await pool.query(`INSERT INTO auth.users (id, email) VALUES ('55555555-0000-4000-8000-000000000005', 'nobody@example.com')`);
        await as('55555555-0000-4000-8000-000000000005', async (c) => {
            expect((await c.query('SELECT id FROM public.invoices')).rowCount).toBe(0);
            expect((await c.query('SELECT id FROM public.clients')).rowCount).toBe(0);
            expect((await c.query('SELECT id FROM public.jobs')).rowCount).toBe(0);
        });
    });

    it('an officer sees only shifts and jobs they are assigned to', async () => {
        await as(OFFICER.user, async (c) => {
            expect((await c.query('SELECT id FROM public.shifts')).rows.map((r) => r.id)).toEqual(['aaaaaaaa-4444-4000-8000-000000000001']);
            expect((await c.query('SELECT title FROM public.jobs')).rows.map((r) => r.title)).toEqual(['Job A']);
            expect((await c.query('SELECT id FROM public.invoices')).rowCount).toBe(0);
            expect((await c.query('SELECT id FROM public.clients')).rowCount).toBe(0);
        });
    });

    it('anon has no access to anything', async () => {
        const c = await pool.connect();
        try {
            await c.query('BEGIN; SET LOCAL ROLE anon');
            expect((await c.query('SELECT id FROM public.invoices')).rowCount).toBe(0);
            expect((await c.query('SELECT id FROM public.client_quotes')).rowCount).toBe(0);
            await expect(c.query(`INSERT INTO public.client_quotes (ref_code, full_name, phone, email, service_division, armed_preference, deployment_location, schedule) VALUES ('x','x','x','x','x','x','x','x')`)).rejects.toThrow(/row-level security/);
        } finally {
            await c.query('ROLLBACK').catch(() => {});
            c.release();
        }
    });
});
