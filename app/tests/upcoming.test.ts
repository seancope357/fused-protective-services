/* ==========================================================================
   "Jobs in the next 7 days" on Today is derived from shifts, not from a job's
   own starts_at. A standing detail's starts_at is its first shift — weeks ago
   — so filtering jobs by it showed an August job as "next" in September.
   ========================================================================== */

import { describe, expect, it } from 'vitest';
import { nextJobsFromShifts, type ShiftWithJob } from '@/lib/domain/upcoming';

const job = (id: string, status = 'scheduled') => ({ id, title: `Job ${id}`, job_number: `J-${id}`, status });

describe('nextJobsFromShifts', () => {
    it('lists each job once, at its earliest shift, in shift order', () => {
        const shifts: ShiftWithJob[] = [
            { starts_at: '2026-09-15T01:00:00Z', jobs: job('a') },
            { starts_at: '2026-09-15T03:00:00Z', jobs: job('b') },
            { starts_at: '2026-09-16T01:00:00Z', jobs: job('a') }
        ];
        expect(nextJobsFromShifts(shifts).map((j) => [j.id, j.next_start])).toEqual([
            ['a', '2026-09-15T01:00:00Z'],
            ['b', '2026-09-15T03:00:00Z']
        ]);
    });

    it('drops shifts whose job is finished, cancelled or missing', () => {
        const shifts: ShiftWithJob[] = [
            { starts_at: '2026-09-15T01:00:00Z', jobs: job('done', 'completed') },
            { starts_at: '2026-09-15T02:00:00Z', jobs: job('gone', 'cancelled') },
            { starts_at: '2026-09-15T03:00:00Z', jobs: null },
            { starts_at: '2026-09-15T04:00:00Z', jobs: job('live', 'in_progress') }
        ];
        expect(nextJobsFromShifts(shifts).map((j) => j.id)).toEqual(['live']);
    });
});
