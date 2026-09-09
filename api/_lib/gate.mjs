// ==============================================================================
// Abuse controls for public intake: honeypot, per-IP rate limit, duplicate
// suppression. The rate limit and duplicate window live in Postgres
// (`public.intake_gate` via the `intake_gate` function) so every function
// instance shares one view. When the database is unreachable the function
// falls back to an in-process window, which is weaker but never blocks a
// legitimate visitor because a dependency is down.
// ==============================================================================

import { createHash } from 'node:crypto';
import { rpc, supabaseConfigured } from './supabase.mjs';

export const LIMITS = {
    perIp: 5,               // submissions
    windowSeconds: 600,     // per 10 minutes
    dedupeSeconds: 900      // identical payload within 15 minutes is a repeat
};

/* The honeypot input is visually hidden and excluded from the tab order; a
   human never fills it, a form-filling bot usually does. */
export const HONEYPOT_FIELD = 'website';
export const isHoneypotTripped = (body) => Boolean(String(body?.[HONEYPOT_FIELD] ?? '').trim());

const salt = () => process.env.INTAKE_HASH_SALT || 'fused-intake';

export const hashIp = (ip) => createHash('sha256').update(`${salt()}|ip|${ip}`).digest('hex');

/** Stable fingerprint of what the visitor asked for, so a double-click or an
    impatient resubmit does not create two leads and two alerts. */
export function fingerprint(record) {
    const parts = [
        record.email, record.phone, record.service_division, record.position_id,
        record.deployment_location, record.schedule, record.notes, record.bio
    ].map((v) => String(v ?? '').trim().toLowerCase());
    return createHash('sha256').update(`${salt()}|fp|${parts.join('|')}`).digest('hex');
}

/* In-process fallback. Fluid Compute reuses instances, so this catches the
   common burst even when Postgres cannot answer. */
const memory = { hits: new Map(), seen: new Map() };

function memoryGate(ipHash, fp, refCode, now = Date.now()) {
    const windowStart = now - LIMITS.windowSeconds * 1000;
    const hits = (memory.hits.get(ipHash) || []).filter((t) => t > windowStart);
    const dupe = memory.seen.get(fp);
    if (dupe && dupe.at > now - LIMITS.dedupeSeconds * 1000) {
        return { allowed: true, duplicateOf: dupe.refCode, source: 'memory' };
    }
    if (hits.length >= LIMITS.perIp) {
        return { allowed: false, retryAfter: Math.ceil((hits[0] + LIMITS.windowSeconds * 1000 - now) / 1000), source: 'memory' };
    }
    hits.push(now);
    memory.hits.set(ipHash, hits);
    memory.seen.set(fp, { at: now, refCode });
    return { allowed: true, duplicateOf: null, source: 'memory' };
}

/**
 * Decides whether a submission may proceed.
 * Returns { allowed, retryAfter?, duplicateOf?, source }.
 */
export async function gate({ ip, record }) {
    const ipHash = hashIp(ip);
    const fp = fingerprint(record);

    if (supabaseConfigured()) {
        const result = await rpc('intake_gate', {
            p_ip_hash: ipHash,
            p_dedupe_hash: fp,
            p_ref_code: record.ref_code,
            p_limit: LIMITS.perIp,
            p_window_seconds: LIMITS.windowSeconds,
            p_dedupe_seconds: LIMITS.dedupeSeconds
        });
        if (result.ok && result.data && typeof result.data === 'object') {
            return {
                allowed: Boolean(result.data.allowed),
                retryAfter: result.data.retry_after ?? undefined,
                duplicateOf: result.data.duplicate_of ?? null,
                source: 'database'
            };
        }
        console.error('[gate] intake_gate RPC failed, using in-process window:', result.status, result.data);
    }
    return memoryGate(ipHash, fp, record.ref_code);
}
