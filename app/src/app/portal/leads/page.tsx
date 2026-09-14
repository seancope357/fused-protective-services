import Link from 'next/link';
import { PageHead, Badge, Empty } from '@/components/ui';
import { fmtDateTime } from '@/lib/format';
import { divisionByQuoteValue } from '@/lib/shared';
import { listLeads, sourceEnvScope } from '@/lib/domain/queries';

export const dynamic = 'force-dynamic';

const STAGES = ['new', 'contacted', 'audit_scheduled', 'proposal_sent', 'dispatched', 'closed_won', 'closed_lost'];

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ stage?: string; env?: string }> }) {
    const { stage, env } = await searchParams;
    /* Leads submitted from a preview or a laptop are labelled and hidden by
       default (SPEC-002). They are still here, one link away, because that is
       how you check a preview's intake actually worked. */
    const scope = sourceEnvScope(env);
    const stageFilter = stage && STAGES.includes(stage) ? stage : null;
    const leads = await listLeads({ stage: stageFilter, scope });
    const withStage = (params: Record<string, string>) => {
        const query = new URLSearchParams(params);
        return query.size ? `/portal/leads?${query}` : '/portal/leads';
    };

    return (
        <>
            <PageHead eyebrow="Inbox" title="Leads">Every request from the website, newest first. One click converts a lead to a draft quote.</PageHead>
            <nav className="row mb-4" aria-label="Filter by stage">
                <Link href={withStage(scope === 'all' ? { env: 'all' } : {})} className={`btn btn--sm ${!stageFilter ? 'btn--gold' : 'btn--ghost'}`}>All</Link>
                {STAGES.map((s) => (
                    <Link key={s} href={withStage({ stage: s, ...(scope === 'all' ? { env: 'all' } : {}) })} className={`btn btn--sm ${stageFilter === s ? 'btn--gold' : 'btn--ghost'}`}>{s.replace('_', ' ')}</Link>
                ))}
            </nav>
            <nav className="row mb-4" aria-label="Filter by originating environment">
                <span className="small muted">Source</span>
                <Link href={withStage({ ...(stageFilter ? { stage: stageFilter } : {}) })} className={`btn btn--sm ${scope === 'production' ? 'btn--gold' : 'btn--ghost'}`}>Production only</Link>
                <Link href={withStage({ ...(stageFilter ? { stage: stageFilter } : {}), env: 'all' })} className={`btn btn--sm ${scope === 'all' ? 'btn--gold' : 'btn--ghost'}`}>Include preview &amp; local</Link>
            </nav>
            {leads.length ? (
                <div className="card table-wrap">
                    <table>
                        <thead><tr><th>Received</th><th>Reference</th><th>Contact</th><th>Division</th><th>Location</th><th>Priority</th><th>Stage</th></tr></thead>
                        <tbody>
                            {leads.map((l) => (
                                <tr key={l.id} className="is-link">
                                    <td className="mono small">{fmtDateTime(l.created_at)}</td>
                                    <td className="mono small">{l.ref_code}</td>
                                    <td><Link href={`/portal/leads/${l.id}`}>{l.full_name}</Link>{l.company ? <div className="small muted">{l.company}</div> : null}</td>
                                    <td className="small">{divisionByQuoteValue(l.service_division)?.heading ?? l.service_division}</td>
                                    <td className="small">{l.deployment_location}</td>
                                    <td><Badge status={l.priority} /></td>
                                    <td><Badge status={l.status} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : <Empty>No leads{stage ? ` in ${stage.replace('_', ' ')}` : ''} yet.</Empty>}
        </>
    );
}
