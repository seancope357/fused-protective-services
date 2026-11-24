/* ==========================================================================
   SCHEDULER CONDITIONS — pure functions over rows
   The tick loads candidate rows and asks these functions what is due.
   Keeping them pure is what makes the trigger conditions unit-testable.
   ========================================================================== */

import { daysBetween, TZ } from '@/lib/format';
import type { Invoice, Job, Lead } from '@/lib/db/types';

const HOUR = 3600 * 1000;

/** Hours between scheduler ticks. MUST match the cron in app/vercel.json.
    24 since 2026-11-23: the Vercel Hobby plan allows one cron run per day (and only
    guarantees it lands somewhere within the scheduled hour), and the budget is $0.
    If the project moves to Pro and the cron goes back to hourly, set this to 1. */
export const TICK_HOURS = 24;

/** Leads still `new` two or more hours after arrival, never responded to. */
export const unansweredLeads = (leads: Lead[], now: Date): Lead[] =>
    leads.filter((l) => l.status === 'new' && !l.first_response_at && now.getTime() - new Date(l.created_at).getTime() >= 2 * HOUR);

/** Jobs starting about a day from now. The window is one tick wide plus an hour of
    slack each side (24h tick: 11h to 37h), so a tick that lands late in its hour cannot
    skip a job; the overlap is harmless because the notifications log sends each
    reminder once. */
export const jobsStartingIn24h = (jobs: Job[], now: Date): Job[] => {
    const half = TICK_HOURS / 2 + 1;
    return jobs.filter((j) => {
        if (j.status !== 'scheduled') return false;
        const delta = new Date(j.starts_at).getTime() - now.getTime();
        return delta >= (24 - half) * HOUR && delta < (24 + half) * HOUR;
    });
};

/** Completed jobs whose completion is 24 hours or more old; the review request follows once. */
export const jobsDueReviewRequest = (jobs: Job[], now: Date): Job[] =>
    jobs.filter((j) => j.status === 'completed' && j.completed_at && now.getTime() - new Date(j.completed_at).getTime() >= 24 * HOUR);

export const OVERDUE_DAYS = [1, 7, 14] as const;

/** Open invoices whose days past due hit exactly one of the reminder marks. */
export const invoicesDueReminder = (invoices: Invoice[], todayYmd: string): { invoice: Invoice; days: number }[] =>
    invoices.flatMap((inv) => {
        if (!['sent', 'partially_paid', 'overdue'].includes(inv.status)) return [];
        const days = daysBetween(inv.due_date, todayYmd);
        return (OVERDUE_DAYS as readonly number[]).includes(days) ? [{ invoice: inv, days }] : [];
    });

/** Open invoices past their due date that are not yet marked overdue. */
export const invoicesToMarkOverdue = (invoices: Invoice[], todayYmd: string): Invoice[] =>
    invoices.filter((inv) => ['sent', 'partially_paid'].includes(inv.status) && daysBetween(inv.due_date, todayYmd) >= 1);

/** Local hour in the business timezone. */
export const localHour = (now: Date): number =>
    Number(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hour12: false }).format(now).replace(/\D/g, '')) % 24;

/** The daily digest is due from 7am Central onward; the notifications log sends it
    once per local day. ">=" rather than "===" because a daily tick fires at 13:00 UTC,
    which is 7am in winter but 8am under daylight saving. */
export const isDigestDue = (now: Date, hour = 7): boolean => localHour(now) >= hour;

/** Local YYYY-MM-DD for a timestamp, in the business timezone. */
export const localYmd = (now: Date): string => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

/** Jobs whose local start date is today. */
export const jobsToday = (jobs: Job[], now: Date): Job[] => {
    const today = localYmd(now);
    return jobs.filter((j) => j.status !== 'cancelled' && localYmd(new Date(j.starts_at)) === today);
};
