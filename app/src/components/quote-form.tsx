import { Field } from '@/components/ui';
import { armedLevels, divisions, taxDefaults } from '@/lib/shared';
import { isoToLocal } from '@/lib/actions/util';
import type { Client, Quote, Site } from '@/lib/db/types';

/** Shared by /portal/quotes/new and the quote editor. Plain server-rendered form.
    Numbers carry an inputMode so a phone opens the right keypad: whole numbers
    for officer counts, decimals for hours, money and percentages. autoComplete
    is off on them because a browser's remembered values are never a price. */
export function QuoteFields({ quote, clients, sites, clientId, defaultTaxRate }: { quote?: Quote | null; clients: Client[]; sites: Site[]; clientId?: string | null; defaultTaxRate?: number }) {
    const q = quote;
    const rateDollars = q ? (q.bill_rate_cents / 100).toFixed(2) : (armedLevels[1].rateCents! / 100).toFixed(2);
    return (
        <div className="form-grid">
            <Field id="client_id" label="Client">
                <select id="client_id" name="client_id" defaultValue={q?.client_id ?? clientId ?? ''} required>
                    <option value="">Choose a client…</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </Field>
            <Field id="site_id" label="Site (optional)" hint="Sites belong to the chosen client; add one on the client page.">
                <select id="site_id" name="site_id" defaultValue={q?.site_id ?? ''}>
                    <option value="">No site yet</option>
                    {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
            </Field>
            <Field id="division_quote_value" label="Division">
                <select id="division_quote_value" name="division_quote_value" defaultValue={q?.division_quote_value ?? divisions[2].quoteValue}>
                    {divisions.map((d) => <option key={d.id} value={d.quoteValue}>{d.heading}</option>)}
                </select>
            </Field>
            <Field id="armed_level" label="Armed level">
                <select id="armed_level" name="armed_level" defaultValue={q?.armed_level ?? 'level-3'}>
                    {armedLevels.map((l) => <option key={l.id} value={l.id}>{l.label}{l.rateCents ? ` · $${l.rateCents / 100}/hr` : ''}</option>)}
                </select>
            </Field>
            <Field id="officer_count" label="Officers"><input id="officer_count" name="officer_count" type="number" inputMode="numeric" autoComplete="off" enterKeyHint="done" min={1} step={1} defaultValue={q?.officer_count ?? 2} required /></Field>
            <Field id="hours" label="Hours (total per officer)"><input id="hours" name="hours" type="number" inputMode="decimal" autoComplete="off" enterKeyHint="done" min={0.5} step={0.5} defaultValue={q?.hours ?? 8} required /></Field>
            <Field id="bill_rate" label="Hourly bill rate ($)" hint="Starts at the published rate; change it for a negotiated price."><input id="bill_rate" name="bill_rate" type="number" inputMode="decimal" autoComplete="off" enterKeyHint="done" min={0} step={0.01} defaultValue={rateDollars} required /></Field>
            <Field id="tax_rate_pct" label={`${taxDefaults.label} %`}><input id="tax_rate_pct" name="tax_rate_pct" type="number" inputMode="decimal" autoComplete="off" enterKeyHint="done" min={0} max={100} step={0.001} defaultValue={q?.tax_rate_pct ?? defaultTaxRate ?? taxDefaults.defaultRatePct} /></Field>
            <Field id="deposit_pct" label="Deposit %" hint="0 for none. You can send a deposit invoice from the job."><input id="deposit_pct" name="deposit_pct" type="number" inputMode="decimal" autoComplete="off" enterKeyHint="done" min={0} max={100} step={1} defaultValue={q?.deposit_pct ?? 0} /></Field>
            <Field id="valid_until" label="Valid until"><input id="valid_until" name="valid_until" type="date" defaultValue={q?.valid_until ?? ''} /></Field>
            <Field id="starts_at" label="Coverage starts" hint="Central time"><input id="starts_at" name="starts_at" type="datetime-local" defaultValue={isoToLocal(q?.starts_at)} /></Field>
            <Field id="ends_at" label="Coverage ends" hint="Central time"><input id="ends_at" name="ends_at" type="datetime-local" defaultValue={isoToLocal(q?.ends_at)} /></Field>
            <Field id="notes" label="Internal notes" hint="Only your team sees these." className="span-2"><textarea id="notes" name="notes" rows={4} defaultValue={q?.notes ?? ''} /></Field>
        </div>
    );
}
