import { Field } from '@/components/ui';
import { netTerms, taxDefaults } from '@/lib/shared';
import type { Client } from '@/lib/db/types';

export function ClientFields({ client }: { client?: Client | null }) {
    const c = client;
    return (
        <div className="form-grid">
            <Field id="kind" label="Type"><select id="kind" name="kind" defaultValue={c?.kind ?? 'company'}><option value="company">Company</option><option value="individual">Individual</option></select></Field>
            <Field id="name" label="Name (company or person)"><input id="name" name="name" defaultValue={c?.name ?? ''} required /></Field>
            <Field id="billing_contact_name" label="Billing contact"><input id="billing_contact_name" name="billing_contact_name" defaultValue={c?.billing_contact_name ?? ''} /></Field>
            <Field id="billing_email" label="Billing email" hint="Proposals, briefs and invoices go here; it is also the portal sign-in."><input id="billing_email" name="billing_email" type="email" defaultValue={c?.billing_email ?? ''} /></Field>
            <Field id="billing_phone" label="Billing phone"><input id="billing_phone" name="billing_phone" type="tel" defaultValue={c?.billing_phone ?? ''} /></Field>
            <Field id="billing_address_line1" label="Address line 1"><input id="billing_address_line1" name="billing_address_line1" defaultValue={c?.billing_address_line1 ?? ''} /></Field>
            <Field id="billing_address_line2" label="Address line 2"><input id="billing_address_line2" name="billing_address_line2" defaultValue={c?.billing_address_line2 ?? ''} /></Field>
            <Field id="billing_city" label="City"><input id="billing_city" name="billing_city" defaultValue={c?.billing_city ?? ''} /></Field>
            <Field id="billing_state" label="State"><input id="billing_state" name="billing_state" maxLength={2} defaultValue={c?.billing_state ?? 'TX'} /></Field>
            <Field id="billing_postal_code" label="ZIP"><input id="billing_postal_code" name="billing_postal_code" defaultValue={c?.billing_postal_code ?? ''} /></Field>
            <Field id="default_net_term_id" label="Default terms"><select id="default_net_term_id" name="default_net_term_id" defaultValue={c?.default_net_term_id ?? 'net-30'}>{netTerms.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></Field>
            <Field id="default_tax_rate_pct" label={`${taxDefaults.label} % (jurisdiction)`}><input id="default_tax_rate_pct" name="default_tax_rate_pct" type="number" step={0.001} min={0} max={100} defaultValue={c?.default_tax_rate_pct ?? taxDefaults.defaultRatePct} /></Field>
            <Field id="tax_jurisdiction" label="Tax jurisdiction"><input id="tax_jurisdiction" name="tax_jurisdiction" defaultValue={c?.tax_jurisdiction ?? 'Austin, TX'} /></Field>
            <div className="field field--check"><input id="tax_exempt" name="tax_exempt" type="checkbox" defaultChecked={c?.tax_exempt ?? false} /><label htmlFor="tax_exempt">Tax exempt (certificate on file)</label></div>
            <div className="field field--check"><input id="sms_consent" name="sms_consent" type="checkbox" defaultChecked={c?.sms_consent ?? false} /><label htmlFor="sms_consent">Client has consented to SMS reminders at the billing phone (record how and when in notes)</label></div>
            <Field id="notes" label="Notes" className="span-2"><textarea id="notes" name="notes" rows={3} defaultValue={c?.notes ?? ''} /></Field>
        </div>
    );
}
