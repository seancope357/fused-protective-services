'use server';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { done, str, bool } from './util';

/** Public submission through the emailed token, or from the signed-in client portal. */
export async function submitReview(formData: FormData): Promise<void> {
    const token = str(formData, 'token', 80);
    const rating = Number.parseInt(str(formData, 'rating'), 10);
    const body = str(formData, 'body', 4000);
    const author = str(formData, 'author_name', 200);
    const back = `/review/${token}`;
    if (!token) done('/login', 'Missing review token.', 'bad');
    if (!(rating >= 1 && rating <= 5)) done(back, 'Choose a star rating.', 'bad');
    const admin = supabaseAdmin();
    const { data: review } = await admin.from('reviews').select('id, status').eq('token', token).maybeSingle();
    if (!review) done('/login', 'That review link is not valid.', 'bad');
    if (review.status === 'submitted') done(back, 'This review was already submitted. Thank you.', 'warn');
    const { error } = await admin.from('reviews').update({
        status: 'submitted',
        rating,
        body: body || null,
        author_name: author || null,
        permission_to_publish: bool(formData, 'permission_to_publish'),
        submitted_at: new Date().toISOString()
    }).eq('id', review.id);
    if (error) done(back, 'We could not save your review. Please try again.', 'bad');
    done(back, 'Thank you — your review has been recorded.');
}

/** Owner marks a permitted review as published (feeds src/data/reviews.mjs by export). */
export async function publishReview(formData: FormData): Promise<void> {
    const { requireStaff } = await import('@/lib/auth');
    await requireStaff();
    const id = str(formData, 'id');
    const publish = str(formData, 'publish') === '1';
    const { data: review } = await supabaseAdmin().from('reviews').select('permission_to_publish, job_id').eq('id', id).maybeSingle();
    if (!review) done('/portal/reviews', 'Review not found.', 'bad');
    if (publish && !review.permission_to_publish) done('/portal/reviews', 'The client did not give permission to publish.', 'bad');
    await supabaseAdmin().from('reviews').update({ published_at: publish ? new Date().toISOString() : null }).eq('id', id);
    done('/portal/reviews', publish ? 'Marked published. Export reviews to src/data/reviews.mjs to surface it on the site.' : 'Unpublished.');
}
