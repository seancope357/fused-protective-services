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
