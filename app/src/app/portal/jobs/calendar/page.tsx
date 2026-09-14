import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHead, LinkButton, Empty } from '@/components/ui';
import { fmtTime, TZ } from '@/lib/format';
import type { Shift } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

const ymdIn = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

/* prev/next are UTC midnights on the 1st. Read in Central time they fall on
   the evening before (the last day of the month before), which sent "Next" back
   to the current month and made "Previous" skip one. They are calendar keys,
   not instants, so read them in UTC. */
const monthKey = (d: Date) => d.toISOString().slice(0, 7);

const dayLabel = (ymd: string) => {
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });
};

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
    const { m } = await searchParams;
    const now = new Date();
    const [year, month] = (m && /^\d{4}-\d{2}$/.test(m) ? m : ymdIn(now).slice(0, 7)).split('-').map(Number);
    const first = new Date(Date.UTC(year, month - 1, 1));
    const last = new Date(Date.UTC(year, month, 0));
    const prev = new Date(Date.UTC(year, month - 2, 1));
    const next = new Date(Date.UTC(year, month, 1));

    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.from('shifts').select('*, jobs(id, title, job_number, status, client_id)')
        .gte('starts_at', new Date(first.getTime() - 86400000).toISOString())
        .lte('starts_at', new Date(last.getTime() + 2 * 86400000).toISOString())
        .neq('status', 'cancelled').order('starts_at');
    const shifts = (data ?? []) as (Shift & { jobs: { id: string; title: string; job_number: string; status: string } | null })[];
    const byDay = new Map<string, typeof shifts>();
    for (const s of shifts) {
        const key = ymdIn(new Date(s.starts_at));
        byDay.set(key, [...(byDay.get(key) ?? []), s]);
    }

    const leading = first.getUTCDay();
    const monthDays = Array.from({ length: last.getUTCDate() }, (_, i) => `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`);
    const cells: (string | null)[] = [...Array(leading).fill(null), ...monthDays];
    // The agenda lists only this month's days that have work; the grid shows every day.
    const busyDays = monthDays.filter((day) => byDay.has(day));
    const today = ymdIn(now);
    const label = first.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' });

    return (
        <>
            <PageHead
                eyebrow="Operations"
                title={label}
                actions={<><LinkButton href={`/portal/jobs/calendar?m=${monthKey(prev)}`}>← Previous</LinkButton><LinkButton href="/portal/jobs/calendar">Today</LinkButton><LinkButton href={`/portal/jobs/calendar?m=${monthKey(next)}`}>Next →</LinkButton></>}
                primary={<Link href="/portal/jobs/new" className="btn btn--gold">New job</Link>}
            >
                Every shift this month. A weekly detail shows on each date it runs.
            </PageHead>

            {/* Below 768px: an agenda of the days that have shifts. CSS shows exactly one of the two views. */}
            {busyDays.length ? (
                <ol className="agenda" aria-label={`Shifts in ${label}`}>
                    {busyDays.map((day) => (
                        <li key={day} className={`agenda__day${day === today ? ' agenda__day--today' : ''}`}>
                            <div className="agenda__date">{dayLabel(day)}{day === today ? ' · Today' : ''}</div>
                            {(byDay.get(day) ?? []).map((s) => (
                                <Link key={s.id} href={`/portal/jobs/${s.job_id}`} className="agenda__item">
                                    <span className="agenda__time">{fmtTime(s.starts_at)}</span>
                                    <span>{s.jobs?.title ?? 'Job'} <span className="small muted">until {fmtTime(s.ends_at)}</span></span>
                                </Link>
                            ))}
                        </li>
                    ))}
                </ol>
            ) : (
                <div className="agenda"><Empty>No shifts in {label}.</Empty></div>
            )}

            {/* No grid role: an ARIA grid needs rows, and the month is read best as a
                sequence of days, each announcing its full date. */}
            <div className="calendar" aria-label={`Shifts in ${label}`} role="group">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="small muted" aria-hidden="true" style={{ padding: '0 6px' }}>{d}</div>)}
                {cells.map((day, i) => day ? (
                    <div key={day} className={`calendar__day${day === today ? ' calendar__day--today' : ''}`}>
                        <div className="calendar__date"><span aria-hidden="true">{Number(day.slice(-2))}</span><span className="visually-hidden">{dayLabel(day)}{day === today ? ', today' : ''}</span></div>
                        {(byDay.get(day) ?? []).map((s) => (
                            <Link key={s.id} href={`/portal/jobs/${s.job_id}`} className="calendar__job" title={`${s.jobs?.title} ${fmtTime(s.starts_at)}–${fmtTime(s.ends_at)}`}>
                                {fmtTime(s.starts_at)} {s.jobs?.title ?? 'Job'}
                            </Link>
                        ))}
                    </div>
                ) : <div key={`pad-${i}`} aria-hidden="true" />)}
            </div>
        </>
    );
}
