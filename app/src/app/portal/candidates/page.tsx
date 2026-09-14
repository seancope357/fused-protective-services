import Link from 'next/link';
import { PageHead, Badge, Empty } from '@/components/ui';
import { fmtDateTime } from '@/lib/format';
import { isVettingStage, positionTitle, vettingPipeline, vettingStageLabel } from '@/lib/shared';
import { listCandidates, sourceEnvScope } from '@/lib/domain/queries';

export const dynamic = 'force-dynamic';

/* Deliberately the same shape as /portal/candidates' sibling, the Leads inbox:
   same filter rows, same source-environment switch, same table. Recruiting and
   sales are two pipelines and one job, and Cameron should not have to learn two
   interfaces to work them. */

export default async function CandidatesPage({
    searchParams
}: {
    searchParams: Promise<{ stage?: string; env?: string; licence?: string; position?: string }>;
}) {
    const { stage, env, licence, position } = await searchParams;
    /* Applications filled in on a preview or a laptop are labelled and hidden by
       default (SPEC-002) — they are how intake gets tested, not people who
       applied. Still one link away, for exactly that reason. */
    const scope = sourceEnvScope(env);
    const stageFilter = isVettingStage(stage) ? stage : null;
    const licenceFilter = licence || null;
    const positionFilter = position || null;
    const candidates = await listCandidates({ stage: stageFilter, licenseLevel: licenceFilter, positionId: positionFilter, scope });

    /* Licence levels come from a select on the careers page, not from src/data,
       so the filter offers the values actually present rather than restating a
       vocabulary this side of the build cannot see. */
    const unfiltered = licenceFilter || positionFilter ? await listCandidates({ stage: stageFilter, scope }) : candidates;
    const licences = [...new Set(unfiltered.map((c) => c.license_level).filter(Boolean))].sort();
    const positions = [...new Set(unfiltered.map((c) => c.position_id).filter(Boolean))].sort();

    const withParams = (params: Record<string, string>) => {
        const query = new URLSearchParams(params);
        return query.size ? `/portal/candidates?${query}` : '/portal/candidates';
    };
    /* Every filter link keeps the other filters and the environment scope. */
    const keep = {
        ...(stageFilter ? { stage: stageFilter } : {}),
        ...(licenceFilter ? { licence: licenceFilter } : {}),
        ...(positionFilter ? { position: positionFilter } : {}),
        ...(scope === 'all' ? { env: 'all' } : {})
    };
    const without = (key: keyof typeof keep) => {
        const next = { ...keep };
        delete next[key];
        return next;
    };

    return (
        <>
            <PageHead eyebrow="Inbox" title="Candidates">
                Every application from the careers page, newest first. Stages advance one at a time; a rejection can be re-opened.
            </PageHead>

            <nav className="row mb-4" aria-label="Filter by vetting stage">
                <Link href={withParams(without('stage'))} className={`btn btn--sm ${!stageFilter ? 'btn--gold' : 'btn--ghost'}`}>All</Link>
                {vettingPipeline.map((s) => (
                    <Link key={s.id} href={withParams({ ...without('stage'), stage: s.id })} className={`btn btn--sm ${stageFilter === s.id ? 'btn--gold' : 'btn--ghost'}`}>
                        {s.label}
                    </Link>
                ))}
            </nav>

            {licences.length > 1 ? (
                <nav className="row mb-4" aria-label="Filter by licence level">
                    <span className="small muted">Licence</span>
                    <Link href={withParams(without('licence'))} className={`btn btn--sm ${!licenceFilter ? 'btn--gold' : 'btn--ghost'}`}>Any</Link>
                    {licences.map((l) => (
                        <Link key={l} href={withParams({ ...without('licence'), licence: l })} className={`btn btn--sm ${licenceFilter === l ? 'btn--gold' : 'btn--ghost'}`}>{l.replace(/-/g, ' ')}</Link>
                    ))}
                </nav>
            ) : null}

            {positions.length > 1 ? (
                <nav className="row mb-4" aria-label="Filter by position">
                    <span className="small muted">Position</span>
                    <Link href={withParams(without('position'))} className={`btn btn--sm ${!positionFilter ? 'btn--gold' : 'btn--ghost'}`}>Any</Link>
                    {positions.map((p) => (
                        <Link key={p} href={withParams({ ...without('position'), position: p })} className={`btn btn--sm ${positionFilter === p ? 'btn--gold' : 'btn--ghost'}`}>{positionTitle(p)}</Link>
                    ))}
                </nav>
            ) : null}

            <nav className="row mb-4" aria-label="Filter by originating environment">
                <span className="small muted">Source</span>
                <Link href={withParams(without('env'))} className={`btn btn--sm ${scope === 'production' ? 'btn--gold' : 'btn--ghost'}`}>Production only</Link>
                <Link href={withParams({ ...keep, env: 'all' })} className={`btn btn--sm ${scope === 'all' ? 'btn--gold' : 'btn--ghost'}`}>Include preview &amp; local</Link>
            </nav>

            {candidates.length ? (
                <div className="card table-wrap">
                    <table>
                        <thead><tr><th>Received</th><th>Reference</th><th>Candidate</th><th>Position</th><th>Licence</th><th>Service</th><th>Stage</th><th>Stage since</th></tr></thead>
                        <tbody>
                            {candidates.map((c) => (
                                <tr key={c.id} className="is-link">
                                    <td className="mono small">{fmtDateTime(c.created_at)}</td>
                                    <td className="mono small">{c.ref_code}</td>
                                    <td><Link href={`/portal/candidates/${c.id}`}>{c.full_name}</Link></td>
                                    <td className="small">{positionTitle(c.position_id)}</td>
                                    <td className="small">{c.license_level.replace(/-/g, ' ')}</td>
                                    <td className="small">{c.service_branch ?? '—'}</td>
                                    <td><Badge status={c.vetting_stage}>{vettingStageLabel(c.vetting_stage)}</Badge></td>
                                    <td className="mono small">{fmtDateTime(c.stage_changed_at)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <Empty>No applications{stageFilter ? ` at ${vettingStageLabel(stageFilter)}` : ''} yet.</Empty>
            )}
        </>
    );
}
