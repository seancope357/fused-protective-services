/* What is coming up, from the shifts that are actually scheduled. A job's own
   starts_at is its first shift, so a standing detail that began weeks ago would
   otherwise read as "next" forever. */

export type UpcomingJob = { id: string; title: string; job_number: string; status: string; next_start: string };

export type ShiftWithJob = { starts_at: string; jobs: { id: string; title: string; job_number: string; status: string } | null };

const ACTIVE = new Set(['scheduled', 'in_progress']);

/** Each active job once, at its earliest shift. Expects shifts ordered by starts_at. */
export function nextJobsFromShifts(shifts: ShiftWithJob[]): UpcomingJob[] {
    const seen = new Set<string>();
    const out: UpcomingJob[] = [];
    for (const shift of shifts) {
        const job = shift.jobs;
        if (!job || !ACTIVE.has(job.status) || seen.has(job.id)) continue;
        seen.add(job.id);
        out.push({ ...job, next_start: shift.starts_at });
    }
    return out;
}
