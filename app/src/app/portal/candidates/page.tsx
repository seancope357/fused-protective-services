import Link from 'next/link';
import { PageHead, Badge, Empty, Chips } from '@/components/ui';
import { DataTable, type Column } from '@/components/data-table';
import { fmtDateTime } from '@/lib/format';
import { isVettingStage, positionTitle, vettingPipeline, vettingStageLabel } from '@/lib/shared';
import { listCandidates, sourceEnvScope } from '@/lib/domain/queries';

export const dynamic = 'force-dynamic';

/* Deliberately the same shape as /portal/candidates' sibling, the Leads inbox:
   same filter rows, same source-environment switch, same table. Recruiting and
   sales are two pipelines and one job, and Cameron should not have to learn two
   interfaces to work them. */

type Candidate = Awaited<ReturnType<typeof listCandidates>>[number];

/* On a phone the card is the person, the role they want and where they are in
   vetting. Reference, licence, service branch and stage date wait for a wider
   screen, as the reference and location do on Leads. */
const columns: Column<Candidate>[] = [
    { key: 'received', header: 'Received', cell: (c) => <span className="mono small">{fmtDateTime(c.created_at)}</span> },
    { key: 'ref', header: 'Reference', hide: 'tablet', cell: (c) => <span className="mono small">{c.ref_code}</span> },
    { key: 'candidate', header: 'Candidate', primary: true, cell: (c) => <Link href={`/portal/candidates/${c.id}`}>{c.full_name}</Link> },
    { key: 'position', header: 'Position', cell: (c) => <span className="small">{positionTitle(c.position_id)}</span> },
    { key: 'licence', header: 'Licence', hide: 'phone', cell: (c) => <span className="small">{c.license_level.replace(/-/g, ' ')}</span> },
    { key: 'service', header: 'Service', hide: 'tablet', cell: (c) => <span className="small">{c.service_branch ?? '—'}</span> },
    { key: 'stage', header: 'Stage', cell: (c) => <Badge status={c.vetting_stage}>{vettingStageLabel(c.vetting_stage)}</Badge> },
    { key: 'since', header: 'Stage since', hide: 'phone', cell: (c) => <span className="mono small">{fmtDateTime(c.stage_changed_at)}</span> }
];

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

            <Chips
                label="Filter by vetting stage"
                items={[
                    { href: withParams(without('stage')), label: 'All', active: !stageFilter },
                    ...vettingPipeline.map((s) => ({ href: withParams({ ...without('stage'), stage: s.id }), label: s.label, active: stageFilter === s.id }))
                ]}
            />

            {licences.length > 1 ? (
                <Chips
                    label="Filter by licence level"
                    caption="Licence"
                    items={[
                        { href: withParams(without('licence')), label: 'Any', active: !licenceFilter },
                        ...licences.map((l) => ({ href: withParams({ ...without('licence'), licence: l }), label: l.replace(/-/g, ' '), active: licenceFilter === l }))
                    ]}
                />
            ) : null}

            {positions.length > 1 ? (
                <Chips
                    label="Filter by position"
                    caption="Position"
                    items={[
                        { href: withParams(without('position')), label: 'Any', active: !positionFilter },
                        ...positions.map((p) => ({ href: withParams({ ...without('position'), position: p }), label: positionTitle(p), active: positionFilter === p }))
                    ]}
                />
            ) : null}

            <Chips
                label="Filter by originating environment"
                caption="Source"
                items={[
                    { href: withParams(without('env')), label: 'Production only', active: scope === 'production' },
                    { href: withParams({ ...keep, env: 'all' }), label: 'Include preview & local', active: scope === 'all' }
                ]}
            />

            {candidates.length ? (
                <DataTable caption="Candidates" columns={columns} rows={candidates} rowKey={(c) => c.id} />
            ) : (
                <Empty>No applications{stageFilter ? ` at ${vettingStageLabel(stageFilter)}` : ''} yet.</Empty>
            )}
        </>
    );
}
