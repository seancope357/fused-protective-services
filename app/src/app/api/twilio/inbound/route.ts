import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const STOP_WORDS = new Set(['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit']);
const START_WORDS = new Set(['start', 'yes', 'unstop']);

/** Twilio signs requests with the auth token over the full URL + sorted params. */
function verifyTwilioSignature(url: string, params: Record<string, string>, signature: string | null): boolean {
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!token || !signature) return false;
    const data = url + Object.keys(params).sort().map((k) => k + params[k]).join('');
    const expected = createHmac('sha1', token).update(data).digest('base64');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Inbound SMS webhook (Messaging Service → this URL). Records STOP so the
 * engine never texts that number again, and START to lift it. Twilio's own
 * Advanced Opt-Out also blocks at the carrier edge; this keeps our records
 * true. Replies are left to Twilio's default opt-out messages.
 */
export async function POST(request: NextRequest) {
    const form = await request.formData();
    const params: Record<string, string> = {};
    for (const [k, v] of form.entries()) params[k] = String(v);

    const publicUrl = `${process.env.APP_URL || `https://${request.headers.get('host')}`}/api/twilio/inbound`;
    if (!verifyTwilioSignature(publicUrl, params, request.headers.get('x-twilio-signature'))) {
        return new NextResponse('forbidden', { status: 403 });
    }

    const from = params.From;
    const body = (params.Body || '').trim().toLowerCase();
    const db = supabaseAdmin();
    if (from && STOP_WORDS.has(body)) {
        await db.from('sms_opt_outs').upsert({ phone: from, source: 'twilio_inbound', last_message: params.Body?.slice(0, 160) }, { onConflict: 'phone' });
        await db.from('clients').update({ sms_opted_out_at: new Date().toISOString() }).eq('billing_phone', from);
    } else if (from && START_WORDS.has(body)) {
        await db.from('sms_opt_outs').delete().eq('phone', from);
        await db.from('clients').update({ sms_opted_out_at: null }).eq('billing_phone', from);
    }
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', { headers: { 'Content-Type': 'text/xml' } });
}
