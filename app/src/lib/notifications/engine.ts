/* ==========================================================================
   NOTIFICATION ENGINE
   dispatch(trigger, ctx) reads the matrix, resolves recipients, honours SMS
   consent and STOP, sends, and logs one row per attempt. Dependencies are
   injected so the trigger logic is testable without a network or database.
   ========================================================================== */

import { rulesFor, type Ctx, type Channel, type Rule } from './templates';
import type { Client } from '@/lib/db/types';

export type SendOutcome = { configured: boolean; ok: boolean; id?: string; sid?: string; error?: string; skipped?: string };

export type EngineDeps = {
    sendEmail: (m: { from: string | null; to: string; subject: string; text: string; html: string }) => Promise<SendOutcome>;
    sendSms: (m: { to: string; body: string }) => Promise<SendOutcome>;
    publicSender: () => string | null;
    internalSender: () => string;
    ownerContacts: () => Promise<{ emails: string[]; phones: string[] }>;
    isOptedOut: (phone: string) => Promise<boolean>;
    log: (row: LogRow) => Promise<void>;
};

export type LogRow = {
    trigger: string;
    channel: Channel;
    recipient: string;
    recipientRole: 'owner' | 'client';
    entityType?: string;
    entityId?: string | null;
    dedupeKey?: string | null;
    subject?: string;
    bodyPreview?: string;
    result: SendOutcome & { skipped?: string };
};

export type DispatchOptions = {
    entityType?: string;
    entityId?: string | null;
    /** When true, a (trigger, entity, recipient, channel) tuple sends once, ever. */
    idempotent?: boolean;
    /** Extra discriminator for idempotent keys (e.g. overdue day). */
    dedupeSuffix?: string;
};

export type DispatchSummary = { attempted: number; sent: number; failed: number; skipped: number };

const normalisePhone = (p: string | null | undefined): string | null => {
    if (!p) return null;
    const digits = p.replace(/[^\d+]/g, '');
    if (digits.startsWith('+')) return digits;
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    return null;
};

function clientRecipients(client: Client | null | undefined): { emails: string[]; phones: string[]; smsConsent: boolean } {
    if (!client) return { emails: [], phones: [], smsConsent: false };
    const phone = normalisePhone(client.billing_phone);
    return {
        emails: client.billing_email ? [client.billing_email] : [],
        phones: phone ? [phone] : [],
        smsConsent: Boolean(client.sms_consent) && !client.sms_opted_out_at
    };
}

export async function dispatchWith(deps: EngineDeps, trigger: string, ctx: Ctx, opts: DispatchOptions = {}): Promise<DispatchSummary> {
    const summary: DispatchSummary = { attempted: 0, sent: 0, failed: 0, skipped: 0 };
    const rules = rulesFor(trigger);
    if (rules.length === 0) {
        console.warn(`[notifications] no rule for trigger "${trigger}"`);
        return summary;
    }

    for (const rule of rules) {
        if (rule.when && !rule.when(ctx)) continue;
        const targets = rule.audience === 'owner' ? { ...(await deps.ownerContacts()), smsConsent: true } : clientRecipients(ctx.client);

        for (const channel of rule.channels) {
            const recipients = channel === 'email' ? targets.emails : targets.phones;
            const key = (recipient: string) =>
                opts.idempotent ? `${trigger}:${opts.entityType ?? 'none'}:${opts.entityId ?? 'none'}:${channel}:${recipient}${opts.dedupeSuffix ? `:${opts.dedupeSuffix}` : ''}` : null;

            if (recipients.length === 0) {
                summary.skipped++;
                await deps.log({
                    trigger, channel, recipient: '(none)', recipientRole: rule.audience,
                    entityType: opts.entityType, entityId: opts.entityId,
                    result: { configured: false, ok: false, skipped: `no_${channel}_recipient` }
                });
                continue;
            }

            for (const recipient of recipients) {
                summary.attempted++;
                const outcome = await sendOne(deps, rule, channel, recipient, ctx, targets.smsConsent);
                if (outcome.result.ok) summary.sent++;
                else if (outcome.result.skipped) summary.skipped++;
                else summary.failed++;
                await deps.log({
                    trigger, channel, recipient, recipientRole: rule.audience,
                    entityType: opts.entityType, entityId: opts.entityId, dedupeKey: key(recipient),
                    subject: outcome.subject, bodyPreview: outcome.preview, result: outcome.result
                });
            }
        }
    }
    return summary;
}

async function sendOne(deps: EngineDeps, rule: Rule, channel: Channel, recipient: string, ctx: Ctx, smsConsent: boolean) {
    if (channel === 'email') {
        if (!rule.email) return { result: { configured: false, ok: false, skipped: 'no_email_template' } };
        const msg = rule.email(ctx);
        const from = rule.audience === 'owner' ? deps.internalSender() : deps.publicSender();
        if (!from) return { subject: msg.subject, result: { configured: false, ok: false, skipped: 'no_verified_sender' } };
        const result = await deps.sendEmail({ from, to: recipient, ...msg });
        return { subject: msg.subject, preview: msg.text.slice(0, 200), result };
    }

    if (!rule.sms) return { result: { configured: false, ok: false, skipped: 'no_sms_template' } };
    if (!smsConsent) return { result: { configured: false, ok: false, skipped: 'no_sms_consent' } };
    if (await deps.isOptedOut(recipient)) return { result: { configured: false, ok: false, skipped: 'sms_opted_out' } };
    const body = rule.sms(ctx);
    const result = await deps.sendSms({ to: recipient, body });
    return { preview: body.slice(0, 200), result };
}
