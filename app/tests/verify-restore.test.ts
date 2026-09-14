/* The restore drill's verification script, over a fixture. The point is that
   the three checks still fail when they should — a check that quietly stopped
   failing is worse than no check, and nobody re-reads this script between
   drills. docs/RESTORE-DRILL.md step 4. */

import { describe, expect, it } from 'vitest';
import { buildReport, renderReport, EXPECTED_TABLES, SERVICE_ROLE_ONLY_TABLES } from '../scripts/verify-restore.mjs';

type Raw = Parameters<typeof buildReport>[0];

/** A healthy restore: every table back, RLS on, sequence ahead of the invoices. */
function fixture(over: Partial<Raw> = {}): Raw {
    const counts: Record<string, number> = {};
    for (const t of EXPECTED_TABLES) counts[t] = 3;
    counts.invoices = 12;
    counts.intake_gate = 0;
    return {
        present: [...EXPECTED_TABLES],
        counts,
        policies: EXPECTED_TABLES.map((table_name) => ({
            table_name,
            rls_enabled: true,
            policy_count: SERVICE_ROLE_ONLY_TABLES.includes(table_name) ? 0 : 2
        })),
        /* pg returns bigint as a string; the report must cope. */
        sequence: { last_value: '12', is_called: true, invoice_count: 12, highest_issued_seq: '12' },
        ...over
    };
}

describe('verify-restore report shape', () => {
    it('reports exactly three checks and an overall verdict', () => {
        const report = buildReport(fixture());
        expect(Object.keys(report.checks)).toEqual(['tableCounts', 'rlsPolicies', 'invoiceSequence']);
        expect(report.ok).toBe(true);
        expect(report.checks.tableCounts).toMatchObject({ ok: true, expected: 20, found: 20, missing: [], totalRows: 66, empty: ['intake_gate'] });
        expect(report.checks.rlsPolicies).toMatchObject({ ok: true, tables: 20, policies: 36, withoutRls: [], withoutPolicies: SERVICE_ROLE_ONLY_TABLES, unexpectedlyUnprotected: [] });
        expect(report.checks.invoiceSequence).toMatchObject({ ok: true, present: true, lastValue: 12, isCalled: true, nextValue: 13, invoiceCount: 12, highestIssued: 12, wouldReissue: false });
    });

    it('prints all three checks, numbered, with a pass mark and the per-table counts', () => {
        const out = renderReport(buildReport(fixture()));
        expect(out).toContain('1 · TABLE COUNTS  [PASS]  20/20 tables, 66 rows');
        expect(out).toContain('2 · RLS POLICIES  [PASS]  36 policies across 20 tables');
        expect(out).toContain('3 · INVOICE SEQUENCE  [PASS]  12 invoices');
        expect(out).toMatch(/invoices\s+12/);
        expect(out).toContain('All three checks passed.');
    });
});

describe('check 1 — table counts', () => {
    it('fails when a table did not come back', () => {
        const raw = fixture();
        const report = buildReport({ ...raw, present: raw.present.filter((t) => t !== 'payments') });
        expect(report.checks.tableCounts).toMatchObject({ ok: false, found: 19, missing: ['payments'] });
        expect(report.ok).toBe(false);
        expect(renderReport(report)).toContain('MISSING: payments');
    });

    it('reports an empty table without failing — a fresh project is legitimately empty', () => {
        const raw = fixture();
        const report = buildReport({ ...raw, counts: { ...raw.counts, clients: 0 } });
        expect(report.checks.tableCounts.ok).toBe(true);
        expect(report.checks.tableCounts.empty).toContain('clients');
    });
});

describe('check 2 — RLS policies', () => {
    it('fails when row level security came back disabled', () => {
        const raw = fixture();
        const report = buildReport({
            ...raw,
            policies: raw.policies.map((p) => (p.table_name === 'invoices' ? { ...p, rls_enabled: false } : p))
        });
        expect(report.checks.rlsPolicies).toMatchObject({ ok: false, withoutRls: ['invoices'] });
        expect(renderReport(report)).toContain('RLS DISABLED: invoices');
    });

    it('fails when a client-visible table lost every policy', () => {
        const raw = fixture();
        const report = buildReport({
            ...raw,
            policies: raw.policies.map((p) => (p.table_name === 'invoices' ? { ...p, policy_count: 0 } : p))
        });
        expect(report.checks.rlsPolicies).toMatchObject({ ok: false, unexpectedlyUnprotected: ['invoices'] });
        expect(renderReport(report)).toContain('UNPROTECTED: invoices');
    });

    it('does not fail on the service-role-only tables, which carry no policy by design', () => {
        const report = buildReport(fixture());
        expect(report.checks.rlsPolicies.withoutPolicies).toEqual(['intake_gate', 'stripe_events']);
        expect(report.checks.rlsPolicies.ok).toBe(true);
    });
});

describe('check 3 — invoice sequence', () => {
    it('fails when the sequence is behind an issued number', () => {
        const report = buildReport(fixture({ sequence: { last_value: '9', is_called: true, invoice_count: 12, highest_issued_seq: '12' } }));
        expect(report.checks.invoiceSequence).toMatchObject({ ok: false, nextValue: 10, highestIssued: 12, wouldReissue: true });
        expect(report.ok).toBe(false);
        expect(renderReport(report)).toContain('WOULD REISSUE A USED NUMBER');
    });

    it('fails on the boundary: the next mint must be strictly greater than the highest issued', () => {
        const report = buildReport(fixture({ sequence: { last_value: '12', is_called: false, invoice_count: 12, highest_issued_seq: '12' } }));
        expect(report.checks.invoiceSequence).toMatchObject({ ok: false, nextValue: 12, wouldReissue: true });
    });

    it('fails when the sequence itself did not come back', () => {
        const report = buildReport(fixture({ sequence: null }));
        expect(report.checks.invoiceSequence).toMatchObject({ ok: false, present: false, lastValue: null });
        expect(report.ok).toBe(false);
        expect(renderReport(report)).toContain('public.invoice_number_seq or public.invoices did not come back');
    });

    it('passes with no invoices issued this year', () => {
        const report = buildReport(fixture({ sequence: { last_value: '1', is_called: false, invoice_count: 0, highest_issued_seq: null } }));
        expect(report.checks.invoiceSequence).toMatchObject({ ok: true, highestIssued: null, wouldReissue: false });
        expect(renderReport(report)).toContain('highest issued this year: (none)');
    });
});
