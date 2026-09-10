import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/* ==========================================================================
   TIMELINE
   One ordered stream per record, merged from two append-only tables:
   audit_log (what changed, by whom) and notifications (what was sent, to
   whom, with what outcome). Child records are folded in through the
   audit_log parent columns and explicit id lists, so a job's timeline
   includes its shifts, invoices, payments and review.
   ========================================================================== */

export type TimelineEvent = {
    id: string;
    at: string;
    kind: 'change' | 'message';
    actor: string;             // "Cameron Harrell", "system", "client"
    summary: string;
    detail?: string | null;    // e.g. message recipient + outcome
    status?: string | null;    // notification status
    changes?: Record<string, { old: unknown; new: unknown }> | null;
};

export type TimelineScope = {
    entityType: string;
    id: string;
    /** Extra (entity_type, id) pairs whose direct events belong on this timeline. */
    related?: { entityType: string; id: string }[];
};

const IGNORED_DIFF_KEYS = new Set(['amount_paid_cents', 'stripe_checkout_session_id', 'stripe_payment_intent_id', 'first_response_at', 'confirmed_at']);

export async function timelineFor(scope: TimelineScope, limit = 80): Promise<TimelineEvent[]> {
    const supabase = await createSupabaseServerClient();
    const pairs = [{ entityType: scope.entityType, id: scope.id }, ...(scope.related ?? [])];
    const ids = [...new Set(pairs.map((p) => p.id))];

    const [{ data: audits }, { data: parented }, { data: messages }, { data: profiles }] = await Promise.all([
        supabase.from('audit_log').select('id, at, actor_id, actor_role, action, entity_type, record_id, changes, summary').in('record_id', ids).order('at', { ascending: false }).limit(limit),
        supabase.from('audit_log').select('id, at, actor_id, actor_role, action, entity_type, record_id, changes, summary').eq('parent_type', scope.entityType).eq('parent_id', scope.id).order('at', { ascending: false }).limit(limit),
        supabase.from('notifications').select('id, created_at, trigger, channel, recipient, recipient_role, status, error, subject, entity_type, entity_id').in('entity_id', ids).order('created_at', { ascending: false }).limit(limit),
        supabase.from('profiles').select('id, full_name, email')
    ]);
    const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name || p.email || 'staff']));
    const seen = new Set<string>();
    const events: TimelineEvent[] = [];

    for (const a of [...(audits ?? []), ...(parented ?? [])]) {
        const key = `a${a.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const changes = a.changes && a.action === 'update' ? Object.fromEntries(Object.entries(a.changes as Record<string, { old: unknown; new: unknown }>).filter(([k]) => !IGNORED_DIFF_KEYS.has(k))) : null;
        events.push({
            id: key,
            at: a.at,
            kind: 'change',
            actor: a.actor_id ? (names.get(a.actor_id) ?? a.actor_role) : a.actor_role,
            summary: a.summary,
            changes: changes && Object.keys(changes).length ? changes : null
        });
    }
    for (const m of messages ?? []) {
        events.push({
            id: `m${m.id}`,
            at: m.created_at,
            kind: 'message',
            actor: 'system',
            summary: `${m.trigger.replace(/_/g, ' ')} · ${m.channel} → ${m.recipient}`,
            detail: m.subject ?? m.error ?? null,
            status: m.status
        });
    }
    return events.sort((x, y) => y.at.localeCompare(x.at)).slice(0, limit);
}

/** The global feed for /portal/activity. */
export async function recentActivity(limit = 200): Promise<(TimelineEvent & { entityType: string; recordId: string })[]> {
    const supabase = await createSupabaseServerClient();
    const [{ data: audits }, { data: profiles }] = await Promise.all([
        supabase.from('audit_log').select('id, at, actor_id, actor_role, action, entity_type, record_id, summary').order('at', { ascending: false }).limit(limit),
        supabase.from('profiles').select('id, full_name, email')
    ]);
    const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name || p.email || 'staff']));
    return (audits ?? []).map((a) => ({
        id: `a${a.id}`, at: a.at, kind: 'change' as const,
        actor: a.actor_id ? (names.get(a.actor_id) ?? a.actor_role) : a.actor_role,
        summary: a.summary, entityType: a.entity_type, recordId: a.record_id
    }));
}

/** Where a record lives in the portal, for links in the feed. */
export function entityHref(entityType: string, id: string): string | null {
    switch (entityType) {
        case 'client_quote': return `/portal/leads/${id}`;
        case 'client': case 'site': return `/portal/clients/${id}`;
        case 'quote': case 'proposal': return `/portal/quotes/${id}`;
        case 'job': case 'shift': case 'review': return `/portal/jobs/${id}`;
        case 'invoice': case 'payment': return `/portal/invoices/${id}`;
        case 'setting': return '/portal/settings';
        default: return null;
    }
}
