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
    /* Cameron will usually be doing this on the same phone the authenticator
       app lives on, where a QR code cannot be scanned. So the manual key is
       offered in the first step, not only as an afterthought, and a single tap
       selects the whole key for copying. The QR is capped at the card width so
       it never pushes a 320px screen sideways; it keeps a white ground because
       scanners need the contrast. */
    return (
        <div className="stack">
            <ol className="small" style={{ paddingLeft: 18, lineHeight: 1.8 }}>
                <li>Scan this code with your authenticator app. On the phone the app is on? Open &ldquo;Can&rsquo;t scan?&rdquo; below and copy the key into the app instead.</li>
                <li>Enter the 6-digit code the app shows to finish.</li>
            </ol>
            <img src={start.qr} alt="QR code for the authenticator app" width={200} height={200} style={{ background: 'white', borderRadius: 8, padding: 8, maxWidth: '100%', height: 'auto', boxSizing: 'content-box' }} />
            <details className="disclosure">
                <summary>Can&rsquo;t scan? Enter the key manually</summary>
                <div className="disclosure__body">
                    <p className="mono wrap-anywhere" style={{ userSelect: 'all' }}>{start.secret}</p>
                </div>
            </details>
            <form action={confirmAction} aria-busy={confirming} className="stack">
                <input type="hidden" name="factor_id" value={factorId ?? ''} />
                <div className="field">
                    <label htmlFor="enroll-code">6-digit code</label>
                    <input id="enroll-code" name="code" type="text" inputMode="numeric" pattern="[0-9 ]*" autoComplete="one-time-code" enterKeyHint="done" maxLength={7} required />
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
        <details className="disclosure">
            <summary>Remove the authenticator</summary>
            <form action={action} aria-busy={pending} className="stack disclosure__body">
                <p className="small">Enter a current code to confirm. You will have to enroll again before using the portal.</p>
                <div className="field">
                    <label htmlFor="disable-code">6-digit code</label>
                    <input id="disable-code" name="code" type="text" inputMode="numeric" pattern="[0-9 ]*" autoComplete="one-time-code" enterKeyHint="done" maxLength={7} required />
                </div>
                <button type="submit" className="btn btn--danger" disabled={pending}>Turn off two-factor</button>
                <p className="alert alert--bad" role="status" aria-live="polite">{state.error ?? ''}</p>
            </form>
        </details>
    );
}
