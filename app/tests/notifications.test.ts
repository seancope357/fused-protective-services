import { describe, expect, it, vi } from 'vitest';
import { dispatchWith, type EngineDeps, type LogRow } from '@/lib/notifications/engine';
import { rules } from '@/lib/notifications/templates';
import { unansweredLeads, jobsStartingIn24h, jobsDueReviewRequest, invoicesDueReminder, invoicesToMarkOverdue, isDigestHour } from '@/lib/notifications/conditions';
import type { Client, Invoice, Job, Lead, Quote, Proposal } from '@/lib/db/types';

const client = (over: Partial<Client> = {}): Client => ({
    id: 'c1', kind: 'company', name: 'Acme Bars', billing_contact_name: 'Jane Doe', billing_email: 'jane@acme.example', billing_phone: '(512) 555-0100',
    billing_address_line1: null, billing_address_line2: null, billing_city: null, billing_state: 'TX', billing_postal_code: null,
    default_net_term_id: 'net-30', default_tax_rate_pct: 8.25, tax_jurisdiction: null, tax_exempt: false, stripe_customer_id: null,
    sms_consent: true, sms_consent_at: '2026-09-01T00:00:00Z', sms_opted_out_at: null, notes: null, created_at: '2026-09-01T00:00:00Z', ...over
});
const quote = (): Quote => ({ id: 'q1', quote_number: 'Q-2026-0001', client_id: 'c1', site_id: null, source_quote_id: null, division_quote_value: 'Restaurant, Bar & Nightlife Venue Security', armed_level: 'level-3', officer_count: 2, hours: 8, bill_rate_cents: 6500, subtotal_cents: 104000, tax_rate_pct: 8.25, tax_cents: 8580, total_cents: 112580, deposit_pct: 0, starts_at: null, ends_at: null, valid_until: '2026-10-01', status: 'sent', sent_at: null, decided_at: null, notes: null, created_at: '2026-09-01T00:00:00Z' });
const proposal = (): Proposal => ({ id: 'p1', quote_id: 'q1', client_id: 'c1', title: 'Door detail', scope: 'Scope', exclusions: null, terms: 'Terms', snapshot: null, status: 'accepted', sent_at: null, accepted_at: '2026-09-09T12:00:00Z', accepted_name: 'Jane Doe', accepted_ip: '1.2.3.4', declined_at: null, declined_reason: null });

function fakeDeps(over: Partial<EngineDeps> = {}) {
    const log: LogRow[] = [];
    const deps: EngineDeps = {
        sendEmail: vi.fn(async () => ({ configured: true, ok: true, id: 'em' })),
        sendSms: vi.fn(async () => ({ configured: true, ok: true, sid: 'sm' })),
        publicSender: () => 'Fused <dispatch@fusedprotectiveservices.com>',
        internalSender: () => 'Fused <dispatch@fusedprotectiveservices.com>',
        ownerContacts: async () => ({ emails: ['owner@example.com'], phones: ['+15121111111'] }),
        isOptedOut: async () => false,
        log: async (row) => { log.push(row); },
        ...over
    };
    return { deps, log };
}

describe('notification matrix', () => {
    it('covers every trigger in the specification', () => {
        const triggers = new Set(rules.map((r) => r.trigger));
        for (const t of ['lead_unanswered_2h', 'proposal_sent', 'proposal_accepted', 'job_confirmed', 'job_reminder_24h', 'job_unstaffed_24h', 'job_completed', 'review_request', 'invoice_sent', 'payment_received', 'payment_receipt', 'invoice_overdue', 'daily_digest']) {
            expect(triggers.has(t), t).toBe(true);
        }
    });

    it('proposal_accepted goes to the owner by email and SMS; the copy goes to the client', async () => {
        const { deps, log } = fakeDeps();
        const s = await dispatchWith(deps, 'proposal_accepted', { client: client(), quote: quote(), proposal: proposal(), link: 'https://x/portal' }, { entityType: 'proposal', entityId: 'p1', idempotent: true });
        expect(s).toEqual({ attempted: 2, sent: 2, failed: 0, skipped: 0 });
        expect(deps.sendEmail).toHaveBeenCalledTimes(1);
        expect(deps.sendSms).toHaveBeenCalledTimes(1);
        expect(log.map((l) => l.dedupeKey)).toEqual(['proposal_accepted:proposal:p1:email:owner@example.com', 'proposal_accepted:proposal:p1:sms:+15121111111']);
        const copy = await dispatchWith(deps, 'proposal_accepted_copy', { client: client(), quote: quote(), proposal: proposal() });
        expect(copy.sent).toBe(1);
        const lastEmail = (deps.sendEmail as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0];
        expect(lastEmail.to).toBe('jane@acme.example');
        expect(lastEmail.text).toContain('(512) 555-0199');
    });

    it('client SMS requires consent and honours STOP; email still goes', async () => {
        const job: Job = { id: 'j1', job_number: 'J-1', client_id: 'c1', site_id: null, quote_id: null, division_quote_value: 'x', title: 'Door detail', starts_at: '2026-09-10T01:00:00Z', ends_at: '2026-09-10T07:00:00Z', recurrence_rule: null, recurrence_until: null, arrival_window: null, onsite_contact_name: null, onsite_contact_phone: null, client_prep_notes: null, post_orders: null, deposit_pct: 0, deposit_invoice_id: null, status: 'scheduled', confirmed_at: null, completed_at: null, cancelled_at: null, completion_summary: null, created_at: '' };
        const noConsent = fakeDeps();
        const s1 = await dispatchWith(noConsent.deps, 'job_reminder_24h', { client: client({ sms_consent: false }), job });
        expect(s1.sent).toBe(1);
        expect(noConsent.deps.sendSms).not.toHaveBeenCalled();
        expect(noConsent.log.find((l) => l.channel === 'sms')?.result.skipped).toBe('no_sms_consent');

        const stopped = fakeDeps({ isOptedOut: async () => true });
        const s2 = await dispatchWith(stopped.deps, 'job_reminder_24h', { client: client(), job });
        expect(s2.sent).toBe(1);
        expect(stopped.log.find((l) => l.channel === 'sms')?.result.skipped).toBe('sms_opted_out');

        const ok = fakeDeps();
        const s3 = await dispatchWith(ok.deps, 'job_reminder_24h', { client: client(), job });
        expect(s3.sent).toBe(2);
        expect((ok.deps.sendSms as ReturnType<typeof vi.fn>).mock.calls[0][0].to).toBe('+15125550100');
    });

    it('client email is skipped and logged when there is no verified sender', async () => {
        const { deps, log } = fakeDeps({ publicSender: () => null });
        const s = await dispatchWith(deps, 'proposal_sent', { client: client(), quote: quote(), proposal: proposal() });
        expect(s.skipped).toBe(1);
        expect(log[0].result.skipped).toBe('no_verified_sender');
        expect(deps.sendEmail).not.toHaveBeenCalled();
    });

    it('a transport failure is reported, not hidden', async () => {
        const { deps, log } = fakeDeps({ sendEmail: vi.fn(async () => ({ configured: true, ok: false, error: 'resend_500' })) });
        const s = await dispatchWith(deps, 'proposal_sent', { client: client(), quote: quote(), proposal: proposal() });
        expect(s.failed).toBe(1);
        expect(log[0].result.error).toBe('resend_500');
    });

    it('job_unstaffed_24h only fires when the job is unstaffed', async () => {
        const { deps } = fakeDeps();
        const job = { id: 'j1', job_number: 'J-1', title: 'T', starts_at: '2026-09-10T01:00:00Z' } as Job;
        expect((await dispatchWith(deps, 'job_unstaffed_24h', { job, unstaffed: false })).attempted).toBe(0);
        expect((await dispatchWith(deps, 'job_unstaffed_24h', { job, unstaffed: true })).sent).toBe(1);
    });
});

describe('scheduler conditions', () => {
    const now = new Date('2026-09-09T15:00:00Z');
    const lead = (over: Partial<Lead>): Lead => ({ id: 'l', ref_code: 'TX', full_name: 'A', company: null, phone: '1', email: 'a@b', service_division: 'x', armed_preference: 'y', deployment_location: 'z', schedule: 's', notes: null, status: 'new', priority: 'standard', sms_consent: false, sms_consent_at: null, client_id: null, first_response_at: null, created_at: '2026-09-09T12:00:00Z', ...over });

    it('lead unanswered: 2h old and still new, never responded', () => {
        expect(unansweredLeads([lead({})], now)).toHaveLength(1);
        expect(unansweredLeads([lead({ created_at: '2026-09-09T13:30:00Z' })], now)).toHaveLength(0);
        expect(unansweredLeads([lead({ first_response_at: '2026-09-09T12:30:00Z' })], now)).toHaveLength(0);
        expect(unansweredLeads([lead({ status: 'contacted' })], now)).toHaveLength(0);
    });

    it('24h reminder window is one hour wide and only for scheduled jobs', () => {
        const j = (starts: string, status: Job['status'] = 'scheduled') => ({ starts_at: starts, status } as Job);
        expect(jobsStartingIn24h([j('2026-09-10T15:30:00Z')], now)).toHaveLength(1);
        expect(jobsStartingIn24h([j('2026-09-10T13:00:00Z')], now)).toHaveLength(0); // 22h
        expect(jobsStartingIn24h([j('2026-09-10T16:30:00Z')], now)).toHaveLength(0); // 25.5h
        expect(jobsStartingIn24h([j('2026-09-10T15:30:00Z', 'cancelled')], now)).toHaveLength(0);
    });

    it('review request 24h after completion', () => {
        const j = (completed: string | null, status: Job['status'] = 'completed') => ({ completed_at: completed, status } as Job);
        expect(jobsDueReviewRequest([j('2026-09-08T14:00:00Z')], now)).toHaveLength(1);
        expect(jobsDueReviewRequest([j('2026-09-08T16:00:00Z')], now)).toHaveLength(0);
        expect(jobsDueReviewRequest([j('2026-09-08T14:00:00Z', 'cancelled')], now)).toHaveLength(0);
    });

    it('overdue reminders at exactly day 1, 7 and 14; marking overdue from day 1', () => {
        const inv = (due: string, status: Invoice['status'] = 'sent') => ({ due_date: due, status, id: due } as Invoice);
        const today = '2026-09-15';
        const due = invoicesDueReminder([inv('2026-09-14'), inv('2026-09-08'), inv('2026-09-01'), inv('2026-09-10'), inv('2026-09-01', 'paid'), inv('2026-09-01', 'draft')], today);
        expect(due.map((d) => d.days)).toEqual([1, 7, 14]);
        expect(invoicesToMarkOverdue([inv('2026-09-14'), inv('2026-09-15'), inv('2026-09-10', 'overdue')], today).map((i) => i.id)).toEqual(['2026-09-14']);
    });

    it('digest hour is 7am Central', () => {
        expect(isDigestHour(new Date('2026-09-09T12:00:00Z'))).toBe(true);  // CDT
        expect(isDigestHour(new Date('2026-09-09T13:00:00Z'))).toBe(false);
        expect(isDigestHour(new Date('2026-12-09T13:00:00Z'))).toBe(true);  // CST
    });
});
