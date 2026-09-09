import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { StatusFromSearch, type SearchStatus } from '@/components/status-from-search';
import { Field } from '@/components/ui';
import { submitReview } from '@/lib/actions/reviews';
import { fmtDateOnly } from '@/lib/format';
import { site } from '@/lib/shared';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Leave a review' };

export default async function ReviewPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<SearchStatus> }) {
    const { token } = await params;
    if (!/^[0-9a-f]{48}$/.test(token)) notFound();
    const { data: review } = await supabaseAdmin().from('reviews').select('*, jobs(title, starts_at), clients(name, billing_contact_name)').eq('token', token).maybeSingle();
    if (!review) notFound();
    const job = review.jobs as { title: string; starts_at: string } | null;
    const client = review.clients as { name: string; billing_contact_name: string | null } | null;

    return (
        <div className="auth-shell">
            <div className="card card--gold stack" style={{ width: 'min(560px, 100%)' }}>
                <div className="row" style={{ gap: 10 }}>
                    <img src={`${site.url}/${site.logo}`} alt="" width={40} height={40} style={{ borderRadius: 8 }} />
                    <div><div className="shell__brand-title">{site.shortName}</div><div className="shell__brand-sub">How did we do?</div></div>
                </div>
                <p>{job?.title} · {fmtDateOnly(job?.starts_at.slice(0, 10))} · {client?.name}</p>
                <StatusFromSearch params={await searchParams} />
                {review.status === 'submitted' ? (
                    <p className="alert alert--good">Thank you — your review is on file{review.rating ? ` (${review.rating}/5)` : ''}.</p>
                ) : (
                    <form action={submitReview} className="stack">
                        <input type="hidden" name="token" value={token} />
                        <fieldset style={{ border: 0 }}>
                            <legend className="field__label mb-2">Rating</legend>
                            <div className="stars" role="radiogroup" aria-label="Star rating">
                                {[1, 2, 3, 4, 5].map((n) => <span key={n}><input type="radio" id={`star-${n}`} name="rating" value={n} required /><label htmlFor={`star-${n}`} aria-label={`${n} star${n === 1 ? '' : 's'}`}>★</label></span>)}
                            </div>
                        </fieldset>
                        <Field id="body" label="What stood out?"><textarea id="body" name="body" rows={4} maxLength={4000} /></Field>
                        <Field id="author_name" label="Your name (as it may appear)"><input id="author_name" name="author_name" defaultValue={client?.billing_contact_name ?? ''} /></Field>
                        <div className="field field--check"><input id="permission_to_publish" name="permission_to_publish" type="checkbox" /><label htmlFor="permission_to_publish">{site.name} may publish this review with my name and company on its website.</label></div>
                        <button className="btn btn--gold" type="submit">Submit review</button>
                    </form>
                )}
                <p className="small muted">{site.phone.display} · {site.email}</p>
            </div>
        </div>
    );
}
