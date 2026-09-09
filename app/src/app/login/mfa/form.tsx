'use client';

import { useActionState } from 'react';
import { verifyMfaChallenge, type MfaState } from '@/lib/security/mfa-actions';

export function MfaChallengeForm({ next }: { next: string }) {
    const [state, action, pending] = useActionState(verifyMfaChallenge, {} as MfaState);
    return (
        <form action={action} className="stack" aria-busy={pending}>
            <input type="hidden" name="next" value={next} />
            <div className="field">
                <label htmlFor="code">6-digit code</label>
                <input id="code" name="code" inputMode="numeric" pattern="[0-9 ]*" autoComplete="one-time-code" maxLength={7} required autoFocus />
            </div>
            <button type="submit" className="btn btn--gold btn--block" disabled={pending}>{pending ? 'Verifying…' : 'Verify'}</button>
            <p className="alert alert--bad" role="status" aria-live="polite">{state.error ?? ''}</p>
        </form>
    );
}
