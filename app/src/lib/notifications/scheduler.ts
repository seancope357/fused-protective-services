import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { appUrl } from '@/lib/shared';
import { dispatch, alreadySent } from './index';
import {
    unansweredLeads, jobsStartingIn24h, jobsDueReviewRequest, invoicesDueReminder,
    invoicesToMarkOverdue, isDigestHour, localYmd, jobsToday
} from './conditions';
import { report as reportError } from '@/lib/observability';
import { readHeartbeat, writeHeartbeat, staleness } from '@/lib/heartbeat';
import { deployEnv } from '@/lib/env';
import type { Client, Invoice, Job, Lead, Site } from '@/lib/db/types';

export type TickReport = Record<string, number | string>;

/** One hourly pass. Every branch is idempotent through the notifications log. */
export async function runTick(now = new Date()): Promise<TickReport> {
    const db = supabaseAdmin();
    const base = appUrl();
    const report: TickReport = { at: now.toISOString() };
    const today = localYmd(now);
    const startedAt = Date.now();

    /* ---- Dead-man's switch, layer 1: did the PREVIOUS tick happen? ----
       This catches a scheduler that stalled and recovered. An external monitor
       polling for a 200 cannot see that gap — by the time it looks, the tick is
       running again and everything reads healthy — but the reminders that
       should have gone out during the gap never did, and nothing else would
       ever say so.

       Reported and then ignored: the alert is the entire point, and refusing to
       work because we were late would turn one missed hour into two. */
    const previous = await readHeartbeat();
    const gap = staleness(previous, now);
    if (gap.alert && previous) {
        await reportError(new Error('the scheduler missed its window'), {
            severity: 'error',
            source: 'app/cron/tick',
            context: {
                previous_tick_at: previous.last_tick_at,
                this_tick_at: now.toISOString(),
                gap_hours: Math.round((gap.ageMs ?? 0) / 36e5 * 10) / 10,
                consequence: 'reminders, chasers and the digest did not run during the gap'
            }
        });
    }

    /* ---- Every rule runs, whatever the one before it did (SPEC-003 §4) ----
       The tick used to be one long function: the first rule to throw took the
       rest of the hour's work with it, silently. A Supabase hiccup reading
       leads meant no job reminders, no overdue chasers and no digest, and the
       only symptom was a 500 in a log nobody watches.

       Each rule is now isolated and each failure is reported on its own. The
       tick's report says which rules failed, so a caller — and the health
       check in SPEC-004 — can tell "a quiet hour" from "half the scheduler
       did not run", which reading `{ ok: true }` alone never could. */
    const failed: string[] = [];
    const rule = async (name: string, body: () => Promise<void>): Promise<void> => {
        try {
            await body();
        } catch (err) {
            failed.push(name);
            await reportError(err, {
                severity: 'error',
                source: 'app/cron/tick',
                context: { rule: name, at: now.toISOString() }
            });
        }
    };

    /* ---- Lead unanswered after 2h → owner SMS (once per lead) ----
       Production rows only (SPEC-002). This is the rule that pages a phone; a
       lead submitted from a preview must never ring it, even in the window
       before the preview Supabase branch exists and previews still write here. */
    await rule('lead_unanswered_2h', async () => {
        const { data: leads } = await db.from('client_quotes').select('*').eq('status', 'new').eq('source_env', 'production').is('first_response_at', null).gte('created_at', new Date(now.getTime() - 7 * 86400000).toISOString());
        let n = 0;
        for (const lead of unansweredLeads((leads ?? []) as Lead[], now)) {
            if (await alreadySent('lead_unanswered_2h', 'client_quote', lead.id)) continue;
            await dispatch('lead_unanswered_2h', { lead, link: `${base}/portal/leads/${lead.id}` }, { entityType: 'client_quote', entityId: lead.id, idempotent: true });
            n++;
        }
        report.lead_unanswered_2h = n;
    });

    /* ---- 24h before a job → client reminder; owner alert if unstaffed ---- */
    await rule('job_reminder_24h', async () => {
        const { data: upcoming } = await db.from('jobs').select('*').eq('status', 'scheduled')
            .gte('starts_at', new Date(now.getTime() + 22 * 3600000).toISOString())
            .lte('starts_at', new Date(now.getTime() + 26 * 3600000).toISOString());
        let n = 0;
        let unstaffed = 0;
        for (const job of jobsStartingIn24h((upcoming ?? []) as Job[], now)) {
            const { client, site } = await jobRefs(job);
            if (!(await alreadySent('job_reminder_24h', 'job', job.id))) {
                await dispatch('job_reminder_24h', { client, job, site, link: `${base}/client/jobs/${job.id}` }, { entityType: 'job', entityId: job.id, idempotent: true });
                n++;
            }
            const { count } = await db.from('shift_assignments').select('id', { count: 'exact', head: true }).in('shift_id', (await db.from('shifts').select('id').eq('job_id', job.id)).data?.map((s) => s.id) ?? ['00000000-0000-0000-0000-000000000000']);
            if (!count && !(await alreadySent('job_unstaffed_24h', 'job', job.id))) {
                await dispatch('job_unstaffed_24h', { client, job, unstaffed: true, link: `${base}/portal/jobs/${job.id}` }, { entityType: 'job', entityId: job.id, idempotent: true });
                unstaffed++;
            }
        }
        report.job_reminder_24h = n;
        report.job_unstaffed_24h = unstaffed;
    });

    /* ---- Job completed + 24h → review request (once) ---- */
    await rule('review_request', async () => {
        const { data: completed } = await db.from('jobs').select('*').eq('status', 'completed').gte('completed_at', new Date(now.getTime() - 14 * 86400000).toISOString());
        let n = 0;
        for (const job of jobsDueReviewRequest((completed ?? []) as Job[], now)) {
            if (await alreadySent('review_request', 'job', job.id)) continue;
            const { client } = await jobRefs(job);
            const { data: review } = await db.from('reviews').upsert({ job_id: job.id, client_id: job.client_id }, { onConflict: 'job_id' }).select('*').single();
            await dispatch('review_request', { client, job, review: review ?? undefined, link: `${base}/review/${review?.token}` }, { entityType: 'job', entityId: job.id, idempotent: true });
            n++;
        }
        report.review_request = n;
    });

    /* ---- Overdue invoices: mark, then remind at day 1, 7, 14 ----
       The digest reads the same list, so it is assigned as soon as it is
       read: a failure later in this rule must not leave the digest claiming
       there are no unpaid invoices when it simply never got to look. */
    let openInvoices: Invoice[] = [];
    await rule('invoice_overdue', async () => {
        const { data: open } = await db.from('invoices').select('*').in('status', ['sent', 'partially_paid', 'overdue']);
        openInvoices = (open ?? []) as Invoice[];
        const toMark = invoicesToMarkOverdue(openInvoices, today);
        if (toMark.length) await db.from('invoices').update({ status: 'overdue' }).in('id', toMark.map((i) => i.id));
        report.marked_overdue = toMark.length;
        let n = 0;
        for (const { invoice, days } of invoicesDueReminder(openInvoices, today)) {
            if (await alreadySent('invoice_overdue', 'invoice', invoice.id, `day${days}`)) continue;
            const client = invoice.client_id ? await clientById(invoice.client_id) : null;
            await dispatch('invoice_overdue', { client, invoice, overdueDays: days, link: `${base}/pay/${invoice.pay_token}` }, { entityType: 'invoice', entityId: invoice.id, idempotent: true, dedupeSuffix: `day${days}` });
            n++;
        }
        report.invoice_overdue = n;
    });

    /* ---- Daily 7am digest ---- */
    await rule('daily_digest', async () => {
        if (isDigestHour(now) && !(await alreadySent('daily_digest', 'digest', DIGEST_ENTITY, today))) {
            const dayStart = new Date(`${today}T00:00:00-05:00`);
            const { data: todays } = await db.from('jobs').select('*').gte('starts_at', new Date(dayStart.getTime() - 12 * 3600000).toISOString()).lte('starts_at', new Date(dayStart.getTime() + 36 * 3600000).toISOString());
            const { data: newLeads } = await db.from('client_quotes').select('*').eq('status', 'new').eq('source_env', 'production').order('created_at', { ascending: false }).limit(20);
            await dispatch('daily_digest', {
                digest: {
                    jobsToday: jobsToday((todays ?? []) as Job[], now),
                    newLeads: (newLeads ?? []) as Lead[],
                    unpaid: openInvoices,
                    leadLink: `${base}/portal/leads`, invoiceLink: `${base}/portal/invoices`, jobLink: `${base}/portal/jobs`
                }
            }, { entityType: 'digest', entityId: DIGEST_ENTITY, idempotent: true, dedupeSuffix: today });
            report.daily_digest = 1;
        } else {
            report.daily_digest = 0;
        }
    });

    /* Present only when something actually failed, so a healthy tick's report
       stays exactly the shape it has always been. */
    if (failed.length) {
        report.failed_rules = failed.join(',');
        report.failed = failed.length;
    }

    /* ---- Dead-man's switch, layer 2: leave the mark the health check reads ----
       Written last and unconditionally, including when rules failed: the tick
       DID run, and that is exactly what this records. Conflating "ran badly"
       with "did not run" would send the wrong engineer after the wrong thing.
       Which rules failed is carried in the same row, so the health endpoint can
       tell a quiet hour from half a scheduler. */
    await writeHeartbeat({
        last_tick_at: now.toISOString(),
        duration_ms: Date.now() - startedAt,
        failed_rules: failed,
        rules: { ...report },
        env: deployEnv()
    });

    return report;
}

/* A fixed UUID names "the digest" in the notifications entity columns. */
const DIGEST_ENTITY = '00000000-0000-4000-8000-00000000d1ce';

async function clientById(id: string): Promise<Client | null> {
    const { data } = await supabaseAdmin().from('clients').select('*').eq('id', id).maybeSingle();
    return (data as Client) ?? null;
}

async function jobRefs(job: Job): Promise<{ client: Client | null; site: Site | null }> {
    const db = supabaseAdmin();
    const [{ data: client }, { data: site }] = await Promise.all([
        db.from('clients').select('*').eq('id', job.client_id).maybeSingle(),
        job.site_id ? db.from('sites').select('*').eq('id', job.site_id).maybeSingle() : Promise.resolve({ data: null })
    ]);
    return { client: (client as Client) ?? null, site: (site as Site) ?? null };
}
