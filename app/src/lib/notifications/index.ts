import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendEmail, sendSms, publicSender, internalSender, ownerSmsRecipients } from '@/lib/transports';
import { logNotification } from './log';
import { dispatchWith, type EngineDeps, type DispatchOptions } from './engine';
import type { Ctx } from './templates';

/* Production wiring of the engine: real transports, real log, owner contacts
   from settings with the environment as fallback, STOP list from Postgres. */
export async function ownerContacts(): Promise<{ emails: string[]; phones: string[] }> {
    const { data } = await supabaseAdmin().from('settings').select('key, value').in('key', ['owner_email', 'owner_phone']);
    const get = (k: string) => data?.find((r) => r.key === k)?.value as string | undefined;
    const emails = (get('owner_email') || process.env.DISPATCH_ALERT_TO || '').split(',').map((s) => s.trim()).filter(Boolean);
    const phones = get('owner_phone') ? [get('owner_phone')!] : ownerSmsRecipients();
    return { emails, phones };
}

const deps: EngineDeps = {
    sendEmail: (m) => sendEmail(m),
    sendSms: (m) => sendSms(m),
    publicSender,
    internalSender,
    ownerContacts,
    isOptedOut: async (phone) => {
        const { data } = await supabaseAdmin().from('sms_opt_outs').select('phone').eq('phone', phone).maybeSingle();
        return Boolean(data);
    },
    log: (row) => logNotification({ ...row, recipientRole: row.recipientRole })
};

export const dispatch = (trigger: string, ctx: Ctx, opts?: DispatchOptions) => dispatchWith(deps, trigger, ctx, opts);

/** True when this idempotent (trigger, entity, suffix) has already been sent to anyone. */
export async function alreadySent(trigger: string, entityType: string, entityId: string, suffix?: string): Promise<boolean> {
    const prefix = `${trigger}:${entityType}:${entityId}:`;
    const { data } = await supabaseAdmin()
        .from('notifications')
        .select('dedupe_key')
        .like('dedupe_key', `${prefix}%${suffix ? `:${suffix}` : ''}`)
        .eq('status', 'sent')
        .limit(1);
    return Boolean(data && data.length);
}
