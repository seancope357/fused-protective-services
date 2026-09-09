import { Field } from '@/components/ui';
import { armedLevels, divisions } from '@/lib/shared';
import { isoToLocal } from '@/lib/actions/util';
import type { Client, Job, Site } from '@/lib/db/types';

export function JobFields({ job, clients, sites, clientId }: { job?: Job | null; clients: Client[]; sites: Site[]; clientId?: string | null }) {
    const j = job;
    return (
        <div className="form-grid">
            <Field id="title" label="Title" className="span-2"><input id="title" name="title" defaultValue={j?.title ?? ''} required placeholder="Friday door detail — The Rooftop" /></Field>
            <Field id="client_id" label="Client">
                <select id="client_id" name="client_id" defaultValue={j?.client_id ?? clientId ?? ''} required>
                    <option value="">Choose a client…</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </Field>
            <Field id="site_id" label="Site">
                <select id="site_id" name="site_id" defaultValue={j?.site_id ?? ''}>
                    <option value="">No site</option>
                    {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </Field>
            <Field id="division_quote_value" label="Division">
                <select id="division_quote_value" name="division_quote_value" defaultValue={j?.division_quote_value ?? divisions[6].quoteValue}>
                    {divisions.map((d) => <option key={d.id} value={d.quoteValue}>{d.heading}</option>)}
                </select>
            </Field>
            <Field id="deposit_pct" label="Deposit %"><input id="deposit_pct" name="deposit_pct" type="number" min={0} max={100} step={1} defaultValue={j?.deposit_pct ?? 0} /></Field>
            <Field id="starts_at" label="First shift starts" hint="Central time"><input id="starts_at" name="starts_at" type="datetime-local" defaultValue={isoToLocal(j?.starts_at)} required /></Field>
            <Field id="ends_at" label="First shift ends"><input id="ends_at" name="ends_at" type="datetime-local" defaultValue={isoToLocal(j?.ends_at)} required /></Field>
            <Field id="recurrence_rule" label="Recurrence (standing details)" hint="RRULE subset, e.g. FREQ=WEEKLY;BYDAY=FR,SA — leave blank for a one-off.">
                <input id="recurrence_rule" name="recurrence_rule" defaultValue={j?.recurrence_rule ?? ''} placeholder="FREQ=WEEKLY;BYDAY=FR,SA" />
            </Field>
            <Field id="recurrence_until" label="Recurs until"><input id="recurrence_until" name="recurrence_until" type="date" defaultValue={j?.recurrence_until ?? ''} /></Field>
            {!j ? (
                <>
                    <Field id="officers_required" label="Officers per shift"><input id="officers_required" name="officers_required" type="number" min={1} step={1} defaultValue={2} /></Field>
                    <Field id="armed_level" label="Armed level">
                        <select id="armed_level" name="armed_level" defaultValue="level-3">{armedLevels.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select>
                    </Field>
                    <Field id="bill_rate" label="Bill rate $/hr"><input id="bill_rate" name="bill_rate" type="number" min={0} step={0.01} defaultValue={(armedLevels[1].rateCents! / 100).toFixed(2)} /></Field>
                </>
            ) : null}
            <Field id="arrival_window" label="Arrival window (in the brief)"><input id="arrival_window" name="arrival_window" defaultValue={j?.arrival_window ?? 'Officers arrive 30 minutes before start'} /></Field>
            <Field id="onsite_contact_name" label="On-site contact"><input id="onsite_contact_name" name="onsite_contact_name" defaultValue={j?.onsite_contact_name ?? ''} /></Field>
            <Field id="onsite_contact_phone" label="On-site contact phone"><input id="onsite_contact_phone" name="onsite_contact_phone" type="tel" defaultValue={j?.onsite_contact_phone ?? ''} /></Field>
            <Field id="client_prep_notes" label="What the client should prepare (in the brief)" className="span-2"><textarea id="client_prep_notes" name="client_prep_notes" rows={3} defaultValue={j?.client_prep_notes ?? ''} /></Field>
            <Field id="post_orders" label="Post orders (internal)" className="span-2"><textarea id="post_orders" name="post_orders" rows={4} defaultValue={j?.post_orders ?? ''} /></Field>
        </div>
    );
}
