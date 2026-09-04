// ==============================================================================
// Fused Protective Services — Intake Dispatcher Edge Function
// Target: Deno / Supabase Edge Functions
// Description: Triage, persistence, threat evaluation & outbound dispatch alerting
// ==============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface QuotePayload {
    type?: 'quote';
    refCode: string;
    formName: string;
    formCompany?: string;
    formPhone: string;
    formEmail: string;
    formDivision: string;
    formArmedPreference: string;
    formLocation: string;
    formSchedule: string;
    formNotes?: string;
    timestamp?: string;
}

interface CandidatePayload {
    type?: 'candidate';
    refCode: string;
    appPosition: string;
    appLicenseLevel: string;
    appFullName: string;
    appPhone: string;
    appEmail: string;
    appLicenseNumber?: string;
    appServiceBranch?: string;
    appBio: string;
    timestamp?: string;
}

serve(async (req: Request) => {
    // 1. Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        if (req.method !== 'POST') {
            return new Response(JSON.stringify({ error: 'Method not allowed' }), {
                status: 405,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const raw = await req.json();
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');

        // Determine submission type
        const isCandidate = Boolean(raw.appPosition || raw.positionId || raw.type === 'candidate');

        if (isCandidate) {
            const payload = raw as CandidatePayload;
            const candidateRecord = {
                ref_code: payload.refCode || `TX-CAND-${Math.floor(1000 + Math.random() * 9000)}`,
                position_id: payload.appPosition || 'general-roster',
                license_level: payload.appLicenseLevel || 'unspecified',
                full_name: payload.appFullName,
                phone: payload.appPhone,
                email: payload.appEmail,
                tops_number: payload.appLicenseNumber || null,
                service_branch: payload.appServiceBranch || 'civilian',
                bio: payload.appBio || '',
                vetting_stage: 'application_received'
            };

            // If Supabase credentials are wired, persist via REST API
            if (supabaseUrl && supabaseKey) {
                const insertRes = await fetch(`${supabaseUrl}/rest/v1/candidate_applications`, {
                    method: 'POST',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify(candidateRecord)
                });

                if (!insertRes.ok) {
                    const errText = await insertRes.text();
                    console.error('[Dispatcher] Candidate insert error:', errText);
                }
            }

            return new Response(
                JSON.stringify({
                    ok: true,
                    type: 'candidate',
                    refCode: candidateRecord.ref_code,
                    message: 'Candidate application received and logged for command review.'
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
        } else {
            // Client Quote Request
            const payload = raw as QuotePayload;
            const quoteRecord = {
                ref_code: payload.refCode || `TX-FPS-${Math.floor(1000 + Math.random() * 9000)}`,
                full_name: payload.formName,
                company: payload.formCompany || null,
                phone: payload.formPhone,
                email: payload.formEmail,
                service_division: payload.formDivision,
                armed_preference: payload.formArmedPreference,
                deployment_location: payload.formLocation,
                schedule: payload.formSchedule,
                notes: payload.formNotes || null,
                status: 'new'
            };

            // Detect Emergency Priority
            const isEmergency = 
                payload.formDivision?.includes('Emergency') ||
                payload.formDivision?.includes('Level IV PPO') ||
                payload.formNotes?.toLowerCase().includes('urgent');

            // If Supabase credentials are wired, persist via REST API
            if (supabaseUrl && supabaseKey) {
                const insertRes = await fetch(`${supabaseUrl}/rest/v1/client_quotes`, {
                    method: 'POST',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify(quoteRecord)
                });

                if (!insertRes.ok) {
                    const errText = await insertRes.text();
                    console.error('[Dispatcher] Quote insert error:', errText);
                }
            }

            // Outbound Emergency Alert Hook (e.g. Twilio / Webhook to Cameron)
            const alertWebhook = Deno.env.get('DISPATCH_ALERT_WEBHOOK');
            if (alertWebhook && isEmergency) {
                try {
                    await fetch(alertWebhook, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            text: `🚨 URGENT FUSED DISPATCH (${quoteRecord.ref_code}): ${quoteRecord.service_division} requested by ${quoteRecord.full_name} (${quoteRecord.phone}). Schedule: ${quoteRecord.schedule}`,
                            ...quoteRecord
                        })
                    });
                } catch (e) {
                    console.error('[Dispatcher] Alert webhook failed:', e);
                }
            }

            return new Response(
                JSON.stringify({
                    ok: true,
                    type: 'quote',
                    refCode: quoteRecord.ref_code,
                    priority: isEmergency ? 'emergency' : 'standard',
                    message: `Request received — dispatch reference ${quoteRecord.ref_code}. A commanding officer will contact ${quoteRecord.phone} within ${isEmergency ? '45 minutes' : '2 hours'}.`
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
        }
    } catch (err: unknown) {
        console.error('[Dispatcher] Unhandled error:', err);
        const message = err instanceof Error ? err.message : 'Internal Server Error';
        return new Response(JSON.stringify({ error: message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});
