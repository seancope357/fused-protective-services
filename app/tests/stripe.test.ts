import { describe, expect, it } from 'vitest';
import type Stripe from 'stripe';
import { interpretEvent } from '@/lib/stripe';

const event = (type: string, object: Record<string, unknown>) => ({ id: 'evt_1', type, data: { object } }) as unknown as Stripe.Event;

describe('interpretEvent', () => {
    it('card checkout completes as succeeded', () => {
        const pe = interpretEvent(event('checkout.session.completed', { id: 'cs_1', payment_status: 'paid', amount_total: 112580, payment_intent: 'pi_1', payment_method_types: ['card'], metadata: { invoice_id: 'inv-1' }, client_reference_id: 'inv-1' }));
        expect(pe).toMatchObject({ invoiceId: 'inv-1', paymentIntentId: 'pi_1', checkoutSessionId: 'cs_1', amountCents: 112580, method: 'card', status: 'succeeded' });
    });

    it('ACH checkout completes as pending until the intent succeeds', () => {
        const pe = interpretEvent(event('checkout.session.completed', { id: 'cs_2', payment_status: 'unpaid', amount_total: 5000, payment_intent: 'pi_2', payment_method_types: ['us_bank_account'], metadata: { invoice_id: 'inv-2' } }));
        expect(pe?.status).toBe('pending');
        const ok = interpretEvent(event('payment_intent.succeeded', { id: 'pi_2', amount: 5000, amount_received: 5000, latest_charge: 'ch_2', payment_method_types: ['us_bank_account'], metadata: { invoice_id: 'inv-2' } }));
        expect(ok).toMatchObject({ status: 'succeeded', chargeId: 'ch_2', amountCents: 5000, invoiceId: 'inv-2' });
    });

    it('failed intents carry the message; unrelated events are ignored', () => {
        const failed = interpretEvent(event('payment_intent.payment_failed', { id: 'pi_3', amount: 100, payment_method_types: ['card'], metadata: { invoice_id: 'inv-3' }, last_payment_error: { message: 'card declined' } }));
        expect(failed).toMatchObject({ status: 'failed', failureMessage: 'card declined' });
        expect(interpretEvent(event('customer.created', { id: 'cus_1' }))).toBeNull();
    });

    it('never trusts an amount from anywhere but the Stripe object', () => {
        const pe = interpretEvent(event('checkout.session.completed', { id: 'cs', payment_status: 'paid', amount_total: 1, payment_intent: 'pi', payment_method_types: ['card'], metadata: { invoice_id: 'inv', amount: '999999' } }));
        expect(pe?.amountCents).toBe(1);
    });
});
