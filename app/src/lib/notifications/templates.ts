/* ==========================================================================
   NOTIFICATION MATRIX — the table the engine reads
   One rule per (trigger, audience). A rule says which channels apply, under
   what condition, and how to render the message from a context. Nothing
   here sends; engine.ts does, and logs every attempt.

   Every business fact in a message (phone, email, company name) comes from
   src/data/site.mjs through @/lib/shared.
   ========================================================================== */

import { emailShell } from '../../../../api/_lib/intake-messages.mjs';
import { formatMoney } from '@/lib/money';
import { fmtDateTime, fmtDateOnly, fmtTime } from '@/lib/format';
import { site, divisionByQuoteValue } from '@/lib/shared';
import type { Client, Invoice, Job, Lead, Proposal, Quote, Review, Site, Payment } from '@/lib/db/types';

export type Audience = 'owner' | 'client';
export type Channel = 'email' | 'sms';

export type EmailMessage = { subject: string; text: string; html: string };

export type Ctx = {
    client?: Client | null;
    lead?: Lead;
    quote?: Quote;
    proposal?: Proposal;
    job?: Job;
    site?: Site | null;
    invoice?: Invoice;
    payment?: Payment;
    review?: Review;
    link?: string;
    overdueDays?: number;
    unstaffed?: boolean;
    digest?: { jobsToday: Job[]; newLeads: Lead[]; unpaid: Invoice[]; leadLink: string; invoiceLink: string; jobLink: string };
};

export type Rule = {
    trigger: string;
    audience: Audience;
    channels: Channel[];
    /** Extra gate beyond "recipient exists and consented". */
    when?: (ctx: Ctx) => boolean;
    email?: (ctx: Ctx) => EmailMessage;
    sms?: (ctx: Ctx) => string;
};

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const button = (href: string, label: string) => `<p style="margin:0"><a href="${esc(href)}" style="display:inline-block;background:#c6a25c;color:#050504;font-weight:800;padding:12px 22px;border-radius:8px;text-decoration:none">${esc(label)}</a></p>`;
const para = (text: string) => `<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#a8a29e">${esc(text)}</p>`;
const dispatchLine = `24/7 dispatch: ${site.phone.display} · ${site.email}`;
const firstName = (c?: Client | null) => (c?.billing_contact_name || c?.name || 'there').split(' ')[0];
const divisionName = (v?: string | null) => divisionByQuoteValue(v)?.heading ?? v ?? 'Security detail';
const jobWhen = (job: Job) => `${fmtDateTime(job.starts_at)} – ${fmtTime(job.ends_at)}`;
const siteLine = (s?: Site | null) => (s ? [s.name, s.address_line1, s.city && `${s.city}, ${s.state ?? 'TX'} ${s.postal_code ?? ''}`.trim()].filter(Boolean).join(' · ') : 'Location per proposal');

function email(title: string, intro: string, rows: [string, string][], outroText: string[], cta?: { href: string; label: string }): EmailMessage {
    const text = [title, '', intro, '', ...rows.map(([k, v]) => `${k}: ${v}`), '', ...outroText, cta ? `\n${cta.label}: ${cta.href}` : '', '', dispatchLine].join('\n');
    const html = emailShell({
        title,
        intro: esc(intro),
        rows,
        outro: outroText.map(para).join('') + (cta ? button(cta.href, cta.label) : '')
    });
    return { subject: title, text, html };
}

export const rules: Rule[] = [
    /* ---- Lead follow-up (the submission itself is alerted by api/intake) ---- */
    {
        trigger: 'lead_unanswered_2h',
        audience: 'owner',
        channels: ['sms'],
        sms: ({ lead, link }) => `FUSED: lead ${lead!.ref_code} (${lead!.full_name}, ${divisionName(lead!.service_division)}) has had no response for 2 hours. ${lead!.phone}. ${link ?? ''}`.trim()
    },

    /* ---- Proposals ---- */
    {
        trigger: 'proposal_sent',
        audience: 'client',
        channels: ['email'],
        email: ({ client, proposal, quote, link }) =>
            email(
                `Your proposal from ${site.name} — ${quote!.quote_number}`,
                `${firstName(client)}, your proposal is ready to review and accept online.`,
                [
                    ['Proposal', proposal!.title],
                    ['Division', divisionName(quote!.division_quote_value)],
                    ['Officers', `${quote!.officer_count} × ${quote!.hours} hrs`],
                    ['Total', formatMoney(quote!.total_cents)],
                    ['Valid until', fmtDateOnly(quote!.valid_until)]
                ],
                ['Open the portal to read the full scope, exclusions and terms. Accepting takes one typed signature.'],
                link ? { href: link, label: 'Review and accept' } : undefined
            )
    },
    {
        trigger: 'proposal_accepted',
        audience: 'owner',
        channels: ['email', 'sms'],
        email: ({ client, proposal, quote, link }) =>
            email(
                `✅ Proposal accepted — ${quote!.quote_number} — ${client!.name}`,
                `${proposal!.accepted_name} accepted on behalf of ${client!.name}. A job has been created.`,
                [
                    ['Client', client!.name],
                    ['Division', divisionName(quote!.division_quote_value)],
                    ['Total', formatMoney(quote!.total_cents)],
                    ['Accepted', fmtDateTime(proposal!.accepted_at)],
                    ['From IP', proposal!.accepted_ip ?? '—']
                ],
                [],
                link ? { href: link, label: 'Open the job' } : undefined
            ),
        sms: ({ client, quote }) => `FUSED: ${client!.name} accepted ${quote!.quote_number} (${formatMoney(quote!.total_cents)}). Job created.`
    },
    {
        trigger: 'proposal_accepted_copy',
        audience: 'client',
        channels: ['email'],
        email: ({ client, proposal, quote, link }) =>
            email(
                `Accepted: ${proposal!.title} — ${quote!.quote_number}`,
                `${firstName(client)}, this is your copy of the proposal you accepted.`,
                [
                    ['Accepted by', proposal!.accepted_name ?? ''],
                    ['On', fmtDateTime(proposal!.accepted_at)],
                    ['Division', divisionName(quote!.division_quote_value)],
                    ['Total', formatMoney(quote!.total_cents)]
                ],
                ['Scope:', proposal!.scope, proposal!.exclusions ? `Exclusions: ${proposal!.exclusions}` : '', 'Terms:', proposal!.terms].filter(Boolean),
                link ? { href: link, label: 'View in the portal' } : undefined
            )
    },

    /* ---- Jobs ---- */
    {
        trigger: 'job_confirmed',
        audience: 'client',
        channels: ['email'],
        email: ({ client, job, site: s, link }) =>
            email(
                `Detail confirmed — ${job!.title} — ${fmtDateOnly(job!.starts_at.slice(0, 10))}`,
                `${firstName(client)}, your security detail is confirmed. Here is the brief.`,
                [
                    ['When', jobWhen(job!)],
                    ['Where', siteLine(s)],
                    ['Arrival', job!.arrival_window ?? 'Officers arrive 30 minutes before start'],
                    ['On-site contact', [job!.onsite_contact_name, job!.onsite_contact_phone].filter(Boolean).join(' · ') || 'Per proposal'],
                    ['Division', divisionName(job!.division_quote_value)]
                ],
                [job!.client_prep_notes ? `What to prepare: ${job!.client_prep_notes}` : 'Nothing further is needed from you before arrival.'],
                link ? { href: link, label: 'View the detail' } : undefined
            )
    },
    {
        trigger: 'job_reminder_24h',
        audience: 'client',
        channels: ['email', 'sms'],
        email: ({ client, job, site: s, link }) =>
            email(
                `Tomorrow: ${job!.title}`,
                `${firstName(client)}, a reminder that your detail starts in about 24 hours.`,
                [
                    ['When', jobWhen(job!)],
                    ['Where', siteLine(s)],
                    ['Arrival', job!.arrival_window ?? 'Officers arrive 30 minutes before start']
                ],
                [],
                link ? { href: link, label: 'View the detail' } : undefined
            ),
        sms: ({ job }) => `FUSED reminder: ${job!.title} starts ${fmtDateTime(job!.starts_at)}. Officers arrive early. Questions: ${site.phone.display}. Reply STOP to opt out.`
    },
    {
        trigger: 'job_unstaffed_24h',
        audience: 'owner',
        channels: ['email'],
        when: ({ unstaffed }) => Boolean(unstaffed),
        email: ({ job, client, link }) =>
            email(
                `⚠️ Unstaffed in 24h — ${job!.job_number} — ${client?.name ?? ''}`,
                `${job!.title} starts ${fmtDateTime(job!.starts_at)} and has no officers assigned.`,
                [['Job', job!.job_number], ['Client', client?.name ?? '—'], ['Starts', fmtDateTime(job!.starts_at)]],
                [],
                link ? { href: link, label: 'Open the job' } : undefined
            )
    },
    {
        trigger: 'job_completed',
        audience: 'client',
        channels: ['email'],
        email: ({ client, job, link }) =>
            email(
                `Detail complete — ${job!.title}`,
                `${firstName(client)}, your detail has been completed. Thank you for trusting ${site.name}.`,
                [['Job', job!.job_number], ['Covered', jobWhen(job!)]],
                [job!.completion_summary ? `Summary: ${job!.completion_summary}` : 'Your invoice, if any balance remains, follows separately.'],
                link ? { href: link, label: 'View the detail' } : undefined
            )
    },
    {
        trigger: 'review_request',
        audience: 'client',
        channels: ['email'],
        email: ({ client, job, link }) =>
            email(
                `How did we do? — ${job!.title}`,
                `${firstName(client)}, one minute of your time helps us keep the standard high.`,
                [['Detail', job!.title], ['Date', fmtDateOnly(job!.starts_at.slice(0, 10))]],
                ['Rate the detail and tell us what stood out. You choose whether we may publish your words.'],
                link ? { href: link, label: 'Leave a review' } : undefined
            )
    },

    /* ---- Invoices & payments ---- */
    {
        trigger: 'invoice_sent',
        audience: 'client',
        channels: ['email'],
        email: ({ client, invoice, link }) =>
            email(
                `Invoice ${invoice!.invoice_number} from ${site.name}`,
                `${firstName(client)}, your invoice is ready. Pay securely by card or bank transfer.`,
                [
                    ['Invoice', invoice!.invoice_number],
                    ['Amount due', formatMoney(invoice!.total_cents - invoice!.amount_paid_cents)],
                    ['Due', fmtDateOnly(invoice!.due_date)],
                    ['Terms', invoice!.payment_terms]
                ],
                [invoice!.kind === 'deposit' ? 'This is the deposit invoice; the balance is invoiced after the detail.' : ''].filter(Boolean),
                link ? { href: link, label: 'Pay now' } : undefined
            )
    },
    {
        trigger: 'payment_received',
        audience: 'owner',
        channels: ['email'],
        email: ({ client, invoice, payment, link }) =>
            email(
                `💰 Payment received — ${invoice!.invoice_number} — ${formatMoney(payment!.amount_cents)}`,
                `${client?.name ?? invoice!.client_name} paid by ${payment!.method}.`,
                [
                    ['Invoice', invoice!.invoice_number],
                    ['Paid', formatMoney(payment!.amount_cents)],
                    ['Status', invoice!.status.replace('_', ' ')],
                    ['Remaining', formatMoney(Math.max(0, invoice!.total_cents - invoice!.amount_paid_cents))]
                ],
                [],
                link ? { href: link, label: 'Open the invoice' } : undefined
            )
    },
    {
        trigger: 'payment_receipt',
        audience: 'client',
        channels: ['email'],
        email: ({ client, invoice, payment, link }) =>
            email(
                `Receipt — ${invoice!.invoice_number} — ${formatMoney(payment!.amount_cents)}`,
                `${firstName(client)}, thank you. This is your receipt.`,
                [
                    ['Invoice', invoice!.invoice_number],
                    ['Paid', formatMoney(payment!.amount_cents)],
                    ['Method', payment!.method === 'us_bank_account' ? 'Bank transfer (ACH)' : payment!.method],
                    ['Received', fmtDateTime(payment!.received_at)],
                    ['Balance', formatMoney(Math.max(0, invoice!.total_cents - invoice!.amount_paid_cents))]
                ],
                [],
                link ? { href: link, label: 'View the invoice' } : undefined
            )
    },
    {
        trigger: 'invoice_overdue',
        audience: 'client',
        channels: ['email'],
        email: ({ client, invoice, overdueDays, link }) =>
            email(
                `${overdueDays === 1 ? 'Reminder' : overdueDays === 7 ? 'Second reminder' : 'Final reminder'}: invoice ${invoice!.invoice_number} is past due`,
                `${firstName(client)}, invoice ${invoice!.invoice_number} was due ${fmtDateOnly(invoice!.due_date)} (${overdueDays} day${overdueDays === 1 ? '' : 's'} ago).`,
                [['Amount due', formatMoney(invoice!.total_cents - invoice!.amount_paid_cents)], ['Due date', fmtDateOnly(invoice!.due_date)]],
                [overdueDays && overdueDays >= 14 ? 'Past-due balances accrue interest per the invoice terms. Please settle today or call dispatch to arrange terms.' : 'If payment is already on its way, thank you — please disregard this note.'],
                link ? { href: link, label: 'Pay now' } : undefined
            )
    },

    /* ---- Daily digest ---- */
    {
        trigger: 'daily_digest',
        audience: 'owner',
        channels: ['email'],
        email: ({ digest }) => {
            const d = digest!;
            const unpaidTotal = d.unpaid.reduce((s, i) => s + (i.total_cents - i.amount_paid_cents), 0);
            const rows: [string, string][] = [
                ['Jobs today', d.jobsToday.length ? d.jobsToday.map((j) => `${fmtTime(j.starts_at)} ${j.title}`).join('\n') : 'None'],
                ['New leads', d.newLeads.length ? d.newLeads.map((l) => `${l.ref_code} ${l.full_name} — ${divisionName(l.service_division)} (${l.priority})`).join('\n') : 'None'],
                ['Unpaid invoices', d.unpaid.length ? `${d.unpaid.length} open · ${formatMoney(unpaidTotal)} outstanding` : 'None']
            ];
            return email(`Daily brief — ${fmtDateOnly(new Date().toISOString().slice(0, 10))}`, 'What needs you today.', rows, [`Leads: ${d.leadLink}`, `Invoices: ${d.invoiceLink}`, `Jobs: ${d.jobLink}`]);
        }
    }
];

export const rulesFor = (trigger: string): Rule[] => rules.filter((r) => r.trigger === trigger);
