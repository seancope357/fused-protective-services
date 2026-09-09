import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { SendResult } from '@/lib/transports';

export type LogInput = {
    trigger: string;
    channel: 'email' | 'sms';
    recipient: string;
    recipientRole: 'owner' | 'client' | 'officer' | 'visitor';
    entityType?: string;
    entityId?: string | null;
    dedupeKey?: string | null;
    subject?: string;
    bodyPreview?: string;
    result: SendResult | { configured: boolean; ok: boolean; error?: string; id?: string; sid?: string; skipped?: string };
};

/** Every send, attempted or skipped, becomes one append-only row. */
export async function logNotification(input: LogInput): Promise<void> {
    const r = input.result;
    const status = r.ok ? 'sent' : r.configured ? 'failed' : 'skipped';
    const { error } = await supabaseAdmin().from('notifications').insert({
        trigger: input.trigger,
        channel: input.channel,
        recipient: input.recipient,
        recipient_role: input.recipientRole,
        entity_type: input.entityType ?? null,
        entity_id: input.entityId ?? null,
        dedupe_key: input.dedupeKey ?? null,
        subject: input.subject ?? null,
        body_preview: input.bodyPreview?.slice(0, 280) ?? null,
        provider: input.channel === 'email' ? 'resend' : 'twilio',
        provider_id: ('id' in r && r.id) || ('sid' in r && r.sid) || null,
        status,
        error: r.ok ? null : (r.error ?? ('skipped' in r && r.skipped) ?? (r.configured ? 'send_failed' : 'not_configured'))
    });
    if (error && !/duplicate key/i.test(error.message)) console.error('[notifications] log insert failed:', error.message);
}
