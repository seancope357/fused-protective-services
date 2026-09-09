'use client';

import { useActionState, useState } from 'react';
import { requestMagicLink, signInWithPassword, type AuthState } from '@/lib/auth-actions';

const initial: AuthState = {};

export function LoginForms({ next }: { next: string }) {
    const [mode, setMode] = useState<'client' | 'staff'>('client');
    const [linkState, linkAction, linkPending] = useActionState(requestMagicLink, initial);
    const [pwState, pwAction, pwPending] = useActionState(signInWithPassword, initial);

    return (
        <div className="stack">
            <div className="row" role="tablist" aria-label="Sign-in method">
                <button type="button" role="tab" aria-selected={mode === 'client'} className={`btn btn--sm ${mode === 'client' ? 'btn--gold' : 'btn--ghost'}`} onClick={() => setMode('client')}>
                    Client or officer
                </button>
                <button type="button" role="tab" aria-selected={mode === 'staff'} className={`btn btn--sm ${mode === 'staff' ? 'btn--gold' : 'btn--ghost'}`} onClick={() => setMode('staff')}>
                    Command staff
                </button>
            </div>

            {mode === 'client' ? (
                <form action={linkAction} className="stack" aria-busy={linkPending}>
                    <input type="hidden" name="next" value={next} />
                    <div className="field">
                        <label htmlFor="link-email">Email address</label>
                        <input id="link-email" name="email" type="email" autoComplete="email" required placeholder="you@company.com" />
                        <div className="field__hint">We email you a one-time sign-in link. No password to remember.</div>
                    </div>
                    <button type="submit" className="btn btn--gold btn--block" disabled={linkPending}>
                        {linkPending ? 'Sending…' : 'Email me a sign-in link'}
                    </button>
                    <p className={`alert ${linkState.error ? 'alert--bad' : 'alert--good'}`} role="status" aria-live="polite">
                        {linkState.error ?? linkState.message ?? ''}
                    </p>
                </form>
            ) : (
                <form action={pwAction} className="stack" aria-busy={pwPending}>
                    <input type="hidden" name="next" value={next === '/' ? '/portal' : next} />
                    <div className="field">
                        <label htmlFor="pw-email">Email address</label>
                        <input id="pw-email" name="email" type="email" autoComplete="username" required />
                    </div>
                    <div className="field">
                        <label htmlFor="pw-password">Password</label>
                        <input id="pw-password" name="password" type="password" autoComplete="current-password" required />
                    </div>
                    <button type="submit" className="btn btn--gold btn--block" disabled={pwPending}>
                        {pwPending ? 'Signing in…' : 'Sign in'}
                    </button>
                    <p className="alert alert--bad" role="status" aria-live="polite">{pwState.error ?? ''}</p>
                </form>
            )}
        </div>
    );
}
