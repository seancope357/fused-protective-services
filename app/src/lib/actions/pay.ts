'use server';

import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createCheckoutSession, stripeConfigured, balanceCents } from '@/lib/stripe';
import { report } from '@/lib/observability';
import { appUrl } from '@/lib/shared';
import { reporting, safeReturnTo, str } from './util';
import type { Invoice } from '@/lib/db/types';

/**
 * Starts Stripe Checkout for an invoice identified by its pay token. The
 * amount is the stored balance; only the token decides what is charged.
 * `return_to` decides only where the payer lands afterwards — their
 * client-portal invoice when it is a safe /client/ path (see safeReturnTo),
 * otherwise the public pay page.
 *
 * Wrapped in `reporting` (SPEC-003 §4): a client trying to pay us is the last
 * place an exception should vanish into an error boundary.
 */
export const startCheckout = reporting('startCheckout', async (formData: FormData): Promise<void> => {
    const token = str(formData, 'token', 80);
    const back = safeReturnTo(str(formData, 'return_to', 500), appUrl()) ?? `/pay/${token}`;
    const { data: invoice } = await supabaseAdmin().from('invoices').select('*').eq('pay_token', token).maybeSingle();
    if (!invoice) redirect('/login');
    if (!stripeConfigured()) redirect(`${back}?status=unavailable`);
    if (balanceCents(invoice as Invoice) <= 0) redirect(`${back}?status=settled`);
    let url: string;
    try {
        ({ url } = await createCheckoutSession(invoice as Invoice, { returnTo: `${appUrl()}${back}` }));
    } catch (err) {
        /* Caught, so it never reaches the wrapper above or the framework's own
           error hook — the client is shown `?status=error` and, until this
           line existed, nobody else was told at all. The invoice id travels;
           the pay token does not, because it is a bearer credential for this
           invoice and an ops inbox is not where one belongs. */
        console.error('[pay] checkout failed:', (err as Error).message);
        await report(err, {
            severity: 'error',
            source: 'action/startCheckout',
            context: { stage: 'checkout_session', invoiceId: (invoice as Invoice).id }
        });
        redirect(`${back}?status=error`);
    }
    redirect(url);
});
