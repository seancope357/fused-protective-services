/* Minimal req/res doubles for exercising Vercel functions under node --test. */

export function makeReq({ method = 'POST', body = {}, headers = {} } = {}) {
    return {
        method,
        body,
        headers: { origin: 'https://fusedprotectiveservices.com', 'x-forwarded-for': '203.0.113.7', ...headers },
        socket: { remoteAddress: '203.0.113.7' }
    };
}

export function makeRes() {
    const res = {
        statusCode: 200,
        headers: {},
        body: undefined,
        ended: false,
        setHeader(k, v) { this.headers[k.toLowerCase()] = v; return this; },
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; this.ended = true; return this; },
        end() { this.ended = true; return this; }
    };
    return res;
}

/** Replaces global fetch for the duration of a test; records every call. */
export function stubFetch(router) {
    const calls = [];
    const original = globalThis.fetch;
    globalThis.fetch = async (url, init = {}) => {
        calls.push({ url: String(url), init });
        const handler = router(String(url), init);
        if (!handler) throw new Error(`unexpected fetch ${url}`);
        const { status = 200, json = {} , text } = handler;
        return {
            ok: status >= 200 && status < 300,
            status,
            json: async () => json,
            text: async () => (text ?? JSON.stringify(json))
        };
    };
    return { calls, restore: () => { globalThis.fetch = original; } };
}

export function withEnv(vars, fn) {
    const saved = {};
    for (const [k, v] of Object.entries(vars)) {
        saved[k] = process.env[k];
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
    }
    const restore = () => {
        for (const [k, v] of Object.entries(saved)) {
            if (v === undefined) delete process.env[k];
            else process.env[k] = v;
        }
    };
    return { restore };
}
