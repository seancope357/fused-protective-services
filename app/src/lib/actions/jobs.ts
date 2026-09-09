'use server';

import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { dispatch } from '@/lib/notifications';
import { appUrl, armedLevels, divisionByQuoteValue } from '@/lib/shared';
import { occurrences } from '@/lib/domain/schedule';
import { parseFloatSafe, parseIntSafe } from '@/lib/money';
import { done, str, optStr, localToIso } from './util';
import type { Client, Job, Site } from '@/lib/db/types';

function readJob(fd: FormData) {
    const starts = localToIso(str(fd, 'starts_at'));
    const ends = localToIso(str(fd, 'ends_at'));
    const division = divisionByQuoteValue(str(fd, 'division_quote_value'));
    return {
        client_id: str(fd, 'client_id'),
        site_id: optStr(fd, 'site_id'),
        division_quote_value: division?.quoteValue ?? str(fd, 'division_quote_value'),
        title: str(fd, 'title', 200),
        starts_at: starts,
        ends_at: ends,
        recurrence_rule: optStr(fd, 'recurrence_rule', 120),
        recurrence_until: optStr(fd, 'recurrence_until', 10),
        arrival_window: optStr(fd, 'arrival_window', 200) ?? 'Officers arrive 30 minutes before start',
        onsite_contact_name: optStr(fd, 'onsite_contact_name', 200),
        onsite_contact_phone: optStr(fd, 'onsite_contact_phone', 40),
        client_prep_notes: optStr(fd, 'client_prep_notes', 4000),
        post_orders: optStr(fd, 'post_orders', 8000),
        deposit_pct: Math.min(100, Math.max(0, parseFloatSafe(fd.get('deposit_pct'), 0)))
    };
}

function readShiftDefaults(fd: FormData) {
    const armed = str(fd, 'armed_level');
    const level = armedLevels.find((l) => l.id === armed) ?? armedLevels[1];
    return {
        officers_required: Math.max(1, parseIntSafe(fd.get('officers_required'), 1)),
        armed_level: level.id,
        bill_rate_cents: Math.round(parseFloatSafe(fd.get('bill_rate'), level.rateCents ? level.rateCents / 100 : 0) * 100)
    };
}

export async function createJob(formData: FormData): Promise<void> {
    const session = await requireStaff();
    const row = readJob(formData);
    if (!row.client_id || !row.title || !row.starts_at || !row.ends_at) done('/portal/jobs/new', 'Client, title, start and end are required.', 'bad');
    if (new Date(row.ends_at) <= new Date(row.starts_at)) done('/portal/jobs/new', 'The end must be after the start.', 'bad');
    const supabase = await createSupabaseServerClient();
    const { data: job, error } = await supabase.from('jobs').insert({ ...row, created_by: session.userId }).select('id').single();
    if (error || !job) done('/portal/jobs/new', `Could not create job: ${error?.message}`, 'bad');
    const defaults = readShiftDefaults(formData);
    const shifts = occurrences(row.starts_at, row.ends_at, row.recurrence_rule, row.recurrence_until).map((o) => ({ job_id: job.id, ...o, ...defaults }));
    const { error: shiftError } = await supabase.from('shifts').insert(shifts);
    if (shiftError) done(`/portal/jobs/${job.id}`, `Job created but shifts failed: ${shiftError.message}`, 'warn');
    redirect(`/portal/jobs/${job.id}?msg=${encodeURIComponent(`Job created with ${shifts.length} shift${shifts.length === 1 ? '' : 's'}.`)}&tone=good`);
}

export async function updateJob(formData: FormData): Promise<void> {
    await requireStaff();
    const id = str(formData, 'id');
    const row = readJob(formData);
    if (!row.title || !row.starts_at || !row.ends_at) done(`/portal/jobs/${id}`, 'Title, start and end are required.', 'bad');
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from('jobs').update(row).eq('id', id);
    if (error) done(`/portal/jobs/${id}`, `Could not save: ${error.message}`, 'bad');
    done(`/portal/jobs/${id}`, 'Job saved.');
}

export async function saveShift(formData: FormData): Promise<void> {
    await requireStaff();
    const jobId = str(formData, 'job_id');
    const id = optStr(formData, 'id');
    const starts = localToIso(str(formData, 'starts_at'));
    const ends = localToIso(str(formData, 'ends_at'));
    if (!starts || !ends || new Date(ends) <= new Date(starts)) done(`/portal/jobs/${jobId}`, 'A shift needs a start and a later end.', 'bad');
    const row = { job_id: jobId, starts_at: starts, ends_at: ends, ...readShiftDefaults(formData), notes: optStr(formData, 'notes', 1000) };
    const supabase = await createSupabaseServerClient();
    const { error } = id ? await supabase.from('shifts').update(row).eq('id', id) : await supabase.from('shifts').insert(row);
    if (error) done(`/portal/jobs/${jobId}`, `Could not save shift: ${error.message}`, 'bad');
    done(`/portal/jobs/${jobId}`, id ? 'Shift saved.' : 'Shift added.');
}

export async function deleteShift(formData: FormData): Promise<void> {
    await requireStaff();
    const jobId = str(formData, 'job_id');
    const supabase = await createSupabaseServerClient();
    await supabase.from('shifts').delete().eq('id', str(formData, 'id')).eq('job_id', jobId);
    done(`/portal/jobs/${jobId}`, 'Shift removed.');
}

async function loadJobCtx(jobId: string) {
    const admin = supabaseAdmin();
    const { data: job } = await admin.from('jobs').select('*').eq('id', jobId).maybeSingle();
    if (!job) return null;
    const [{ data: client }, { data: site }] = await Promise.all([
        admin.from('clients').select('*').eq('id', job.client_id).maybeSingle(),
        job.site_id ? admin.from('sites').select('*').eq('id', job.site_id).maybeSingle() : Promise.resolve({ data: null })
    ]);
    return { job: job as Job, client: client as Client | null, site: (site as Site) ?? null };
}

/** Sends the pre-job brief. Re-sendable; every send is logged. */
export async function confirmJob(formData: FormData): Promise<void> {
    await requireStaff();
    const id = str(formData, 'id');
    const ctx = await loadJobCtx(id);
    if (!ctx) done('/portal/jobs', 'Job not found.', 'bad');
    await supabaseAdmin().from('jobs').update({ confirmed_at: ctx.job.confirmed_at ?? new Date().toISOString() }).eq('id', id);
    const summary = await dispatch('job_confirmed', { ...ctx, link: `${appUrl()}/client/jobs/${id}` }, { entityType: 'job', entityId: id });
    done(`/portal/jobs/${id}`, summary.sent ? `Brief sent to ${ctx.client?.billing_email}.` : 'Job confirmed, but the brief email did not send (no client email or sender not configured).', summary.sent ? 'good' : 'warn');
}

export async function setJobStatus(formData: FormData): Promise<void> {
    await requireStaff();
    const id = str(formData, 'id');
    const status = str(formData, 'status');
    if (!['scheduled', 'in_progress', 'completed', 'cancelled'].includes(status)) done(`/portal/jobs/${id}`, 'Not a valid status.', 'bad');
    const admin = supabaseAdmin();
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { status };
    if (status === 'completed') { patch.completed_at = now; patch.completion_summary = optStr(formData, 'completion_summary', 4000); }
    if (status === 'cancelled') patch.cancelled_at = now;
    await admin.from('jobs').update(patch).eq('id', id);
    if (status === 'completed' || status === 'cancelled') await admin.from('shifts').update({ status }).eq('job_id', id).neq('status', 'cancelled');
    if (status === 'completed') {
        const ctx = await loadJobCtx(id);
        if (ctx) await dispatch('job_completed', { ...ctx, link: `${appUrl()}/client/jobs/${id}` }, { entityType: 'job', entityId: id, idempotent: true });
        done(`/portal/jobs/${id}`, 'Job completed. The client has been sent a summary; the review request follows in 24 hours. Generate the balance invoice below.');
    }
    done(`/portal/jobs/${id}`, `Job marked ${status.replace('_', ' ')}.`);
}
