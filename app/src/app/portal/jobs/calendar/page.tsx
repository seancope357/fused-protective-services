import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHead, LinkButton } from '@/components/ui';
import { fmtTime, TZ } from '@/lib/format';
import type { Shift } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

const ymdIn = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

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
    const cells: (string | null)[] = [...Array(leading).fill(null), ...Array.from({ length: last.getUTCDate() }, (_, i) => `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`)];
    const today = ymdIn(now);
    const label = first.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' });

    return (
        <>
            <PageHead eyebrow="Operations" title={label} actions={<><LinkButton href={`/portal/jobs/calendar?m=${ymdIn(prev).slice(0, 7)}`}>← Previous</LinkButton><LinkButton href="/portal/jobs/calendar">Today</LinkButton><LinkButton href={`/portal/jobs/calendar?m=${ymdIn(next).slice(0, 7)}`}>Next →</LinkButton></>}>
                One entry per shift. Standing details show every occurrence.
            </PageHead>
            <div className="calendar" role="grid" aria-label={`Shifts in ${label}`}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="small muted" role="columnheader" style={{ padding: '0 6px' }}>{d}</div>)}
                {cells.map((day, i) => day ? (
                    <div key={day} className={`calendar__day${day === today ? ' calendar__day--today' : ''}`} role="gridcell">
                        <div className="calendar__date">{Number(day.slice(-2))}</div>
                        {(byDay.get(day) ?? []).map((s) => (
                            <Link key={s.id} href={`/portal/jobs/${s.job_id}`} className="calendar__job" title={`${s.jobs?.title} ${fmtTime(s.starts_at)}–${fmtTime(s.ends_at)}`}>
                                {fmtTime(s.starts_at)} {s.jobs?.title ?? s.job_id}
                            </Link>
                        ))}
                    </div>
                ) : <div key={`pad-${i}`} aria-hidden="true" />)}
            </div>
        </>
    );
}
