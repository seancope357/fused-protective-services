import Link from 'next/link';
import { site } from '@/lib/shared';

export default function NotFound() {
    return (
        <div className="auth-shell">
            <div className="card card--gold auth-card stack">
                <h1>Not found</h1>
                <p>That link is not valid or has expired. If you followed it from an email, sign in to the portal to find the document.</p>
                <div className="row"><Link href="/login" className="btn btn--gold">Sign in</Link><a href={`tel:${site.phone.e164}`} className="btn btn--ghost">Call {site.phone.display}</a></div>
            </div>
        </div>
    );
}
