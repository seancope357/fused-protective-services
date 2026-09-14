import { Fragment } from 'react';
import { fmtDateTime } from '@/lib/format';
import { formatMoney } from '@/lib/money';
import type { TimelineEvent } from '@/lib/domain/timeline';

const isCentsKey = (k: string) => /_cents$/.test(k);
const show = (k: string, v: unknown): string => {
    if (v === null || v === undefined || v === '') return '—';
    if (isCentsKey(k) && typeof v === 'number') return formatMoney(v);
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) return fmtDateTime(v);
    if (typeof v === 'object') return JSON.stringify(v).slice(0, 80);
    return String(v).slice(0, 120);
};

/** Newest first. Changes carry an expandable diff; messages carry their outcome.
    Summaries, recipients and old/new values are free text (an email address, a
    JSON blob), so every line may break anywhere rather than widen a phone. */
export function Timeline({ events, title = 'Activity' }: { events: TimelineEvent[]; title?: string }) {
    /* Unique per title, so two timelines on one page cannot share an id. */
    const headingId = `h-timeline-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    return (
        <section className="card" aria-labelledby={headingId}>
            <div className="card__title"><h2 id={headingId}>{title}</h2><span className="small muted">{events.length} events</span></div>
            {events.length ? (
                <ol className="timeline">
                    {events.map((e) => (
                        <li key={e.id} className="timeline__item">
                            <span className="timeline__when">{fmtDateTime(e.at)}</span>
                            <div className="wrap-anywhere">
                                <div>
                                    {e.kind === 'message' ? <><span className="badge" data-status={e.status === 'sent' ? 'paid' : e.status === 'failed' ? 'failed' : 'draft'}>{e.status}</span>{' '}</> : null}
                                    <span>{e.summary}</span>
                                    <span className="small muted"> · {e.actor}</span>
                                </div>
                                {e.detail ? <div className="small muted">{e.detail}</div> : null}
                                {e.changes ? (
                                    <details className="small mt-2">
                                        <summary>What changed</summary>
                                        <dl className="kv mt-2">
                                            {Object.entries(e.changes).map(([k, v]) => (
                                                <Fragment key={k}>
                                                    <dt>{k.replace(/_/g, ' ')}</dt>
                                                    <dd><span className="muted">{show(k, v.old)}</span> → {show(k, v.new)}</dd>
                                                </Fragment>
                                            ))}
                                        </dl>
                                    </details>
                                ) : null}
                            </div>
                        </li>
                    ))}
                </ol>
            ) : <p className="small muted">Nothing yet.</p>}
        </section>
    );
}
