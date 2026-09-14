import Link from 'next/link';
import { PageHead, Badge, Empty, Chips } from '@/components/ui';
import { DataTable, type Column } from '@/components/data-table';
import { fmtDateTime, statusLabel, titleCase } from '@/lib/format';
import { divisionByQuoteValue } from '@/lib/shared';
import { listLeads, sourceEnvScope } from '@/lib/domain/queries';

export const dynamic = 'force-dynamic';

const STAGES = ['new', 'contacted', 'audit_scheduled', 'proposal_sent', 'dispatched', 'closed_won', 'closed_lost'];

type Lead = Awaited<ReturnType<typeof listLeads>>[number];

/* Desktop keeps the order an operator scans in; on a phone the contact is the
   card title and the reference and location wait for a wider screen. */
const columns: Column<Lead>[] = [
    { key: 'received', header: 'Received', cell: (l) => <span className="mono small">{fmtDateTime(l.created_at)}</span> },
    { key: 'ref', header: 'Reference', hide: 'tablet', cell: (l) => <span className="mono small">{l.ref_code}</span> },
    {
        key: 'contact',
        header: 'Contact',
        primary: true,
        cell: (l) => (
            <>
                <Link href={`/portal/leads/${l.id}`}>{l.full_name}</Link>
                {l.company ? <div className="small muted">{l.company}</div> : null}
            </>
        )
    },
    { key: 'division', header: 'Division', hide: 'phone', cell: (l) => <span className="small">{divisionByQuoteValue(l.service_division)?.heading ?? l.service_division}</span> },
    { key: 'location', header: 'Location', hide: 'tablet', cell: (l) => <span className="small">{l.deployment_location}</span> },
    { key: 'priority', header: 'Priority', cell: (l) => <Badge status={l.priority} /> },
    { key: 'stage', header: 'Stage', cell: (l) => <Badge status={l.status} /> }
];

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
    const keepEnv: Record<string, string> = scope === 'all' ? { env: 'all' } : {};
    const keepStage: Record<string, string> = stageFilter ? { stage: stageFilter } : {};

    return (
        <>
            <PageHead eyebrow="Inbox" title="Leads">Every request from the website, newest first. Open one to call back or turn it into a quote.</PageHead>
            <Chips
                label="Filter by stage"
                items={[
                    { href: withStage(keepEnv), label: 'All', active: !stageFilter },
                    ...STAGES.map((s) => ({ href: withStage({ stage: s, ...keepEnv }), label: titleCase(statusLabel(s)), active: stageFilter === s }))
                ]}
            />
            <Chips
                label="Filter by originating environment"
                caption="Source"
                items={[
                    { href: withStage(keepStage), label: 'Production only', active: scope === 'production' },
                    { href: withStage({ ...keepStage, env: 'all' }), label: 'Include preview & local', active: scope === 'all' }
                ]}
            />
            {leads.length ? (
                <DataTable caption="Leads" columns={columns} rows={leads} rowKey={(l) => l.id} />
            ) : (
                <Empty>No leads{stageFilter ? ` in ${statusLabel(stageFilter)}` : ''} yet.</Empty>
            )}
        </>
    );
}
