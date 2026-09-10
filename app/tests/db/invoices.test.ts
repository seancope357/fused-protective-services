/* Invoice numbering under concurrency and Stripe idempotency, on a real database. */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;

d('invoice numbering and payment idempotency', () => {
    let pool: Pool;
    const client = 'cccccccc-0000-4000-8000-000000000003';
    beforeAll(async () => {
        pool = new Pool({ connectionString: url, max: 25 });
        await pool.query(`INSERT INTO public.clients (id, name) VALUES ($1, 'Concurrent Co') ON CONFLICT DO NOTHING`, [client]);
    });
    afterAll(async () => { await pool?.end(); });

    it('40 concurrent mints on separate connections never collide', async () => {
        const numbers = await Promise.all(Array.from({ length: 40 }, async () => {
            const c = await pool.connect();
            try {
                const r = await c.query(`SELECT public.next_invoice_number('FPS', 4) AS n`);
                return r.rows[0].n as string;
            } finally {
                c.release();
            }
        }));
        expect(new Set(numbers).size).toBe(40);
        expect(numbers.every((n) => /^FPS-\d{4}-\d{4,}$/.test(n))).toBe(true);
    });

    it('concurrent inserts without a number get distinct trigger-minted numbers', async () => {
        const ids = await Promise.all(Array.from({ length: 20 }, async () => {
            const r = await pool.query(`INSERT INTO public.invoices (client_id, client_name, status) VALUES ($1, 'X', 'draft') RETURNING invoice_number`, [client]);
            return r.rows[0].invoice_number as string;
        }));
        expect(new Set(ids).size).toBe(20);
    });

    it('legacy import reserves the sequence so later mints skip past imported numbers', async () => {
        const year = new Date().getFullYear();
        const current = Number((await pool.query(`SELECT public.next_invoice_number('FPS', 4) AS n`)).rows[0].n.split('-')[2]);
        const target = current + 50;
        await pool.query(`SELECT public.reserve_invoice_sequence($1)`, [`FPS-${year}-${String(target).padStart(4, '0')}`]);
        const r = await pool.query(`SELECT public.next_invoice_number('FPS', 4) AS n`);
        expect(r.rows[0].n).toBe(`FPS-${year}-${String(target + 1).padStart(4, '0')}`);
        // Reserving a lower number never moves the sequence backwards.
        await pool.query(`SELECT public.reserve_invoice_sequence($1)`, [`FPS-${year}-0001`]);
        expect(Number((await pool.query(`SELECT public.next_invoice_number('FPS', 4) AS n`)).rows[0].n.split('-')[2])).toBe(target + 2);
    });

    it('apply_stripe_payment_event: duplicate events and double-counted intents are no-ops; totals settle once', async () => {
        const inv = (await pool.query(`INSERT INTO public.invoices (client_id, client_name, status, subtotal_cents, tax_cents, total_cents) VALUES ($1, 'X', 'sent', 10000, 825, 10825) RETURNING id`, [client])).rows[0].id;
        const run = Math.random().toString(36).slice(2, 8);
        const apply = (evt: string, type: string, status: string, amount = 10825) =>
            pool.query(`SELECT public.apply_stripe_payment_event($1, $2, $3, $6, $7, 'ch_t1', $4, 'card', $5, NULL, '{}') AS r`, [`${evt}_${run}`, type, inv, amount, status, `pi_${run}`, `cs_${run}`]).then((r) => r.rows[0].r);

        expect(await apply('evt_a', 'checkout.session.completed', 'pending')).toMatchObject({ applied: true, invoice_status: 'sent' });
        expect(await apply('evt_b', 'payment_intent.succeeded', 'succeeded')).toMatchObject({ applied: true, invoice_status: 'paid' });
        expect(await apply('evt_b', 'payment_intent.succeeded', 'succeeded')).toMatchObject({ applied: false, reason: 'duplicate_event' });
        expect(await apply('evt_c', 'checkout.session.completed', 'succeeded')).toMatchObject({ applied: false, reason: 'intent_already_settled' });

        const row = (await pool.query(`SELECT status, amount_paid_cents, paid_at FROM public.invoices WHERE id = $1`, [inv])).rows[0];
        expect(row.status).toBe('paid');
        expect(row.amount_paid_cents).toBe(10825);
        expect(row.paid_at).not.toBeNull();
        const pays = await pool.query(`SELECT status, amount_cents FROM public.payments WHERE invoice_id = $1`, [inv]);
        expect(pays.rows).toEqual([{ status: 'succeeded', amount_cents: 10825 }]);
    });

    it('a partial payment leaves the invoice partially_paid; a failed one records the failure', async () => {
        const inv = (await pool.query(`INSERT INTO public.invoices (client_id, client_name, status, subtotal_cents, tax_cents, total_cents) VALUES ($1, 'Y', 'sent', 10000, 0, 10000) RETURNING id`, [client])).rows[0].id;
        const run = Math.random().toString(36).slice(2, 8);
        const partial = await pool.query(`SELECT public.apply_stripe_payment_event($2, 'payment_intent.succeeded', $1, $3, NULL, NULL, 4000, 'us_bank_account', 'succeeded', NULL, '{}') AS r`, [inv, `evt_p1_${run}`, `pi_p1_${run}`]);
        expect(partial.rows[0].r.invoice_status).toBe('partially_paid');
        const failed = await pool.query(`SELECT public.apply_stripe_payment_event($2, 'payment_intent.payment_failed', $1, $3, NULL, NULL, 6000, 'card', 'failed', 'declined', '{}') AS r`, [inv, `evt_p2_${run}`, `pi_p2_${run}`]);
        expect(failed.rows[0].r.invoice_status).toBe('partially_paid');
        const pays = await pool.query(`SELECT status FROM public.payments WHERE invoice_id = $1 ORDER BY status`, [inv]);
        expect(pays.rows.map((r) => r.status)).toEqual(['failed', 'succeeded']);
    });
});

const d3 = url ? describe : describe.skip;
d3('audit log', () => {
    let pool: Pool;
    beforeAll(async () => { pool = new Pool({ connectionString: url }); });
    afterAll(async () => { await pool?.end(); });

    it('records who changed what, skips no-op writes, and is readable by staff only', async () => {
        const client = 'cccccccc-0000-4000-8000-000000000003';
        const inv = (await pool.query(`INSERT INTO public.invoices (client_id, client_name, status, total_cents) VALUES ($1, 'Audit', 'draft', 500) RETURNING id`, [client])).rows[0].id;
        await pool.query(`UPDATE public.invoices SET status = 'sent', notes = 'n1' WHERE id = $1`, [inv]);
        await pool.query(`UPDATE public.invoices SET updated_at = now() WHERE id = $1`, [inv]);
        const rows = (await pool.query(`SELECT action, actor_role, summary, changes FROM public.audit_log WHERE record_id = $1 ORDER BY id`, [inv])).rows;
        expect(rows.map((r) => r.action)).toEqual(['insert', 'update']);
        expect(rows[1].summary).toMatch(/draft → sent \(\+1 more\)/);
        expect(rows[1].changes).toEqual({ status: { old: 'draft', new: 'sent' }, notes: { old: null, new: 'n1' } });
        expect(rows[1].actor_role).toBe('system');

        const c = await pool.connect();
        try {
            await c.query('BEGIN; SET LOCAL ROLE authenticated');
            await c.query(`SELECT set_config('request.jwt.claim.sub', '11111111-0000-4000-8000-000000000001', true)`);
            expect((await c.query('SELECT id FROM public.audit_log')).rowCount).toBe(0);
            await expect(c.query(`DELETE FROM public.audit_log WHERE record_id = $1`, [inv])).rejects.toThrow(/permission denied/);
        } finally {
            await c.query('ROLLBACK').catch(() => {});
            c.release();
        }
    });
});
