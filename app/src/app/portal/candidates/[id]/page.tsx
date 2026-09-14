import { notFound } from 'next/navigation';
import { getCandidate, listStaffProfiles } from '@/lib/domain/queries';
import { PageHead, Badge, Field, Empty } from '@/components/ui';
import { StatusFromSearch, type SearchStatus } from '@/components/status-from-search';
import { advanceCandidateStage, assignCandidate, rejectCandidate, saveCandidateNotes } from '@/lib/actions/candidates';
import { fmtDateTime } from '@/lib/format';
import { nextVettingStage, positionTitle, REJECTED_STAGE, vettingStageById, vettingStageLabel, vettingStageOrder } from '@/lib/shared';
import { timelineFor } from '@/lib/domain/timeline';
import { Timeline } from '@/components/timeline';

export const dynamic = 'force-dynamic';

export default async function CandidatePage({
    params,
    searchParams
}: {
    params: Promise<{ id: string }>;
    searchParams: Promise<SearchStatus>;
}) {
    const { id } = await params;
    const candidate = await getCandidate(id);
    if (!candidate) notFound();

    const [staff, events] = await Promise.all([
        listStaffProfiles(),
        timelineFor({ entityType: 'candidate', id })
    ]);

    const stage = vettingStageById(candidate.vetting_stage);
    const rejected = candidate.vetting_stage === REJECTED_STAGE;
    const roster = candidate.vetting_stage === vettingStageOrder[vettingStageOrder.length - 1];
    /* One step forward, or — from a rejection — back to the start. Never a
       select of every stage: the UI must not offer a move the action refuses. */
    const next = rejected ? vettingStageOrder[0] : nextVettingStage(candidate.vetting_stage);

    return (
        <>
            <PageHead
                eyebrow={`Candidate ${candidate.ref_code}`}
                title={candidate.full_name}
                actions={
                    <>
                        <a className="btn btn--ghost" href={`tel:${candidate.phone}`}>Call {candidate.phone}</a>
                        <a className="btn btn--ghost" href={`mailto:${candidate.email}`}>Email</a>
                    </>
                }
            >
                Applied {fmtDateTime(candidate.created_at)} · <Badge status={candidate.vetting_stage}>{vettingStageLabel(candidate.vetting_stage)}</Badge>
                {' '}since {fmtDateTime(candidate.stage_changed_at)}
                {candidate.source_env !== 'production' ? <> · <Badge tone="bad">{candidate.source_env} submission</Badge></> : null}
            </PageHead>
            <StatusFromSearch params={await searchParams} />

            <div className="grid grid--2 mt-4">
                <section className="card">
                    <h2 className="mb-4">Application as submitted</h2>
                    <dl className="kv">
                        <dt>Position</dt><dd>{positionTitle(candidate.position_id)}</dd>
                        <dt>Licence level</dt><dd>{candidate.license_level.replace(/-/g, ' ')}</dd>
                        <dt>TOPS number</dt><dd className="mono">{candidate.tops_number ?? '—'}</dd>
                        <dt>Service branch</dt><dd>{candidate.service_branch ?? '—'}</dd>
                        <dt>Phone</dt><dd>{candidate.phone}</dd>
                        <dt>Email</dt><dd>{candidate.email}</dd>
                        <dt>SMS consent</dt><dd>{candidate.sms_consent ? `Yes, ${fmtDateTime(candidate.sms_consent_at)}` : 'No'}</dd>
                        <dt>Background</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{candidate.bio}</dd>
                    </dl>
                </section>

                <div className="stack">
                    <section className="card stack">
                        <h2>Vetting protocol</h2>
                        <p className="small muted">
                            {stage?.published && stage.checkpoint
                                ? `Gate metric: ${stage.checkpoint}`
                                : rejected
                                    ? 'This application is closed. Re-opening it returns the candidate to the start of the protocol and is recorded.'
                                    : 'Not yet started on the published protocol.'}
                        </p>

                        <ol className="stack" style={{ listStyle: 'none', paddingLeft: 0 }}>
                            {vettingStageOrder.map((sid) => {
                                const s = vettingStageById(sid)!;
                                const reached = !rejected && vettingStageOrder.indexOf(candidate.vetting_stage as typeof vettingStageOrder[number]) >= vettingStageOrder.indexOf(sid);
                                const current = candidate.vetting_stage === sid;
                                return (
                                    <li key={sid} className="row small">
                                        <Badge status={current ? sid : undefined} tone={current ? 'gold' : reached ? 'good' : undefined}>
                                            {s.step ? `Stage ${s.step}` : 'Intake'}
                                        </Badge>
                                        <span className={current ? '' : 'muted'}>{s.label}</span>
                                    </li>
                                );
                            })}
                        </ol>

                        {next ? (
                            <form action={advanceCandidateStage}>
                                <input type="hidden" name="id" value={candidate.id} />
                                <input type="hidden" name="stage" value={next} />
                                <button className="btn btn--gold" type="submit">
                                    {rejected ? `Re-open at ${vettingStageLabel(next)}` : `Advance to ${vettingStageLabel(next)}`}
                                </button>
                            </form>
                        ) : (
                            <p className="small muted">
                                {roster
                                    ? 'End of the protocol. Activating an officer record, pay rate and assignments is a separate, manual step — this portal deliberately does not create one.'
                                    : 'No forward move is available from here.'}
                            </p>
                        )}

                        {!rejected ? (
                            <form action={rejectCandidate} className="stack">
                                <input type="hidden" name="id" value={candidate.id} />
                                <Field id="rejection_reason" label="Reason for closing (internal only)" hint="Never sent to the candidate and never quoted in the email.">
                                    <textarea id="rejection_reason" name="rejection_reason" rows={2} defaultValue={candidate.rejection_reason ?? ''} />
                                </Field>
                                <button className="btn btn--ghost" type="submit">Reject and notify the candidate</button>
                            </form>
                        ) : candidate.rejection_reason ? (
                            <dl className="kv"><dt>Internal reason</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{candidate.rejection_reason}</dd></dl>
                        ) : null}
                    </section>

                    <section className="card stack">
                        <h2>Assignment</h2>
                        <form action={assignCandidate} className="stack">
                            <input type="hidden" name="id" value={candidate.id} />
                            <Field id="assigned_to" label="Owned by">
                                <select id="assigned_to" name="assigned_to" defaultValue={candidate.assigned_to ?? ''}>
                                    <option value="">Unassigned</option>
                                    {staff.map((s) => <option key={s.id} value={s.id}>{s.full_name || s.email || s.id}</option>)}
                                </select>
                            </Field>
                            <button className="btn btn--ghost btn--sm" type="submit">Save assignment</button>
                        </form>
                    </section>

                    <section className="card stack">
                        <h2>Internal notes</h2>
                        <form action={saveCandidateNotes} className="stack">
                            <input type="hidden" name="id" value={candidate.id} />
                            <Field id="internal_notes" label="Notes" hint="Staff only. Recorded in the audit trail.">
                                <textarea id="internal_notes" name="internal_notes" rows={6} defaultValue={candidate.internal_notes ?? ''} />
                            </Field>
                            <button className="btn btn--ghost btn--sm" type="submit">Save notes</button>
                        </form>
                    </section>
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                    {events.length ? <Timeline events={events} /> : <Empty>No recorded activity on this application yet.</Empty>}
                </div>
            </div>
        </>
    );
}
