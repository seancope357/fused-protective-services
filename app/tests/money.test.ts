import { describe, expect, it } from 'vitest';
import { computeTotals, depositCents, dollarsToCents, lineCents } from '@/lib/money';
import { settleLines, parseLegacyRecord, depositLine, balanceLines } from '@/lib/domain/invoicing';

describe('tax arithmetic', () => {
    it('matches the browser tool: 2 officers × 8h × $65 at 8.25%', () => {
        const line = lineCents(2, 8, 6500);
        expect(line).toBe(104000);
        const t = computeTotals([{ amount_cents: line }], 8.25);
        expect(t.tax_cents).toBe(8580);
        expect(t.total_cents).toBe(112580);
    });

    it('rounds tax half-up on the cent', () => {
        // 1 × 1h × $0.29 at 8.25% = 2.3925¢ → 2¢ ; $1.21 → 9.98¢ → 10¢
        expect(computeTotals([{ amount_cents: 29 }], 8.25).tax_cents).toBe(2);
        expect(computeTotals([{ amount_cents: 121 }], 8.25).tax_cents).toBe(10);
    });

    it('tax exempt zeroes the rate but keeps the subtotal', () => {
        const t = computeTotals([{ amount_cents: 5000 }], 8.25, true);
        expect(t).toEqual({ subtotal_cents: 5000, tax_rate_pct: 0, tax_cents: 0, total_cents: 5000 });
    });

    it('handles fractional hours without float drift', () => {
        expect(lineCents(3, 5.5, 9500)).toBe(156750);
        expect(dollarsToCents('1,127.40')).toBe(112740);
        expect(dollarsToCents(0.1 + 0.2)).toBe(30);
    });

    it('deposit percentages', () => {
        expect(depositCents(112580, 50)).toBe(56290);
        expect(depositCents(112580, 33)).toBe(37151);
        expect(depositCents(100, 0)).toBe(0);
    });
});

describe('invoice line derivations', () => {
    it('settles lines and totals together', () => {
        const { lines, totals } = settleLines([{ description: 'A', officers: 2, hours: 8, rate_cents: 6500 }, { description: 'B', officers: 1, hours: 4, rate_cents: 4500 }], 8.25);
        expect(lines.map((l) => l.amount_cents)).toEqual([104000, 18000]);
        expect(totals.subtotal_cents).toBe(122000);
        expect(totals.total_cents).toBe(132065);
    });

    it('deposit + balance invoices sum to the taxed total within a cent', () => {
        const full = settleLines([{ description: 'A', officers: 2, hours: 8, rate_cents: 6500 }], 8.25);
        expect(full.totals.total_cents).toBe(112580);
        const deposit = depositLine('Job', full.totals.total_cents, 50);
        expect(deposit.amount_cents).toBe(56290);
        const balance = settleLines(balanceLines(full.lines, deposit.amount_cents, 8.25), 8.25);
        expect(balance.lines.at(-1)?.amount_cents).toBe(-52000);
        expect(Math.abs(deposit.amount_cents + balance.totals.total_cents - full.totals.total_cents)).toBeLessThanOrEqual(1);
        // Untaxed: the credit is the deposit itself.
        expect(balanceLines(full.lines, 52000, 0).at(-1)?.amount_cents).toBe(-52000);
        expect(computeTotals(balanceLines(full.lines, 52000, 0), 0).subtotal_cents).toBe(52000);
    });

    it('parses a legacy export and rejects a total that does not recompute', () => {
        const ok = parseLegacyRecord({
            number: 'FPS-2026-0003', status: 'sent', issueDate: '2026-08-31', dueDate: '2026-09-30', netTermId: 'net-30',
            client: { name: 'Jane', company: 'Acme' }, lines: [{ desc: 'Level III Armed', officers: 2, hours: 8, rate: 65 }],
            totals: { subtotalCents: 104000, taxCents: 8580, taxRatePct: 8.25, totalCents: 112580 }
        });
        expect(ok.totals.total_cents).toBe(112580);
        expect(ok.status).toBe('sent');
        expect(() => parseLegacyRecord({ number: 'FPS-2026-0004', client: { name: 'X' }, lines: [{ officers: 1, hours: 1, rate: 1 }], totals: { totalCents: 999 } })).toThrow(/does not match/);
        expect(() => parseLegacyRecord({ number: 'nope', client: { name: 'X' } })).toThrow(/malformed/);
    });
});
