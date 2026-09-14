import { Field } from '@/components/ui';
import { netTerms, taxDefaults } from '@/lib/shared';
import type { Client } from '@/lib/db/types';

export function ClientFields({ client }: { client?: Client | null }) {
    const c = client;
    return (
        <div className="form-grid">
            <Field id="kind" label="Type"><select id="kind" name="kind" defaultValue={c?.kind ?? 'company'}><option value="company">Company</option><option value="individual">Individual</option></select></Field>
            <Field id="name" label="Name (company or person)"><input id="name" name="name" defaultValue={c?.name ?? ''} required autoComplete="organization" enterKeyHint="next" /></Field>
            <Field id="billing_contact_name" label="Billing contact"><input id="billing_contact_name" name="billing_contact_name" defaultValue={c?.billing_contact_name ?? ''} autoComplete="name" enterKeyHint="next" /></Field>
            <Field id="billing_email" label="Billing email" hint="Proposals, briefs and invoices go here. It is also how the client signs in to their portal."><input id="billing_email" name="billing_email" type="email" defaultValue={c?.billing_email ?? ''} autoComplete="email" enterKeyHint="next" aria-describedby="billing_email-hint" /></Field>
            <Field id="billing_phone" label="Billing phone"><input id="billing_phone" name="billing_phone" type="tel" defaultValue={c?.billing_phone ?? ''} autoComplete="tel" enterKeyHint="next" /></Field>
            <Field id="billing_address_line1" label="Address line 1"><input id="billing_address_line1" name="billing_address_line1" defaultValue={c?.billing_address_line1 ?? ''} autoComplete="address-line1" enterKeyHint="next" /></Field>
            <Field id="billing_address_line2" label="Address line 2"><input id="billing_address_line2" name="billing_address_line2" defaultValue={c?.billing_address_line2 ?? ''} autoComplete="address-line2" enterKeyHint="next" /></Field>
            <Field id="billing_city" label="City"><input id="billing_city" name="billing_city" defaultValue={c?.billing_city ?? ''} autoComplete="address-level2" enterKeyHint="next" /></Field>
            <Field id="billing_state" label="State"><input id="billing_state" name="billing_state" maxLength={2} defaultValue={c?.billing_state ?? 'TX'} autoComplete="address-level1" autoCapitalize="characters" enterKeyHint="next" /></Field>
            <Field id="billing_postal_code" label="ZIP"><input id="billing_postal_code" name="billing_postal_code" defaultValue={c?.billing_postal_code ?? ''} autoComplete="postal-code" inputMode="numeric" enterKeyHint="next" /></Field>
            <Field id="default_net_term_id" label="Default payment terms"><select id="default_net_term_id" name="default_net_term_id" defaultValue={c?.default_net_term_id ?? 'net-30'}>{netTerms.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></Field>
            <Field id="default_tax_rate_pct" label={`${taxDefaults.label} %`} hint="The rate for where this client is billed."><input id="default_tax_rate_pct" name="default_tax_rate_pct" type="number" inputMode="decimal" step={0.001} min={0} max={100} defaultValue={c?.default_tax_rate_pct ?? taxDefaults.defaultRatePct} enterKeyHint="next" aria-describedby="default_tax_rate_pct-hint" /></Field>
            <Field id="tax_jurisdiction" label="Tax jurisdiction"><input id="tax_jurisdiction" name="tax_jurisdiction" defaultValue={c?.tax_jurisdiction ?? 'Austin, TX'} enterKeyHint="next" /></Field>
            <div className="field field--check"><input id="tax_exempt" name="tax_exempt" type="checkbox" defaultChecked={c?.tax_exempt ?? false} /><label htmlFor="tax_exempt">Tax exempt (certificate on file)</label></div>
            <div className="field field--check"><input id="sms_consent" name="sms_consent" type="checkbox" defaultChecked={c?.sms_consent ?? false} /><label htmlFor="sms_consent">Client agreed to text reminders at the billing phone (note how and when below)</label></div>
            <Field id="notes" label="Notes" className="span-2"><textarea id="notes" name="notes" rows={3} defaultValue={c?.notes ?? ''} /></Field>
        </div>
    );
}
