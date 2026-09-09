import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { LOGIN_LIMITS } from './policy';

/* Reuses the intake gate function in Postgres so the window is shared across
   every function instance. Two counters: per address and per email. The
   dedupe hash is unique per attempt so the duplicate branch never triggers. */

const salt = () => process.env.INTAKE_HASH_SALT || 'fused-intake';
const hash = (kind: string, value: string) => createHash('sha256').update(`${salt()}|${kind}|${value.toLowerCase()}`).digest('hex');

const memory = new Map<string, number[]>();

function memoryAllow(key: string, limit: number, now = Date.now()): boolean {
    const start = now - LOGIN_LIMITS.windowSeconds * 1000;
    const hits = (memory.get(key) ?? []).filter((t) => t > start);
    if (hits.length >= limit) return false;
    hits.push(now);
    memory.set(key, hits);
    return true;
}

async function allow(key: string, limit: number): Promise<boolean> {
    try {
        const { data, error } = await supabaseAdmin().rpc('intake_gate', {
            p_ip_hash: key,
            p_dedupe_hash: randomUUID(),
            p_ref_code: 'login',
            p_limit: limit,
            p_window_seconds: LOGIN_LIMITS.windowSeconds,
            p_dedupe_seconds: 1
        });
        if (!error && data && typeof data === 'object') return Boolean((data as { allowed: boolean }).allowed);
    } catch (err) {
        console.error('[login-gate] rpc failed, using in-process window:', err);
    }
    return memoryAllow(key, limit);
}

/** True when this attempt may proceed. Both counters must allow it. */
export async function loginAllowed(ip: string, email: string): Promise<boolean> {
    const [ipOk, emailOk] = await Promise.all([
        allow(hash('login-ip', ip), LOGIN_LIMITS.perIp),
        allow(hash('login-email', email), LOGIN_LIMITS.perEmail)
    ]);
    return ipOk && emailOk;
}
