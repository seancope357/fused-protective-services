import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLead } from '@/lib/domain/queries';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHead, Badge, Field } from '@/components/ui';
import { StatusFromSearch, type SearchStatus } from '@/components/status-from-search';
import { updateLeadStatus, convertLeadToQuote, markLeadResponded } from '@/lib/actions/leads';
import { fmtDateTime } from '@/lib/format';
import { divisionByQuoteValue } from '@/lib/shared';
import { timelineFor } from '@/lib/domain/timeline';
import { Timeline } from '@/components/timeline';

export const dynamic = 'force-dynamic';

const STAGES = ['new', 'contacted', 'audit_scheduled', 'proposal_sent', 'dispatched', 'closed_won', 'closed_lost'];

export default async function LeadPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchStatus> }) {
    const { id } = await params;
    const lead = await getLead(id);
    if (!lead) notFound();
    const supabase = await createSupabaseServerClient();
    const { data: quotes } = await supabase.from('quotes').select('id, quote_number, status, total_cents').eq('source_quote_id', id);
    const division = divisionByQuoteValue(lead.service_division);
    const events = await timelineFor({ entityType: 'client_quote', id, related: (quotes ?? []).map((q) => ({ entityType: 'quote', id: q.id })) });

    return (
        <>
            <PageHead eyebrow={`Lead ${lead.ref_code}`} title={lead.company ? `${lead.company} — ${lead.full_name}` : lead.full_name}
                actions={
                    <>
                        <a className="btn btn--ghost" href={`tel:${lead.phone}`}>Call {lead.phone}</a>
                        <a className="btn btn--ghost" href={`mailto:${lead.email}`}>Email</a>
                        {quotes && quotes.length ? (
                            <Link className="btn btn--gold" href={`/portal/quotes/${quotes[0].id}`}>Open quote {quotes[0].quote_number}</Link>
                        ) : (
                            <form action={convertLeadToQuote}><input type="hidden" name="id" value={lead.id} /><button className="btn btn--gold" type="submit">Convert to quote</button></form>
                        )}
                    </>
                }>
                Received {fmtDateTime(lead.created_at)} · <Badge status={lead.priority} /> · <Badge status={lead.status} />
                {lead.status === 'new' && !lead.first_response_at ? ' · not yet responded' : ''}
            </PageHead>
            <StatusFromSearch params={await searchParams} />

            <div className="grid grid--2 mt-4">
                <section className="card">
                    <h2 className="mb-4">Request</h2>
                    <dl className="kv">
                        <dt>Division</dt><dd>{division?.heading ?? lead.service_division}</dd>
                        <dt>Armed</dt><dd>{lead.armed_preference}</dd>
                        <dt>Location</dt><dd>{lead.deployment_location}</dd>
                        <dt>Schedule</dt><dd>{lead.schedule}</dd>
                        <dt>Notes</dt><dd>{lead.notes ?? '—'}</dd>
                        <dt>Phone</dt><dd>{lead.phone}</dd>
                        <dt>Email</dt><dd>{lead.email}</dd>
                        <dt>SMS consent</dt><dd>{lead.sms_consent ? `Yes, ${fmtDateTime(lead.sms_consent_at)}` : 'No'}</dd>
                    </dl>
                </section>
                <section className="card stack">
                    <h2>Pipeline</h2>
                    <form action={updateLeadStatus} className="stack">
                        <input type="hidden" name="id" value={lead.id} />
                        <Field id="status" label="Stage">
                            <select id="status" name="status" defaultValue={lead.status}>
                                {STAGES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                            </select>
                        </Field>
                        <button className="btn btn--ghost" type="submit">Update stage</button>
                    </form>
                    {lead.status === 'new' ? (
                        <form action={markLeadResponded}><input type="hidden" name="id" value={lead.id} /><button className="btn btn--ghost btn--sm" type="submit">I have responded (stops the 2-hour alert)</button></form>
                    ) : null}
                    {lead.client_id ? <p className="small"><Link href={`/portal/clients/${lead.client_id}`}>Open client record →</Link></p> : null}
                </section>
                <div style={{ gridColumn: '1 / -1' }}><Timeline events={events} /></div>
            </div>
        </>
    );
}
