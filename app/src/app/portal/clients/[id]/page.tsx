import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getClient, listSites } from '@/lib/domain/queries';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHead, Field, Badge, Money, LinkButton } from '@/components/ui';
import { StatusFromSearch, type SearchStatus } from '@/components/status-from-search';
import { ClientFields } from '@/components/client-form';
import { updateClient, saveSite, invitePortalUser } from '@/lib/actions/clients';
import { fmtDateTime } from '@/lib/format';
import type { Site } from '@/lib/db/types';

export const dynamic = 'force-dynamic';

function SiteForm({ clientId, site }: { clientId: string; site?: Site }) {
    const s = site;
    const p = s ? s.id.slice(0, 6) : 'new';
    return (
        <form action={saveSite} className="form-grid">
            <input type="hidden" name="client_id" value={clientId} />
            {s ? <input type="hidden" name="id" value={s.id} /> : null}
            <Field id={`${p}-name`} label="Site name"><input id={`${p}-name`} name="name" defaultValue={s?.name ?? ''} required placeholder="The Rooftop — 6th Street" /></Field>
            <Field id={`${p}-a1`} label="Address"><input id={`${p}-a1`} name="address_line1" defaultValue={s?.address_line1 ?? ''} /></Field>
            <Field id={`${p}-city`} label="City"><input id={`${p}-city`} name="city" defaultValue={s?.city ?? ''} /></Field>
            <Field id={`${p}-zip`} label="ZIP"><input id={`${p}-zip`} name="postal_code" defaultValue={s?.postal_code ?? ''} /></Field>
            <Field id={`${p}-cn`} label="On-site contact"><input id={`${p}-cn`} name="onsite_contact_name" defaultValue={s?.onsite_contact_name ?? ''} /></Field>
            <Field id={`${p}-cp`} label="On-site phone"><input id={`${p}-cp`} name="onsite_contact_phone" type="tel" defaultValue={s?.onsite_contact_phone ?? ''} /></Field>
            <Field id={`${p}-tax`} label="Tax % override" hint="Blank uses the client default."><input id={`${p}-tax`} name="tax_rate_pct" type="number" step={0.001} min={0} defaultValue={s?.tax_rate_pct ?? ''} /></Field>
            <Field id={`${p}-access`} label="Access notes" className="span-2"><textarea id={`${p}-access`} name="access_notes" rows={2} defaultValue={s?.access_notes ?? ''} placeholder="Staff entrance on Trinity; manager opens at 7pm." /></Field>
            <Field id={`${p}-park`} label="Parking"><input id={`${p}-park`} name="parking_notes" defaultValue={s?.parking_notes ?? ''} /></Field>
            <Field id={`${p}-gear`} label="Gear notes"><input id={`${p}-gear`} name="gear_notes" defaultValue={s?.gear_notes ?? ''} placeholder="Plainclothes; radios on channel 3" /></Field>
            <input type="hidden" name="state" value={s?.state ?? 'TX'} />
            <div className="row"><button className="btn btn--ghost" type="submit">{s ? 'Save site' : 'Add site'}</button></div>
        </form>
    );
}

export default async function ClientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchStatus> }) {
    const { id } = await params;
    const client = await getClient(id);
    if (!client) notFound();
    const supabase = await createSupabaseServerClient();
    const [sites, { data: quotes }, { data: jobs }, { data: invoices }, { data: users }] = await Promise.all([
        listSites(id),
        supabase.from('quotes').select('id, quote_number, status, total_cents, created_at').eq('client_id', id).order('created_at', { ascending: false }).limit(20),
        supabase.from('jobs').select('id, job_number, title, status, starts_at').eq('client_id', id).order('starts_at', { ascending: false }).limit(20),
        supabase.from('invoices').select('id, invoice_number, status, total_cents, amount_paid_cents').eq('client_id', id).order('created_at', { ascending: false }).limit(20),
        supabase.from('profiles').select('email, created_at').eq('client_id', id)
    ]);

    return (
        <>
            <PageHead eyebrow="Client" title={client.name} actions={<><LinkButton href={`/portal/quotes/new?client=${id}`} variant="gold">New quote</LinkButton><LinkButton href={`/portal/jobs/new?client=${id}`}>New job</LinkButton></>}>
                {client.billing_contact_name} · {client.billing_email ?? 'no email'} · {client.billing_phone ?? 'no phone'}
            </PageHead>
            <StatusFromSearch params={await searchParams} />

            <div className="grid grid--2 mt-4" style={{ alignItems: 'start' }}>
                <div className="stack">
                    <section className="card">
                        <div className="card__title"><h2>Portal access</h2></div>
                        {users && users.length ? <p className="small">Signed-in access for {users.map((u) => u.email).join(', ')} (since {fmtDateTime(users[0].created_at)}).</p> : <p className="small">No portal user yet.</p>}
                        <form action={invitePortalUser} className="mt-2"><input type="hidden" name="client_id" value={id} /><button className="btn btn--ghost btn--sm" type="submit">{users && users.length ? 'Send a fresh sign-in link' : 'Invite billing contact to the portal'}</button></form>
                    </section>
                    <section className="card">
                        <h2 className="mb-4">Sites</h2>
                        <div className="stack">
                            {sites.map((s) => <details key={s.id} className="card"><summary style={{ cursor: 'pointer' }}><strong>{s.name}</strong> <span className="small muted">{[s.address_line1, s.city].filter(Boolean).join(', ')}</span></summary><div className="mt-4"><SiteForm clientId={id} site={s} /></div></details>)}
                            <details className="card"><summary style={{ cursor: 'pointer' }}>Add a site</summary><div className="mt-4"><SiteForm clientId={id} /></div></details>
                        </div>
                    </section>
                    <section className="card">
                        <h2 className="mb-4">History</h2>
                        <div className="stack small">
                            <div><strong>Quotes</strong> {quotes?.length ? quotes.map((q) => <span key={q.id}> · <Link href={`/portal/quotes/${q.id}`}>{q.quote_number}</Link> <Badge status={q.status} /></span>) : ' — none'}</div>
                            <div><strong>Jobs</strong> {jobs?.length ? jobs.map((j) => <span key={j.id}> · <Link href={`/portal/jobs/${j.id}`}>{j.job_number}</Link> <Badge status={j.status} /></span>) : ' — none'}</div>
                            <div><strong>Invoices</strong> {invoices?.length ? invoices.map((i) => <span key={i.id}> · <Link href={`/portal/invoices/${i.id}`}>{i.invoice_number}</Link> <Money cents={i.total_cents} /> <Badge status={i.status} /></span>) : ' — none'}</div>
                        </div>
                    </section>
                </div>
                <form action={updateClient} className="card stack">
                    <input type="hidden" name="id" value={id} />
                    <h2>Details</h2>
                    <ClientFields client={client} />
                    <p className="small muted">SMS consent {client.sms_consent ? `recorded ${fmtDateTime(client.sms_consent_at)}` : 'not recorded'}{client.sms_opted_out_at ? ` · opted out ${fmtDateTime(client.sms_opted_out_at)} (STOP)` : ''}</p>
                    <div className="row"><button className="btn btn--gold" type="submit">Save client</button></div>
                </form>
            </div>
        </>
    );
}
