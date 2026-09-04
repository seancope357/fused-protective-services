// ==============================================================================
// Fused Protective Services — Vercel Serverless Intake Handler (/api/intake)
// Target: Node.js 18+ / Vercel Edge / Serverless
// Description: Zero-dependency intake router for Quotes and Candidate Applications
// ==============================================================================

export default async function handler(req, res) {
    // 1. CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const isCandidate = Boolean(body.appPosition || body.positionId || body.type === 'candidate');
        const refCode = body.refCode || (isCandidate 
            ? `TX-CAND-${Math.floor(1000 + Math.random() * 9000)}` 
            : `TX-FPS-${Math.floor(1000 + Math.random() * 9000)}`);

        // 2. Optional Supabase Persistence (reads from Vercel Environment Variables)
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

        if (supabaseUrl && supabaseKey) {
            const table = isCandidate ? 'candidate_applications' : 'client_quotes';
            const record = isCandidate ? {
                ref_code: refCode,
                position_id: body.appPosition || 'general-roster',
                license_level: body.appLicenseLevel || 'unspecified',
                full_name: body.appFullName || 'Anonymous Candidate',
                phone: body.appPhone || '',
                email: body.appEmail || '',
                tops_number: body.appLicenseNumber || null,
                service_branch: body.appServiceBranch || 'civilian',
                bio: body.appBio || '',
                vetting_stage: 'application_received'
            } : {
                ref_code: refCode,
                full_name: body.formName || 'Anonymous Client',
                company: body.formCompany || null,
                phone: body.formPhone || '',
                email: body.formEmail || '',
                service_division: body.formDivision || 'Commercial & Property Patrol',
                armed_preference: body.formArmedPreference || 'Armed (Level III / IV)',
                deployment_location: body.formLocation || 'Austin, TX',
                schedule: body.formSchedule || 'TBD',
                notes: body.formNotes || null,
                status: 'new'
            };

            try {
                await fetch(`${supabaseUrl}/rest/v1/${table}`, {
                    method: 'POST',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify(record)
                });
            } catch (dbErr) {
                console.error('[API Intake] Supabase insertion error:', dbErr);
            }
        }

        // 3. Outbound Webhook (HubSpot / Twilio / Slack)
        const outboundWebhook = process.env.DISPATCH_ALERT_WEBHOOK || process.env.HUBSPOT_WEBHOOK_URL;
        if (outboundWebhook) {
            try {
                await fetch(outboundWebhook, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        event: isCandidate ? 'candidate_application' : 'client_quote_request',
                        refCode,
                        timestamp: new Date().toISOString(),
                        ...body
                    })
                });
            } catch (webhookErr) {
                console.error('[API Intake] Outbound webhook error:', webhookErr);
            }
        }

        const isEmergency = !isCandidate && (
            body.formDivision?.includes('Emergency') || 
            body.formDivision?.includes('Level IV PPO') || 
            body.formNotes?.toLowerCase().includes('urgent')
        );

        return res.status(200).json({
            ok: true,
            type: isCandidate ? 'candidate' : 'quote',
            refCode,
            priority: isEmergency ? 'emergency' : 'standard',
            message: isCandidate
                ? 'Candidate application received and logged for command review.'
                : `Request received — dispatch reference ${refCode}. A commanding officer will contact ${body.formPhone || 'you'} within ${isEmergency ? '45 minutes' : '2 hours'}.`
        });

    } catch (err) {
        console.error('[API Intake] Handler error:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
