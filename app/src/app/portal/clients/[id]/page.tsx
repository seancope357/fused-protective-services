import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getClient, listSites } from '@/lib/domain/queries';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { PageHead, Field, Badge, Money, LinkButton, Disclosure } from '@/components/ui';
import { DataTable, type Column } from '@/components/data-table';
import { StatusFromSearch, type SearchStatus } from '@/components/status-from-search';
import { ClientFields } from '@/components/client-form';
import { updateClient, saveSite, invitePortalUser } from '@/lib/actions/clients';
import { fmtDate, fmtDateTime } from '@/lib/format';
import type { Site } from '@/lib/db/types';
import { timelineFor } from '@/lib/domain/timeline';
import { Timeline } from '@/components/timeline';

export const dynamic = 'force-dynamic';

const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;

function SiteForm({ clientId, site }: { clientId: string; site?: Site }) {
    const s = site;
    const p = s ? s.id.slice(0, 6) : 'new';
    return (
        <form action={saveSite} className="form-grid">
            <input type="hidden" name="client_id" value={clientId} />
            {s ? <input type="hidden" name="id" value={s.id} /> : null}
            <Field id={`${p}-name`} label="Site name"><input id={`${p}-name`} name="name" defaultValue={s?.name ?? ''} required placeholder="The Rooftop — 6th Street" enterKeyHint="next" /></Field>
            <Field id={`${p}-a1`} label="Address"><input id={`${p}-a1`} name="address_line1" defaultValue={s?.address_line1 ?? ''} autoComplete="address-line1" enterKeyHint="next" /></Field>
            <Field id={`${p}-a2`} label="Address line 2 (optional)"><input id={`${p}-a2`} name="address_line2" defaultValue={s?.address_line2 ?? ''} autoComplete="address-line2" enterKeyHint="next" /></Field>
            <Field id={`${p}-city`} label="City"><input id={`${p}-city`} name="city" defaultValue={s?.city ?? ''} autoComplete="address-level2" enterKeyHint="next" /></Field>
            <Field id={`${p}-zip`} label="ZIP"><input id={`${p}-zip`} name="postal_code" defaultValue={s?.postal_code ?? ''} autoComplete="postal-code" inputMode="numeric" enterKeyHint="next" /></Field>
            <Field id={`${p}-cn`} label="On-site contact"><input id={`${p}-cn`} name="onsite_contact_name" defaultValue={s?.onsite_contact_name ?? ''} autoComplete="name" enterKeyHint="next" /></Field>
            <Field id={`${p}-cp`} label="On-site phone"><input id={`${p}-cp`} name="onsite_contact_phone" type="tel" defaultValue={s?.onsite_contact_phone ?? ''} autoComplete="tel" enterKeyHint="next" /></Field>
            <Field id={`${p}-tax`} label="Tax % for this site" hint="Leave blank to use the client's rate."><input id={`${p}-tax`} name="tax_rate_pct" type="number" inputMode="decimal" step={0.001} min={0} defaultValue={s?.tax_rate_pct ?? ''} enterKeyHint="next" aria-describedby={`${p}-tax-hint`} /></Field>
            <Field id={`${p}-access`} label="Access notes" className="span-2"><textarea id={`${p}-access`} name="access_notes" rows={2} defaultValue={s?.access_notes ?? ''} placeholder="Staff entrance on Trinity; manager opens at 7pm." /></Field>
            <Field id={`${p}-park`} label="Parking"><input id={`${p}-park`} name="parking_notes" defaultValue={s?.parking_notes ?? ''} enterKeyHint="next" /></Field>
            <Field id={`${p}-gear`} label="Gear notes"><input id={`${p}-gear`} name="gear_notes" defaultValue={s?.gear_notes ?? ''} placeholder="Plainclothes; radios on channel 3" enterKeyHint="done" /></Field>
            <input type="hidden" name="state" value={s?.state ?? 'TX'} />
            <div className="row span-2"><button className="btn btn--ghost" type="submit">{s ? 'Save site' : 'Add site'}</button></div>
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

    const events = await timelineFor({ entityType: 'client', id, related: [...(quotes ?? []).map((q) => ({ entityType: 'quote', id: q.id })), ...(jobs ?? []).map((j) => ({ entityType: 'job', id: j.id })), ...(invoices ?? []).map((i) => ({ entityType: 'invoice', id: i.id }))] });

    type JobRow = NonNullable<typeof jobs>[number];
    type QuoteRow = NonNullable<typeof quotes>[number];
    type InvoiceRow = NonNullable<typeof invoices>[number];

    const jobColumns: Column<JobRow>[] = [
        { key: 'job', header: 'Job', primary: true, cell: (j) => <><Link href={`/portal/jobs/${j.id}`}>{j.title}</Link><div className="small muted">{j.job_number}</div></> },
        { key: 'starts', header: 'Starts', cell: (j) => <span className="mono small">{fmtDateTime(j.starts_at)}</span> },
        { key: 'status', header: 'Status', cell: (j) => <Badge status={j.status} /> }
    ];
    const quoteColumns: Column<QuoteRow>[] = [
        { key: 'number', header: 'Quote', primary: true, cell: (q) => <Link href={`/portal/quotes/${q.id}`} className="mono">{q.quote_number}</Link> },
        { key: 'created', header: 'Created', hide: 'phone', cell: (q) => <span className="small">{fmtDate(q.created_at)}</span> },
        { key: 'total', header: 'Total', num: true, cell: (q) => <Money cents={q.total_cents} /> },
        { key: 'status', header: 'Status', cell: (q) => <Badge status={q.status} /> }
    ];
    const invoiceColumns: Column<InvoiceRow>[] = [
        { key: 'number', header: 'Invoice', primary: true, cell: (i) => <Link href={`/portal/invoices/${i.id}`} className="mono">{i.invoice_number}</Link> },
        { key: 'total', header: 'Total', num: true, cell: (i) => <Money cents={i.total_cents} /> },
        { key: 'paid', header: 'Paid', num: true, hide: 'phone', cell: (i) => <Money cents={i.amount_paid_cents} /> },
        { key: 'status', header: 'Status', cell: (i) => <Badge status={i.status} /> }
    ];

    return (
        <>
            {/* New quote is the primary action: it is how work with a client starts,
                and an accepted quote becomes the job. A direct job is secondary. */}
            <PageHead
                eyebrow="Client"
                title={client.name}
                primary={<Link href={`/portal/quotes/new?client=${id}`} className="btn btn--gold">New quote</Link>}
                actions={<LinkButton href={`/portal/jobs/new?client=${id}`}>New job</LinkButton>}
            >
                {client.billing_contact_name ?? 'No billing contact'} · {client.billing_email ? <a href={`mailto:${client.billing_email}`}>{client.billing_email}</a> : 'no email'} · {client.billing_phone ? <a href={telHref(client.billing_phone)}>{client.billing_phone}</a> : 'no phone'}
            </PageHead>
            <StatusFromSearch params={await searchParams} />

            <div className="stack mt-4">
                <section className="card">
                    <h2 className="mb-2">Sites</h2>
                    <div className="stack">
                        {sites.map((s) => (
                            <Disclosure key={s.id} className="card" summary={<span className="wrap-anywhere"><strong>{s.name}</strong> <span className="small muted">{[s.address_line1, s.city].filter(Boolean).join(', ')}</span></span>}>
                                <SiteForm clientId={id} site={s} />
                            </Disclosure>
                        ))}
                        <Disclosure className="card" summary="Add a site"><SiteForm clientId={id} /></Disclosure>
                    </div>
                </section>

                <section className="card">
                    <div className="card__title"><h2>Jobs</h2></div>
                    {jobs?.length ? <DataTable caption={`Jobs for ${client.name}`} columns={jobColumns} rows={jobs} rowKey={(j) => j.id} flush /> : <p className="small muted">No jobs yet.</p>}
                </section>

                <section className="card">
                    <div className="card__title"><h2>Quotes</h2></div>
                    {quotes?.length ? <DataTable caption={`Quotes for ${client.name}`} columns={quoteColumns} rows={quotes} rowKey={(q) => q.id} flush /> : <p className="small muted">No quotes yet.</p>}
                </section>

                <section className="card">
                    <div className="card__title"><h2>Invoices</h2></div>
                    {invoices?.length ? <DataTable caption={`Invoices for ${client.name}`} columns={invoiceColumns} rows={invoices} rowKey={(i) => i.id} flush /> : <p className="small muted">No invoices yet.</p>}
                </section>

                <section className="card">
                    <div className="card__title"><h2>Client portal</h2></div>
                    {users && users.length ? <p className="small wrap-anywhere">{users.map((u) => u.email).join(', ')} can sign in to see proposals, briefs and invoices (since {fmtDateTime(users[0].created_at)}).</p> : <p className="small">Nobody from this client can sign in yet.</p>}
                    <form action={invitePortalUser} className="mt-2"><input type="hidden" name="client_id" value={id} /><button className="btn btn--ghost btn--sm" type="submit">{users && users.length ? 'Send a fresh sign-in link' : 'Invite the billing contact'}</button></form>
                </section>

                <Disclosure className="card" summary="Edit client details">
                    <form action={updateClient} className="stack mt-2">
                        <input type="hidden" name="id" value={id} />
                        <ClientFields client={client} />
                        <p className="small muted">Text reminders: {client.sms_consent ? `consent recorded ${fmtDateTime(client.sms_consent_at)}` : 'no consent recorded'}{client.sms_opted_out_at ? ` · they replied STOP on ${fmtDateTime(client.sms_opted_out_at)}` : ''}</p>
                        <div className="row"><button className="btn btn--gold" type="submit">Save client</button></div>
                    </form>
                </Disclosure>

                <Timeline events={events} />
            </div>
        </>
    );
}
