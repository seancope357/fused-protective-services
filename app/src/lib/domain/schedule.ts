/* ==========================================================================
   SCHEDULE — materialising shifts from a job
   A one-off job has one shift spanning its start and end. A standing detail
   carries an RRULE subset (FREQ=WEEKLY;BYDAY=FR,SA[;INTERVAL=n]) and an until
   date; each occurrence becomes a shift with the same clock times. Pure.
   ========================================================================== */

const DAY_CODES: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

export type Occurrence = { starts_at: string; ends_at: string };

export function parseRule(rule: string | null | undefined): { freq: 'WEEKLY' | 'DAILY'; byDay: number[]; interval: number } | null {
    if (!rule) return null;
    const parts = Object.fromEntries(rule.split(';').map((p) => p.split('=').map((s) => s.trim().toUpperCase()) as [string, string]));
    if (parts.FREQ !== 'WEEKLY' && parts.FREQ !== 'DAILY') return null;
    const byDay = (parts.BYDAY || '').split(',').map((d) => DAY_CODES[d]).filter((n) => Number.isInteger(n));
    const interval = Math.max(1, Number.parseInt(parts.INTERVAL || '1', 10) || 1);
    return { freq: parts.FREQ, byDay, interval };
}

/* Recurrence is a statement about the business's calendar, not UTC's: "every
   Friday at 8pm" means Friday in Austin, and 8pm on both sides of a DST change.
   So weekdays, the until date and the start time are all read in Central time,
   and each occurrence's instant is worked out from that wall-clock time. The
   duration is carried as elapsed time, so a 6-hour shift stays 6 hours. */

const TZ = 'America/Chicago';
const DAY_MS = 86400000;

const wallClockFormat = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
});

/** Calendar date and clock time of an instant in the business timezone. */
function wallClock(at: number): { y: number; mo: number; d: number; h: number; mi: number; s: number } {
    const p = Object.fromEntries(wallClockFormat.formatToParts(new Date(at)).map((x) => [x.type, x.value]));
    return { y: Number(p.year), mo: Number(p.month), d: Number(p.day), h: Number(p.hour) % 24, mi: Number(p.minute), s: Number(p.second) };
}

/** The business timezone's offset from UTC at an instant, in ms (negative in the US). */
function offsetAt(at: number): number {
    const w = wallClock(at);
    return Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s) - Math.floor(at / 1000) * 1000;
}

/**
 * The instant a Central wall-clock time names. In the repeated autumn hour it
 * is the first (daylight) instant; a time inside the skipped spring hour is
 * moved forward past the gap.
 */
function fromWallClock(y: number, mo: number, d: number, h: number, mi: number, s: number, ms: number): number {
    const asUtc = Date.UTC(y, mo - 1, d, h, mi, s, ms);
    const o1 = offsetAt(asUtc);
    const t1 = asUtc - o1;
    const o2 = offsetAt(t1);
    if (o1 === o2) return t1;
    const t2 = asUtc - o2;
    return offsetAt(t2) === o2 ? t2 : Math.max(t1, t2);
}

/** Occurrences from a job's first window through `until` (inclusive, Central date), capped. */
export function occurrences(startsAt: string, endsAt: string, rule: string | null | undefined, until: string | null | undefined, cap = 120): Occurrence[] {
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    const duration = end.getTime() - start.getTime();
    if (!(duration > 0)) return [];
    const parsed = parseRule(rule);
    const single = [{ starts_at: start.toISOString(), ends_at: end.toISOString() }];
    const untilMatch = until ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(until) : null;
    if (!parsed || !untilMatch) return single;

    // Calendar days are counted as UTC midnights of the Central dates, which
    // makes day arithmetic and weekday lookup exact.
    const w = wallClock(start.getTime());
    const firstDay = Date.UTC(w.y, w.mo - 1, w.d);
    const lastDay = Date.UTC(Number(untilMatch[1]), Number(untilMatch[2]) - 1, Number(untilMatch[3]));
    const byDay = parsed.byDay.length ? parsed.byDay : [new Date(firstDay).getUTCDay()];
    // Days from the Monday of the first shift's week (RFC 5545's default WKST).
    const weekOffset = (new Date(firstDay).getUTCDay() + 6) % 7;
    const out: Occurrence[] = [];

    for (let day = firstDay, i = 0; day <= lastDay && out.length < cap; day += DAY_MS, i++) {
        const date = new Date(day);
        // DAILY: every `interval` days. WEEKLY: matching weekdays in every
        // `interval`-th calendar week, counted from the first shift's week.
        const due = parsed.freq === 'DAILY'
            ? i % parsed.interval === 0
            : Math.floor((i + weekOffset) / 7) % parsed.interval === 0 && byDay.includes(date.getUTCDay());
        if (!due) continue;
        // Day 0 is the job's own instant: in the repeated autumn hour the wall
        // clock alone names two instants, and the first precedes the real start.
        const at = i === 0 ? start.getTime() : fromWallClock(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), w.h, w.mi, w.s, start.getUTCMilliseconds());
        if (at < start.getTime()) continue;
        out.push({ starts_at: new Date(at).toISOString(), ends_at: new Date(at + duration).toISOString() });
    }
    return out;
}
