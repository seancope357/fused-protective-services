// ==============================================================================
// Supabase REST access with the service-role key. Server-only by construction:
// this module is imported by Vercel functions and never shipped to a browser.
// Every call reports `configured` so a missing key is a visible state, not a
// silent no-op.
// ==============================================================================

const config = () => ({
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY
});

export const supabaseConfigured = () => Boolean(config().url && config().key);

async function call(path, { method = 'GET', body, prefer } = {}) {
    const { url, key } = config();
    const headers = {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
    };
    if (prefer) headers.Prefer = prefer;
    const res = await fetch(`${url}/rest/v1/${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    const raw = await res.text();
    let data = null;
    try {
        data = raw ? JSON.parse(raw) : null;
    } catch {
        data = raw;
    }
    return { ok: res.ok, status: res.status, data };
}

/** Inserts one row and returns it. */
export async function insertRow(table, record) {
    const result = await call(table, { method: 'POST', body: record, prefer: 'return=representation' });
    const row = Array.isArray(result.data) ? result.data[0] : result.data;
    return { ...result, row: result.ok ? row : null };
}

/** Selects rows with a PostgREST filter string, e.g. `id=eq.<uuid>&select=*`. */
export async function selectRows(table, query) {
    const result = await call(`${table}?${query}`);
    return { ...result, rows: result.ok && Array.isArray(result.data) ? result.data : [] };
}

/** Calls a Postgres function exposed through PostgREST. */
export async function rpc(name, args) {
    return call(`rpc/${name}`, { method: 'POST', body: args });
}

/**
 * A bounded liveness probe for the health endpoint (SPEC-004).
 *
 * It lives here, not in the health handler, because this module is the only
 * place that may read the URL and the service-role key — a probe that fetched
 * them itself would put credentials in a file whose whole job is to be safe to
 * expose publicly.
 *
 * HEAD with `limit=0` returns no rows and no body: it proves the URL resolves,
 * TLS completes, the key authenticates and PostgREST is serving, without
 * reading a single row of anyone's data. An empty table is still a healthy one,
 * so this must never assert on content.
 *
 * `AbortSignal.timeout` is the point of the function. Without it a hung
 * Supabase leaves the health check hanging, the monitor times out instead of
 * getting a 503, and the alert says "no response" rather than "the database is
 * unreachable" — the same symptom for two very different incidents.
 *
 * @returns {Promise<'ok' | 'unreachable' | 'not_configured'>}
 */
export async function reachable({ timeoutMs = 2500 } = {}) {
    if (!supabaseConfigured()) return 'not_configured';
    const { url, key } = config();
    try {
        const res = await fetch(`${url}/rest/v1/settings?select=key&limit=0`, {
            method: 'HEAD',
            headers: { apikey: key, Authorization: `Bearer ${key}` },
            signal: AbortSignal.timeout(timeoutMs)
        });
        return res.ok ? 'ok' : 'unreachable';
    } catch {
        /* Timeout, DNS failure, TLS failure, connection refused — all the same
           answer to the only question being asked. The reason belongs in the
           logs, never in a public response body. */
        return 'unreachable';
    }
}
