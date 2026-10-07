import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { SendResult } from '@/lib/transports';

export type LogResult = SendResult | { configured: boolean; ok: boolean; error?: string; id?: string; sid?: string; skipped?: string };

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
    result: LogResult;
};

/** `sent` | `failed` | `skipped` — failed means a provider was reached and refused. */
export function statusOf(r: LogResult): 'sent' | 'failed' | 'skipped' {
    return r.ok ? 'sent' : r.configured ? 'failed' : 'skipped';
}

/* `error` is a text column and the only breadcrumb an engineer gets at 3am, so
   it must always be a reason or NULL — never a stringified boolean.

   The old expression was:
       r.error ?? ('skipped' in r && r.skipped) ?? (r.configured ? … : …)
   `&&` returns `false` when the key is absent, and `??` only falls through on
   null/undefined — so `false` won the chain and 27 production rows recorded
   `error = 'false'`. A skip whose reason reads "false" explains nothing. */
export function failureReason(r: LogResult): string | null {
    if (r.ok) return null;
    if (typeof r.error === 'string' && r.error) return r.error;
    const skipped = 'skipped' in r ? r.skipped : undefined;
    if (typeof skipped === 'string' && skipped) return skipped;
    return r.configured ? 'send_failed' : 'not_configured';
}

/** Every send, attempted or skipped, becomes one append-only row. */
export async function logNotification(input: LogInput): Promise<void> {
    const r = input.result;
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
        status: statusOf(r),
        error: failureReason(r)
    });
    if (error && !/duplicate key/i.test(error.message)) console.error('[notifications] log insert failed:', error.message);
}
