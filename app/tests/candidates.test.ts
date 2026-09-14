/* ==========================================================================
   CANDIDATE PIPELINE (SPEC-010)

   The pipeline is described in three places that have no compile-time link:

     1. `src/data/careers.mjs` → `vettingStages`, which the public careers page
        renders and which carries each published stage's machine id;
     2. the CHECK on `public.candidate_applications.vetting_stage`;
     3. `vettingStageOrder` in `@/lib/shared`, which gives those ids a type and
        the forward order SQL cannot express.

   The first suite pins all three against each other. It reads the CHECK out of
   the migration file rather than trusting a copy of it, so adding a stage to the
   database without adding it to the careers page — or the reverse — fails here
   rather than in production, where it would mean a candidate sitting in a stage
   the portal cannot name.
   ========================================================================== */

import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { vettingStages } from '../shared/src/data/careers.mjs';
import {
    isVettingStage,
    nextVettingStage,
    planTransition,
    REJECTED_STAGE,
    stageNotifiesCandidate,
    vettingPipeline,
    vettingStageById,
    vettingStageIds,
    vettingStageLabel,
    vettingStageOrder,
    type VettingStage
} from '@/lib/shared';
import { candidateRecipient, rulesFor } from '@/lib/notifications/templates';
import { dispatchWith, type EngineDeps, type LogRow } from '@/lib/notifications/engine';
import type { Candidate } from '@/lib/db/types';

/** The CHECK as the database actually spells it, read from the applied migration. */
function stagesFromTheDatabaseCheck(): string[] {
    const migration = fileURLToPath(new URL('../../supabase/migrations/20260904000000_fused_core_schema.sql', import.meta.url));
    const sql = readFileSync(migration, 'utf8');
    const check = /CHECK\s*\(\s*vetting_stage\s+IN\s*\(([^)]*)\)\s*\)/i.exec(sql);
    if (!check) throw new Error('No CHECK on vetting_stage found in the core schema migration.');
    return [...check[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

/* The two ids the careers page deliberately does not publish as stages.
   Spelled out here so that a change to either list has to change this line too:
   the point of the test is that the gap is a decision, not an oversight. */
const NOT_PUBLISHED_AS_STAGES = ['application_received', REJECTED_STAGE];

describe('the stage vocabulary is one vocabulary', () => {
    it('the portal knows exactly the stages the database CHECK allows', () => {
        expect([...vettingStageIds].sort()).toEqual(stagesFromTheDatabaseCheck().sort());
    });

    it('every id in careers.mjs is a database stage, and the site publishes five of them', () => {
        const published = (vettingStages as { id: string; step: string }[]).map((s) => s.id);
        const allowed = stagesFromTheDatabaseCheck();

        expect(published).toHaveLength(5);
        for (const id of published) expect(allowed, `careers.mjs stage "${id}" is not a database value`).toContain(id);
        /* Steps stay 01…05 and in order: the site renders them as a numbered protocol. */
        expect((vettingStages as { step: string }[]).map((s) => s.step)).toEqual(['01', '02', '03', '04', '05']);
    });

    it('exactly two database values have no published stage, and they are the entry and the exit', () => {
        const published = new Set((vettingStages as { id: string }[]).map((s) => s.id));
        const unmapped = stagesFromTheDatabaseCheck().filter((id) => !published.has(id));

        expect(unmapped.sort()).toEqual([...NOT_PUBLISHED_AS_STAGES].sort());
        /* Neither is a stage a candidate is evaluated in: one is the state a row
           arrives in, the other is the exit taken from any stage. */
        expect(vettingStageById('application_received')?.published).toBe(false);
        expect(vettingStageById(REJECTED_STAGE)?.published).toBe(false);
        expect(vettingPipeline.filter((s) => s.published)).toHaveLength(5);
    });

    it('the forward order starts at the arrival state and ends at the roster, with rejection outside it', () => {
        expect(vettingStageOrder[0]).toBe('application_received');
        expect(vettingStageOrder[vettingStageOrder.length - 1]).toBe('active_roster');
        expect(vettingStageOrder).not.toContain(REJECTED_STAGE);
        /* The five published stages follow the arrival state, in careers.mjs order. */
        expect(vettingStageOrder.slice(1)).toEqual((vettingStages as { id: string }[]).map((s) => s.id));
    });

    it('every published label is the careers page\'s own copy, not a portal restatement', () => {
        for (const stage of vettingStages as { id: string; name: string; heading: string; checkpoint: string; step: string }[]) {
            const view = vettingStageById(stage.id)!;
            expect(view.label).toBe(stage.name);
            expect(view.heading).toBe(stage.heading);
            expect(view.checkpoint).toBe(stage.checkpoint);
            expect(view.step).toBe(stage.step);
        }
        /* The two unpublished ids have no site copy, so their names are derived
           from the id itself rather than invented in app/. */
        expect(vettingStageLabel('application_received')).toBe('Application received');
        expect(vettingStageLabel(REJECTED_STAGE)).toBe('Rejected');
    });

    it('recognises its own ids and nothing else', () => {
        for (const id of vettingStageIds) expect(isVettingStage(id)).toBe(true);
        for (const junk of ['hired', 'interview', '', 'Rejected', null, 7]) expect(isVettingStage(junk)).toBe(false);
    });
});

describe('stage transitions', () => {
    const ok = (from: VettingStage, to: VettingStage) => planTransition(from, to);

    it('advances exactly one stage at a time', () => {
        for (let i = 0; i < vettingStageOrder.length - 1; i++) {
            const from = vettingStageOrder[i];
            const to = vettingStageOrder[i + 1];
            expect(nextVettingStage(from)).toBe(to);
            expect(ok(from, to)).toEqual({ ok: true, to });
        }
    });

    it('refuses to skip a stage — the compliance narrative the site publishes has no shortcut', () => {
        const plan = ok('application_received', 'active_roster');
        expect(plan.ok).toBe(false);
        expect(plan.ok === false && plan.reason).toMatch(/cannot be skipped/i);

        /* Every non-adjacent forward pair is refused, not just the worst one. */
        for (let i = 0; i < vettingStageOrder.length; i++) {
            for (let j = i + 2; j < vettingStageOrder.length; j++) {
                expect(ok(vettingStageOrder[i], vettingStageOrder[j]).ok, `${vettingStageOrder[i]} → ${vettingStageOrder[j]}`).toBe(false);
            }
        }
    });

    it('refuses to move backwards along the pipeline', () => {
        for (let i = 1; i < vettingStageOrder.length; i++) {
            for (let j = 0; j < i; j++) {
                expect(ok(vettingStageOrder[i], vettingStageOrder[j]).ok, `${vettingStageOrder[i]} → ${vettingStageOrder[j]}`).toBe(false);
            }
        }
    });

    it('rejects from any stage, including the roster', () => {
        for (const from of vettingStageOrder) {
            expect(ok(from, REJECTED_STAGE)).toEqual({ ok: true, to: REJECTED_STAGE });
        }
    });

    it('re-opens a rejection at the start and nowhere else', () => {
        expect(ok(REJECTED_STAGE, 'application_received')).toEqual({ ok: true, to: 'application_received' });
        for (const to of vettingStageOrder.slice(1)) {
            const plan = ok(REJECTED_STAGE, to);
            expect(plan.ok, `rejected → ${to}`).toBe(false);
            expect(plan.ok === false && plan.reason).toMatch(/re-opens at/i);
        }
    });

    it('will not re-apply the stage a candidate is already in, and has nowhere to go from the roster', () => {
        for (const stage of vettingStageIds) expect(ok(stage, stage).ok).toBe(false);
        expect(nextVettingStage('active_roster')).toBeNull();
        expect(nextVettingStage(REJECTED_STAGE)).toBeNull();
    });

    it('refuses a stage that is not in the vocabulary at all', () => {
        expect(planTransition('application_received', 'hired' as VettingStage).ok).toBe(false);
        expect(planTransition('promoted' as VettingStage, 'tops_audit').ok).toBe(false);
    });
});

/* ==========================================================================
   Notifications. The engine is untouched (SPEC-002 made it environment-aware
   and SPEC-010 inherits that); these prove the two candidate rules behave.
   ========================================================================== */

const candidate = (over: Partial<Candidate> = {}): Candidate => ({
    id: 'cand-1',
    ref_code: 'TX-CAND-ABC234',
    position_id: 'pos-ppo',
    license_level: 'level-4',
    full_name: 'Dana Reyes',
    phone: '(512) 555-0142',
    email: 'dana@example.com',
    tops_number: 'TOPS-99887',
    service_branch: 'usmc',
    bio: 'Ten years of close protection.',
    vetting_stage: 'tops_audit',
    stage_changed_at: '2026-09-12T15:00:00Z',
    rejection_reason: null,
    internal_notes: null,
    assigned_to: null,
    sms_consent: true,
    sms_consent_at: '2026-09-10T00:00:00Z',
    source_env: 'production',
    created_at: '2026-09-10T00:00:00Z',
    ...over
});

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
        isProduction: () => true,
        ...over
    };
    return { deps, log };
}

describe('candidate notifications', () => {
    it('advancing emails the candidate once, and says which stage they reached', async () => {
        const { deps, log } = fakeDeps();
        const c = candidate({ vetting_stage: 'range_physical' });
        const summary = await dispatchWith(
            deps,
            'candidate_stage_advanced',
            { client: candidateRecipient(c), candidate: c },
            { entityType: 'candidate', entityId: c.id, idempotent: true, dedupeSuffix: c.vetting_stage }
        );

        expect(summary).toEqual({ attempted: 1, sent: 1, failed: 0, skipped: 0 });
        expect(deps.sendSms).not.toHaveBeenCalled();
        const msg = (deps.sendEmail as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(msg.to).toBe('dana@example.com');
        expect(msg.subject).toContain('TX-CAND-ABC234');
        expect(msg.text).toContain(vettingStageById('range_physical')!.heading);
        /* One send per (candidate, stage): advancing twice to the same stage cannot double-send. */
        expect(log[0].dedupeKey).toBe('candidate_stage_advanced:candidate:cand-1:email:dana@example.com:range_physical');
    });

    it('the rejection is short, discloses no reason, and says nothing about any check', async () => {
        const { deps } = fakeDeps();
        const c = candidate({ vetting_stage: REJECTED_STAGE, rejection_reason: 'TOPS licence lapsed and not renewable in time.' });
        const summary = await dispatchWith(deps, 'candidate_rejected', { client: candidateRecipient(c), candidate: c }, { entityType: 'candidate', entityId: c.id, idempotent: true });

        expect(summary).toEqual({ attempted: 1, sent: 1, failed: 0, skipped: 0 });
        const msg = (deps.sendEmail as ReturnType<typeof vi.fn>).mock.calls[0][0];

        /* The internal reason never leaves the portal. */
        expect(msg.text).not.toContain('TOPS licence lapsed');
        expect(msg.html).not.toContain('TOPS licence lapsed');
        /* Nothing that reads as a background-check, psychological or licensing result. */
        for (const word of [/background/i, /criminal/i, /psychological/i, /MMPI/i, /drug/i, /credit/i, /disqualif/i, /fail/i]) {
            expect(msg.text, `rejection email must not mention ${word}`).not.toMatch(word);
        }
        expect(msg.text).toMatch(/not be taking your application further/i);
        expect(msg.text).toMatch(/welcome to apply again/i);
    });

    it('reaching the roster sends the candidate nothing, and no rule exists that could', () => {
        expect(stageNotifiesCandidate('active_roster')).toBe(false);
        /* Re-opening a rejection is not an "you have advanced" moment either. */
        expect(stageNotifiesCandidate('application_received')).toBe(false);
        expect(stageNotifiesCandidate(REJECTED_STAGE)).toBe(false);
        for (const stage of vettingStageOrder.slice(1, -1)) expect(stageNotifiesCandidate(stage)).toBe(true);

        for (const trigger of ['candidate_active_roster', 'candidate_hired', 'candidate_roster_activated']) {
            expect(rulesFor(trigger)).toHaveLength(0);
        }
    });

    it('never texts a candidate, whatever consent the careers form recorded', () => {
        const consenting = candidate({ sms_consent: true, phone: '(512) 555-0142' });
        const recipient = candidateRecipient(consenting);
        expect(recipient.sms_consent).toBe(false);
        expect(recipient.billing_phone).toBeNull();
        for (const trigger of ['candidate_stage_advanced', 'candidate_rejected']) {
            for (const rule of rulesFor(trigger)) {
                expect(rule.channels, `${trigger} must be email-only`).toEqual(['email']);
                expect(rule.sms).toBeUndefined();
            }
        }
    });

    it('skips with a logged reason when there is no verified sender yet (Gate B1)', async () => {
        const { deps, log } = fakeDeps({ publicSender: () => null });
        const c = candidate();
        const summary = await dispatchWith(deps, 'candidate_rejected', { client: candidateRecipient(c), candidate: c });

        expect(summary).toEqual({ attempted: 1, sent: 0, failed: 0, skipped: 1 });
        expect(deps.sendEmail).not.toHaveBeenCalled();
        expect(log[0].result.skipped).toBe('no_verified_sender');
        /* The message was still rendered, so the log says what would have gone out. */
        expect(log[0].subject).toContain('TX-CAND-ABC234');
    });

    it('a candidate with no email address is reported, not silently dropped', async () => {
        const { deps, log } = fakeDeps();
        const c = candidate({ email: '' });
        const summary = await dispatchWith(deps, 'candidate_rejected', { client: candidateRecipient(c), candidate: c });

        expect(summary.sent).toBe(0);
        expect(summary.skipped).toBe(1);
        expect(log[0].result.skipped).toBe('no_email_recipient');
    });

    it('outside production nothing is dispatched, and the log says why (inherited from SPEC-002)', async () => {
        const { deps, log } = fakeDeps({ isProduction: () => false });
        const c = candidate();
        const summary = await dispatchWith(deps, 'candidate_stage_advanced', { client: candidateRecipient(c), candidate: c });

        expect(summary).toEqual({ attempted: 1, sent: 0, failed: 0, skipped: 1 });
        expect(deps.sendEmail).not.toHaveBeenCalled();
        expect(log[0].result.skipped).toBe('non_production_env');
        expect(log[0].bodyPreview).toBeTruthy();
    });
});
