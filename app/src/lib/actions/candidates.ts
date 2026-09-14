'use server';

/* ==========================================================================
   CANDIDATE PIPELINE — server actions (SPEC-010)

   Every write to public.candidate_applications the portal makes goes through
   here. The rules the pipeline has to keep are not restated in this file: they
   live in `planTransition` in @/lib/shared, next to the vocabulary they are
   about, so the same rule the UI renders is the rule the action enforces and
   app/tests/candidates.test.ts can prove it without a database.

   `stage_changed_at` is deliberately absent from every patch below. The
   database maintains it (trg_candidate_stage_changed_at), so it stays correct
   for a stage moved from the table editor too.

   Nothing here checks the deployment environment. The notification engine is
   already environment-aware (SPEC-002): outside production it renders and logs
   the message with `skipped: 'non_production_env'` and dispatches nothing.
   ========================================================================== */

import { requireStaff } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { dispatch } from '@/lib/notifications';
import { candidateRecipient } from '@/lib/notifications/templates';
import { isVettingStage, planTransition, REJECTED_STAGE, stageNotifiesCandidate, vettingStageLabel } from '@/lib/shared';
import { done, optStr, str } from './util';
import type { Candidate } from '@/lib/db/types';

const detail = (id: string) => `/portal/candidates/${id}`;

async function load(id: string): Promise<Candidate> {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.from('candidate_applications').select('*').eq('id', id).maybeSingle();
    if (!data) done('/portal/candidates', 'Candidate not found.', 'bad');
    return data as Candidate;
}

/**
 * Move a candidate one stage forward, or re-open a rejection.
 *
 * The form posts the stage it believes comes next; if the record has moved
 * underneath it, `planTransition` refuses rather than applying a stale jump.
 */
export async function advanceCandidateStage(formData: FormData): Promise<void> {
    await requireStaff();
    const id = str(formData, 'id');
    const to = str(formData, 'stage');
    const candidate = await load(id);

    if (!isVettingStage(to)) done(detail(id), 'Unknown stage.', 'bad');
    const plan = planTransition(candidate.vetting_stage, to);
    if (!plan.ok) done(detail(id), plan.reason, 'bad');

    const reopening = candidate.vetting_stage === REJECTED_STAGE;
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
        .from('candidate_applications')
        .update({
            vetting_stage: plan.to,
            /* Re-opening clears the rejection reason: it no longer describes the
               record's state, and leaving it would misread as a live rejection. */
            ...(reopening ? { rejection_reason: null } : {})
        })
        .eq('id', id)
        /* The stage we planned from must still be the stage on the row. */
        .eq('vetting_stage', candidate.vetting_stage);
    if (error) done(detail(id), `Could not update the stage: ${error.message}`, 'bad');

    if (reopening) {
        done(detail(id), `Application re-opened at ${vettingStageLabel(plan.to)}. The candidate is not told; contact them yourself.`);
    }

    /* `stageNotifiesCandidate` holds the "no automatic message on reaching the
       roster" rule, so it is one testable decision rather than a condition
       buried in an action (SPEC-010). */
    if (stageNotifiesCandidate(plan.to)) {
        await dispatch(
            'candidate_stage_advanced',
            { client: candidateRecipient(candidate), candidate: { ...candidate, vetting_stage: plan.to } },
            { entityType: 'candidate', entityId: id, idempotent: true, dedupeSuffix: plan.to }
        );
    }

    done(detail(id), `Advanced to ${vettingStageLabel(plan.to)}.`);
}

/**
 * Reject from any stage. The reason is recorded for us and never sent: the
 * candidate's email says only that we are not moving forward.
 */
export async function rejectCandidate(formData: FormData): Promise<void> {
    await requireStaff();
    const id = str(formData, 'id');
    const reason = optStr(formData, 'rejection_reason', 2000);
    const candidate = await load(id);

    const plan = planTransition(candidate.vetting_stage, REJECTED_STAGE);
    if (!plan.ok) done(detail(id), plan.reason, 'bad');

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
        .from('candidate_applications')
        .update({ vetting_stage: REJECTED_STAGE, rejection_reason: reason })
        .eq('id', id)
        .eq('vetting_stage', candidate.vetting_stage);
    if (error) done(detail(id), `Could not reject: ${error.message}`, 'bad');

    await dispatch(
        'candidate_rejected',
        { client: candidateRecipient(candidate), candidate: { ...candidate, vetting_stage: REJECTED_STAGE } },
        { entityType: 'candidate', entityId: id, idempotent: true }
    );

    done(detail(id), 'Application closed and the candidate notified. The reason stays internal.');
}

/** Staff working notes. Internal only; changing them never messages anyone. */
export async function saveCandidateNotes(formData: FormData): Promise<void> {
    await requireStaff();
    const id = str(formData, 'id');
    const notes = optStr(formData, 'internal_notes', 8000);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from('candidate_applications').update({ internal_notes: notes }).eq('id', id);
    if (error) done(detail(id), `Could not save the notes: ${error.message}`, 'bad');
    done(detail(id), 'Notes saved.');
}

/** Hand the application to a member of staff, or take it back to unassigned. */
export async function assignCandidate(formData: FormData): Promise<void> {
    await requireStaff();
    const id = str(formData, 'id');
    const assignee = optStr(formData, 'assigned_to', 64);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from('candidate_applications').update({ assigned_to: assignee }).eq('id', id);
    if (error) done(detail(id), `Could not assign: ${error.message}`, 'bad');
    done(detail(id), assignee ? 'Assigned.' : 'Assignment cleared.');
}
