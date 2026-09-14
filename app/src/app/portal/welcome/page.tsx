import { redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth';
import { PageHead, Field } from '@/components/ui';
import { StatusFromSearch, type SearchStatus } from '@/components/status-from-search';
import { setInitialPassword } from '@/lib/actions/settings';
import { MIN_PASSWORD_LENGTH } from '@/lib/security/policy';

export const dynamic = 'force-dynamic';

/* The portal layout sends an account still on its temporary password here
   after two-factor sign-in (SPEC-012 §4). Anyone else who lands here has
   nothing to do, so they go to Today rather than see a form that would
   change a password they already chose. */
export default async function WelcomePage({ searchParams }: { searchParams: Promise<SearchStatus> }) {
    const session = await requireStaff();
    if (!session.mustChangePassword) redirect('/portal');
    return (
        <>
            <PageHead eyebrow="Welcome" title="Set your password" />
            <StatusFromSearch params={await searchParams} />
            <form action={setInitialPassword} className="card stack mt-4">
                <p>
                    Your account was made with a temporary password that someone else has seen. Choose one only you know
                    before you continue.
                </p>
                <Field id="welcome_pw" label="New password" hint={`At least ${MIN_PASSWORD_LENGTH} characters. A short sentence is easy to remember.`}>
                    <input id="welcome_pw" name="password" type="password" minLength={MIN_PASSWORD_LENGTH} required autoComplete="new-password" aria-describedby="welcome_pw-hint" enterKeyHint="next" />
                </Field>
                <Field id="welcome_confirm" label="Type it again">
                    <input id="welcome_confirm" name="confirm" type="password" minLength={MIN_PASSWORD_LENGTH} required autoComplete="new-password" enterKeyHint="done" />
                </Field>
                <div className="row">
                    <button className="btn btn--gold" type="submit">Save my password</button>
                </div>
            </form>
        </>
    );
}
