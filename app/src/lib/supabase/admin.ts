import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/* Service-role client. Bypasses RLS, so it is used only where the code has
   already established authority: webhooks, the scheduler, auth link minting,
   and writes on behalf of a caller whose role the server verified. Never
   handed to a component, never reaches the browser. */
let cached: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
    if (cached) return cached;
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required on the server.');
    cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    return cached;
}
