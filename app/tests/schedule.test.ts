import { describe, expect, it } from 'vitest';
import { occurrences, parseRule } from '@/lib/domain/schedule';

/** Weekday and 24h wall-clock time of an instant in the business timezone. */
function central(iso: string): { day: string; time: string } {
    const p = Object.fromEntries(
        new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
            .formatToParts(new Date(iso))
            .map((x) => [x.type, x.value])
    );
    return { day: p.weekday, time: `${p.hour}:${p.minute}` };
}

const HOURS = 3600000;
const durationOf = (o: { starts_at: string; ends_at: string }) => new Date(o.ends_at).getTime() - new Date(o.starts_at).getTime();

describe('shift materialisation', () => {
    it('one-off job yields one shift', () => {
        expect(occurrences('2026-10-24T01:00:00Z', '2026-10-24T07:00:00Z', null, null)).toEqual([{ starts_at: '2026-10-24T01:00:00.000Z', ends_at: '2026-10-24T07:00:00.000Z' }]);
    });

    it('weekly Fri/Sat standing detail through an until date', () => {
        // 2026-10-24T01:00Z is Friday 23 October, 8pm Central. BYDAY is read in
        // Central time, so the series is Fri/Sat evenings through Sat 7 Nov.
        const out = occurrences('2026-10-24T01:00:00Z', '2026-10-24T07:00:00Z', 'FREQ=WEEKLY;BYDAY=FR,SA', '2026-11-08');
        expect(out.map((o) => central(o.starts_at).day)).toEqual(['Fri', 'Sat', 'Fri', 'Sat', 'Fri', 'Sat']);
        expect(out.every((o) => central(o.starts_at).time === '20:00')).toBe(true);
        expect(out.at(-1)?.starts_at).toBe('2026-11-08T02:00:00.000Z');
    });

    it('a Friday 8pm Central shift with BYDAY=FR lands only on Fridays in Central time', () => {
        // Fri 2 Oct 2026 20:00 CDT is already Saturday in UTC.
        const out = occurrences('2026-10-03T01:00:00Z', '2026-10-03T07:00:00Z', 'FREQ=WEEKLY;BYDAY=FR', '2026-10-30');
        expect(out).toHaveLength(5);
        expect(out.map((o) => central(o.starts_at))).toEqual(Array(5).fill({ day: 'Fri', time: '20:00' }));
    });

    it('includes a late-evening shift that starts on the until date (Central)', () => {
        // Fri 2 Oct 2026 21:30 CDT. The until date is Fri 16 Oct, so the 16 Oct
        // shift counts even though it starts on the 17th in UTC.
        const weekly = occurrences('2026-10-03T02:30:00Z', '2026-10-03T08:30:00Z', 'FREQ=WEEKLY', '2026-10-16');
        expect(weekly.map((o) => o.starts_at)).toEqual(['2026-10-03T02:30:00.000Z', '2026-10-10T02:30:00.000Z', '2026-10-17T02:30:00.000Z']);
        const daily = occurrences('2026-10-03T02:30:00Z', '2026-10-03T08:30:00Z', 'FREQ=DAILY', '2026-10-04');
        expect(daily).toHaveLength(3);
        expect(central(daily.at(-1)!.starts_at)).toEqual({ day: 'Sun', time: '21:30' });
    });

    it('keeps the wall-clock start and duration across the November DST change', () => {
        // DST ends 2026-11-01. 8pm Central is 01:00Z before and 02:00Z after.
        const out = occurrences('2026-10-24T01:00:00Z', '2026-10-24T07:00:00Z', 'FREQ=WEEKLY;BYDAY=FR', '2026-11-13');
        expect(out.map((o) => o.starts_at)).toEqual(['2026-10-24T01:00:00.000Z', '2026-10-31T01:00:00.000Z', '2026-11-07T02:00:00.000Z', '2026-11-14T02:00:00.000Z']);
        expect(out.map((o) => central(o.starts_at))).toEqual(Array(4).fill({ day: 'Fri', time: '20:00' }));
        expect(out.map(durationOf)).toEqual(Array(4).fill(6 * HOURS));
    });

    it('keeps the wall-clock start across the March DST change', () => {
        // DST starts 2027-03-14. Fri 5 Mar 2027 8pm CST is 02:00Z; after, 01:00Z.
        const out = occurrences('2027-03-06T02:00:00Z', '2027-03-06T08:00:00Z', 'FREQ=WEEKLY;BYDAY=FR', '2027-03-19');
        expect(out.map((o) => o.starts_at)).toEqual(['2027-03-06T02:00:00.000Z', '2027-03-13T02:00:00.000Z', '2027-03-20T01:00:00.000Z']);
        expect(out.map(durationOf)).toEqual(Array(3).fill(6 * HOURS));
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
