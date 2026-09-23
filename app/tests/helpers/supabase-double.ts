/* ==========================================================================
   A chainable stand-in for the Supabase query builder.

   `runTick` had no test harness, which is why two acceptance criteria across
   two specs went unverified: SPEC-003 acceptance 8 (a failing rule must not
   abort the remaining rules) and SPEC-004 acceptance 5 (a late tick reports and
   still completes). Both are about what happens when ONE table misbehaves while
   the others are fine, so both need a double that can fail selectively.

   The real builder is chainable and thenable: every filter returns the builder,
   and awaiting it resolves to `{ data, error }`. This mirrors that shape only
   as far as the scheduler actually uses it — from/select/eq/gte/lte/in/is/
   order/limit/maybeSingle/single/upsert/update. It is not a Postgres emulator:
   filters are RECORDED, not applied, because the scheduler's own conditions
   module does the filtering in TypeScript over whatever rows it is handed.
   ========================================================================== */

export type DoubleOptions = {
    /** Rows each table returns. Absent table → empty result, which is healthy. */
    rows?: Record<string, unknown[]>;
    /** Tables whose reads fail. Value picks the failure mode. */
    failOn?: Record<string, 'error' | 'throw'>;
};

export type RecordedWrite = { table: string; op: 'upsert' | 'update'; payload: unknown };

export function createSupabaseDouble(options: DoubleOptions = {}) {
    const rows = options.rows ?? {};
    const failOn = options.failOn ?? {};
    const writes: RecordedWrite[] = [];
    const reads: string[] = [];

    function builder(table: string) {
        const settle = () => {
            const mode = failOn[table];
            if (mode === 'throw') throw new Error(`[double] ${table} threw`);
            if (mode === 'error') {
                return { data: null, error: { message: `[double] ${table} failed`, code: 'PGRST500' } };
            }
            return { data: rows[table] ?? [], error: null };
        };

        const chain: Record<string, unknown> = {
            /* Filters are recorded, not applied — see the header. */
            select: () => chain, eq: () => chain, neq: () => chain,
            gte: () => chain, lte: () => chain, gt: () => chain, lt: () => chain,
            in: () => chain, is: () => chain, not: () => chain,
            order: () => chain, limit: () => chain,

            maybeSingle: async () => {
                const r = settle();
                return r.error ? r : { data: (r.data as unknown[])[0] ?? null, error: null };
            },
            single: async () => {
                const r = settle();
                return r.error ? r : { data: (r.data as unknown[])[0] ?? null, error: null };
            },

            upsert: async (payload: unknown) => {
                if (failOn[table] === 'throw') throw new Error(`[double] ${table} threw`);
                writes.push({ table, op: 'upsert', payload });
                return { data: null, error: failOn[table] === 'error' ? { message: 'write failed' } : null };
            },
            update: (payload: unknown) => {
                writes.push({ table, op: 'update', payload });
                return chain;
            },

            /* Thenable, so `await db.from('x').select('*').eq(...)` resolves. */
            then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
                try {
                    return Promise.resolve(settle()).then(resolve, reject);
                } catch (err) {
                    return Promise.resolve().then(() => reject(err));
                }
            }
        };
        return chain;
    }

    return {
        client: {
            from(table: string) {
                reads.push(table);
                return builder(table);
            }
        },
        writes,
        reads,
        /** Every write to one table, for asserting what the tick recorded. */
        writesTo: (table: string) => writes.filter((w) => w.table === table)
    };
}
