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

/** Occurrences from a job's first window through `until` (inclusive, local date), capped. */
export function occurrences(startsAt: string, endsAt: string, rule: string | null | undefined, until: string | null | undefined, cap = 120): Occurrence[] {
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    const duration = end.getTime() - start.getTime();
    if (!(duration > 0)) return [];
    const parsed = parseRule(rule);
    if (!parsed || !until) return [{ starts_at: start.toISOString(), ends_at: end.toISOString() }];

    const untilDate = new Date(`${until}T23:59:59.999Z`);
    const out: Occurrence[] = [];
    const cursor = new Date(start);
    const byDay = parsed.byDay.length ? parsed.byDay : [start.getUTCDay()];
    let week = 0;
    while (cursor <= untilDate && out.length < cap) {
        if (parsed.freq === 'DAILY') {
            out.push({ starts_at: cursor.toISOString(), ends_at: new Date(cursor.getTime() + duration).toISOString() });
            cursor.setUTCDate(cursor.getUTCDate() + parsed.interval);
            continue;
        }
        // WEEKLY: emit this week's matching days, then jump `interval` weeks.
        const weekStart = new Date(cursor);
        for (let d = 0; d < 7; d++) {
            const day = new Date(weekStart.getTime() + d * 86400000);
            if (day < start || day > untilDate) continue;
            if (byDay.includes(day.getUTCDay()) && week % parsed.interval === 0) {
                out.push({ starts_at: day.toISOString(), ends_at: new Date(day.getTime() + duration).toISOString() });
                if (out.length >= cap) break;
            }
        }
        cursor.setTime(weekStart.getTime() + 7 * 86400000);
        week++;
    }
    return out;
}
