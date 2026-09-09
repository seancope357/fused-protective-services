import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHead, Badge, Empty } from '@/components/ui';
import { fmtDateTime } from '@/lib/format';
import { divisionByQuoteValue } from '@/lib/shared';
import type { Lead } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

const STAGES = ['new', 'contacted', 'audit_scheduled', 'proposal_sent', 'dispatched', 'closed_won', 'closed_lost'];

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ stage?: string }> }) {
    const { stage } = await searchParams;
    const supabase = await createSupabaseServerClient();
    let query = supabase.from('client_quotes').select('*').order('created_at', { ascending: false }).limit(200);
    if (stage && STAGES.includes(stage)) query = query.eq('status', stage);
    const { data } = await query;
    const leads = (data ?? []) as Lead[];

    return (
        <>
            <PageHead eyebrow="Inbox" title="Leads">Every request from the website, newest first. One click converts a lead to a draft quote.</PageHead>
            <nav className="row mb-4" aria-label="Filter by stage">
                <Link href="/portal/leads" className={`btn btn--sm ${!stage ? 'btn--gold' : 'btn--ghost'}`}>All</Link>
                {STAGES.map((s) => (
                    <Link key={s} href={`/portal/leads?stage=${s}`} className={`btn btn--sm ${stage === s ? 'btn--gold' : 'btn--ghost'}`}>{s.replace('_', ' ')}</Link>
                ))}
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
