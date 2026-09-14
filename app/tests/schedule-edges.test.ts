/* ==========================================================================
   Recurrence edges found in review (SPEC-012 branch):
   1. A job that starts in the repeated autumn hour must keep its own first
      shift. The first 01:30 on 2026-11-01 is daylight time and precedes the
      real start (the second 01:30, standard time).
   2. INTERVAL>1 counts calendar weeks (Monday start, RFC 5545's default
      WKST), not 7-day blocks from the start date — otherwise a Friday lands in
      the "off" week and Friday/Saturday pairs split.
   ========================================================================== */

import { describe, expect, it } from 'vitest';
import { occurrences } from '@/lib/domain/schedule';

const starts = (list: { starts_at: string }[]) => list.map((o) => o.starts_at);

describe('occurrences — repeated autumn hour', () => {
    it('keeps the first shift when the job starts in the second 01:30', () => {
        const out = occurrences('2026-11-01T07:30:00.000Z', '2026-11-01T08:30:00.000Z', 'FREQ=DAILY', '2026-11-03');
        expect(starts(out)).toEqual([
            '2026-11-01T07:30:00.000Z',
            '2026-11-02T07:30:00.000Z',
            '2026-11-03T07:30:00.000Z'
        ]);
    });
});

describe('occurrences — WEEKLY with INTERVAL counts calendar weeks', () => {
    it('keeps Friday and Saturday together in the on weeks', () => {
        // Saturday 2026-10-03 at 20:00 Central (CDT) is 2026-10-04T01:00Z.
        const out = occurrences('2026-10-04T01:00:00.000Z', '2026-10-04T07:00:00.000Z', 'FREQ=WEEKLY;BYDAY=FR,SA;INTERVAL=2', '2026-10-31');
        expect(starts(out)).toEqual([
            '2026-10-04T01:00:00.000Z', // Sat Oct 3 (week of Sep 28; Fri Oct 2 precedes the start)
            '2026-10-17T01:00:00.000Z', // Fri Oct 16
            '2026-10-18T01:00:00.000Z', // Sat Oct 17
            '2026-10-31T01:00:00.000Z', // Fri Oct 30
            '2026-11-01T01:00:00.000Z' //  Sat Oct 31, still CDT
        ]);
    });
});
