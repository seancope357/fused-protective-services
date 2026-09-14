import { Field } from '@/components/ui';
import { ClientSitePicker } from '@/components/client-site-picker';
import { armedLevels, divisions } from '@/lib/shared';
import { isoToLocal } from '@/lib/actions/util';
import { parseRule } from '@/lib/domain/schedule';
import { fmtDateOnly } from '@/lib/format';
import type { Client, Job, Site } from '@/lib/db/types';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const joinAnd = (names: string[]): string =>
    names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/** A stored repeat rule in words an operator reads ("repeats every Friday and
    Saturday until Dec 31, 2026"). The schedule only expands a rule that has an
    end date, so a rule without one is called out rather than implied. */
export function describeRecurrence(rule: string | null | undefined, until: string | null | undefined): string | null {
    if (!rule) return null;
    const parsed = parseRule(rule);
    if (!parsed) return `repeat rule not understood (${rule})`;
    let text: string;
    if (parsed.freq === 'DAILY') {
        text = parsed.interval === 1 ? 'every day' : `every ${parsed.interval} days`;
    } else {
        const days = joinAnd(parsed.byDay.map((d) => DAY_NAMES[d]));
        const weeks = parsed.interval === 1 ? 'every week' : parsed.interval === 2 ? 'every other week' : `every ${parsed.interval} weeks`;
        text = days ? (parsed.interval === 1 ? `every ${days}` : `${weeks} on ${days}`) : weeks;
    }
    return until ? `repeats ${text} until ${fmtDateOnly(until)}` : `repeats ${text}, but has no end date, so only one shift was made`;
}

export function JobFields({ job, clients, sites, clientId }: { job?: Job | null; clients: Client[]; sites: Site[]; clientId?: string | null }) {
    const j = job;
    return (
        <div className="form-grid">
            <Field id="title" label="Title" className="span-2"><input id="title" name="title" defaultValue={j?.title ?? ''} required placeholder="Friday door detail — The Rooftop" enterKeyHint="next" /></Field>
            <ClientSitePicker sites={sites.map(({ id, name, client_id }) => ({ id, name, client_id }))} clients={clients.map(({ id, name }) => ({ id, name }))} defaultClientId={j?.client_id ?? clientId} defaultSiteId={j?.site_id} />
            <Field id="division_quote_value" label="Division">
                <select id="division_quote_value" name="division_quote_value" defaultValue={j?.division_quote_value ?? divisions[6].quoteValue}>
                    {divisions.map((d) => <option key={d.id} value={d.quoteValue}>{d.heading}</option>)}
                </select>
            </Field>
            <Field id="deposit_pct" label="Deposit %"><input id="deposit_pct" name="deposit_pct" type="number" inputMode="decimal" min={0} max={100} step={1} defaultValue={j?.deposit_pct ?? 0} enterKeyHint="next" /></Field>
            <Field id="starts_at" label="First shift starts" hint="Central time"><input id="starts_at" name="starts_at" type="datetime-local" defaultValue={isoToLocal(j?.starts_at)} required aria-describedby="starts_at-hint" /></Field>
            <Field id="ends_at" label="First shift ends"><input id="ends_at" name="ends_at" type="datetime-local" defaultValue={isoToLocal(j?.ends_at)} required /></Field>
            {/* The stored format is the schedule's RRULE subset and stays as typed;
                the label and hint carry the plain-English meaning. On an existing
                job the rule is saved but shifts are not rebuilt (updateJob only
                writes the job row), so the hint says so. */}
            <Field
                id="recurrence_rule"
                label="Repeats (standing details)"
                hint={`Leave blank for a one-off. Example: every Friday and Saturday is FREQ=WEEKLY;BYDAY=FR,SA. Also set “Repeats until”.${j ? ' Changing this does not add or remove shifts — use “Add a shift”.' : ''}`}
            >
                <input id="recurrence_rule" name="recurrence_rule" defaultValue={j?.recurrence_rule ?? ''} placeholder="FREQ=WEEKLY;BYDAY=FR,SA" autoCapitalize="characters" autoCorrect="off" autoComplete="off" spellCheck={false} enterKeyHint="next" aria-describedby="recurrence_rule-hint" />
            </Field>
            <Field id="recurrence_until" label="Repeats until" hint="The last date a shift can fall on."><input id="recurrence_until" name="recurrence_until" type="date" defaultValue={j?.recurrence_until ?? ''} aria-describedby="recurrence_until-hint" /></Field>
            {!j ? (
                <>
                    <Field id="officers_required" label="Officers per shift"><input id="officers_required" name="officers_required" type="number" inputMode="numeric" min={1} step={1} defaultValue={2} enterKeyHint="next" /></Field>
                    <Field id="armed_level" label="Armed level">
                        <select id="armed_level" name="armed_level" defaultValue="level-3">{armedLevels.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select>
                    </Field>
                    <Field id="bill_rate" label="Bill rate $/hr"><input id="bill_rate" name="bill_rate" type="number" inputMode="decimal" min={0} step={0.01} defaultValue={(armedLevels[1].rateCents! / 100).toFixed(2)} enterKeyHint="next" /></Field>
                </>
            ) : null}
            <Field id="arrival_window" label="Arrival window (in the brief)"><input id="arrival_window" name="arrival_window" defaultValue={j?.arrival_window ?? 'Officers arrive 30 minutes before start'} enterKeyHint="next" /></Field>
            <Field id="onsite_contact_name" label="On-site contact"><input id="onsite_contact_name" name="onsite_contact_name" defaultValue={j?.onsite_contact_name ?? ''} autoComplete="name" enterKeyHint="next" /></Field>
            <Field id="onsite_contact_phone" label="On-site contact phone"><input id="onsite_contact_phone" name="onsite_contact_phone" type="tel" defaultValue={j?.onsite_contact_phone ?? ''} autoComplete="tel" enterKeyHint="next" /></Field>
            <Field id="client_prep_notes" label="What the client should prepare (in the brief)" className="span-2"><textarea id="client_prep_notes" name="client_prep_notes" rows={3} defaultValue={j?.client_prep_notes ?? ''} /></Field>
            <Field id="post_orders" label="Post orders (internal)" className="span-2"><textarea id="post_orders" name="post_orders" rows={4} defaultValue={j?.post_orders ?? ''} /></Field>
        </div>
    );
}
