'use server';

import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createCheckoutSession, stripeConfigured, balanceCents } from '@/lib/stripe';
import { str } from './util';
import type { Invoice } from '@/lib/db/types';

/**
 * Starts Stripe Checkout for an invoice identified by its pay token. The
 * amount is the stored balance; nothing from the form is used but the token.
 */
export async function startCheckout(formData: FormData): Promise<void> {
    const token = str(formData, 'token', 80);
    const back = `/pay/${token}`;
    const { data: invoice } = await supabaseAdmin().from('invoices').select('*').eq('pay_token', token).maybeSingle();
    if (!invoice) redirect('/login');
    if (!stripeConfigured()) redirect(`${back}?status=unavailable`);
    if (balanceCents(invoice as Invoice) <= 0) redirect(`${back}?status=settled`);
    let url: string;
    try {
        ({ url } = await createCheckoutSession(invoice as Invoice));
    } catch (err) {
        console.error('[pay] checkout failed:', (err as Error).message);
        redirect(`${back}?status=error`);
    }
    redirect(url);
}
