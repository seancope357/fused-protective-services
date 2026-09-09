'use client';

import { useActionState } from 'react';
import { startMfaEnrollment, confirmMfaEnrollment, disableMfa, type MfaState } from '@/lib/security/mfa-actions';

export function EnrollmentPanel() {
    const [start, startAction, starting] = useActionState(startMfaEnrollment, {} as MfaState);
    const [confirm, confirmAction, confirming] = useActionState(confirmMfaEnrollment, {} as MfaState);
    const factorId = confirm.factorId ?? start.factorId;

    if (!start.qr) {
        return (
            <form action={startAction} aria-busy={starting} className="stack">
                <button type="submit" className="btn btn--gold" disabled={starting}>{starting ? 'Preparing…' : 'Start enrollment'}</button>
                <p className="alert alert--bad" role="status" aria-live="polite">{start.error ?? ''}</p>
            </form>
        );
    }
    return (
        <div className="stack">
            <ol className="small" style={{ paddingLeft: 18, lineHeight: 1.8 }}>
                <li>Scan this code with your authenticator app.</li>
                <li>Enter the 6-digit code it shows to finish.</li>
            </ol>
            <img src={start.qr} alt="QR code for the authenticator app" width={200} height={200} style={{ background: '#fff', borderRadius: 8, padding: 8 }} />
            <details><summary className="small" style={{ cursor: 'pointer' }}>Can't scan? Enter the key manually</summary><p className="mono small mt-2" style={{ wordBreak: 'break-all' }}>{start.secret}</p></details>
            <form action={confirmAction} aria-busy={confirming} className="stack">
                <input type="hidden" name="factor_id" value={factorId ?? ''} />
                <div className="field">
                    <label htmlFor="enroll-code">6-digit code</label>
                    <input id="enroll-code" name="code" inputMode="numeric" pattern="[0-9 ]*" autoComplete="one-time-code" maxLength={7} required />
                </div>
                <button type="submit" className="btn btn--gold" disabled={confirming}>{confirming ? 'Verifying…' : 'Turn on two-factor'}</button>
                <p className="alert alert--bad" role="status" aria-live="polite">{confirm.error ?? ''}</p>
            </form>
        </div>
    );
}

export function DisablePanel() {
    const [state, action, pending] = useActionState(disableMfa, {} as MfaState);
    return (
        <details>
            <summary className="small" style={{ cursor: 'pointer' }}>Remove the authenticator</summary>
            <form action={action} aria-busy={pending} className="stack mt-4">
                <p className="small">Enter a current code to confirm. You will have to enroll again before using the portal.</p>
                <div className="field">
                    <label htmlFor="disable-code">6-digit code</label>
                    <input id="disable-code" name="code" inputMode="numeric" pattern="[0-9 ]*" maxLength={7} required />
                </div>
                <button type="submit" className="btn btn--danger" disabled={pending}>Turn off two-factor</button>
                <p className="alert alert--bad" role="status" aria-live="polite">{state.error ?? ''}</p>
            </form>
        </details>
    );
}
