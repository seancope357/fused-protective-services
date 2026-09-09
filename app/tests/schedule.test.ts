import { describe, expect, it } from 'vitest';
import { occurrences, parseRule } from '@/lib/domain/schedule';

describe('shift materialisation', () => {
    it('one-off job yields one shift', () => {
        expect(occurrences('2026-10-24T01:00:00Z', '2026-10-24T07:00:00Z', null, null)).toEqual([{ starts_at: '2026-10-24T01:00:00.000Z', ends_at: '2026-10-24T07:00:00.000Z' }]);
    });

    it('weekly Fri/Sat standing detail through an until date', () => {
        // 2026-10-24 is a Saturday (UTC). First shift is that Saturday.
        const out = occurrences('2026-10-24T01:00:00Z', '2026-10-24T07:00:00Z', 'FREQ=WEEKLY;BYDAY=FR,SA', '2026-11-08');
        const days = out.map((o) => new Date(o.starts_at).getUTCDay());
        expect(days).toEqual([6, 5, 6, 5, 6]);
        expect(out).toHaveLength(5);
        expect(out.at(-1)?.starts_at).toBe('2026-11-07T01:00:00.000Z');
    });

    it('interval and daily rules; bad rules fall back to one shift', () => {
        expect(occurrences('2026-10-01T00:00:00Z', '2026-10-01T08:00:00Z', 'FREQ=DAILY;INTERVAL=2', '2026-10-07')).toHaveLength(4);
        expect(occurrences('2026-10-01T00:00:00Z', '2026-10-01T08:00:00Z', 'FREQ=MONTHLY', '2026-12-01')).toHaveLength(1);
        expect(parseRule('freq=weekly;byday=fr')).toEqual({ freq: 'WEEKLY', byDay: [5], interval: 1 });
    });

    it('caps runaway rules', () => {
        expect(occurrences('2026-01-01T00:00:00Z', '2026-01-01T01:00:00Z', 'FREQ=DAILY', '2030-01-01')).toHaveLength(120);
    });
});
