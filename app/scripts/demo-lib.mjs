/* ==========================================================================
   Shared by the demo seed (scripts/seed-demo.mjs) and the responsive capture
   (tests/responsive.test.ts): where demo artefacts live, how the local env
   file is read, the "local stack only" guard, and an RFC 6238 TOTP generator.

   Plain ESM with no dependencies so a script and a vitest suite can both
   import it, and so it can be copied into a baseline checkout unchanged.

   Nothing here may ever be pointed at the hosted project. The seed wipes
   tables and the capture mints sessions with the service role; both refuse
   any Supabase URL that is not a loopback address (see assertLocalUrl).
   ========================================================================== */

import { createHmac } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The portal workspace (app/). */
export const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Demo artefacts: credentials, ids, screenshots. Gitignored. Overridable so a
    baseline checkout can read and write this worktree's copy (DEMO_DIR). */
export const demoDir = () => resolve(process.env.DEMO_DIR || join(APP_DIR, '.demo'));

/** The portal's local env file. Next loads app/.env.local on `next dev`. */
export const envFilePath = () => resolve(process.env.DEMO_ENV_FILE || join(APP_DIR, '.env.local'));

/* ---------- Env files ---------- */

/** Minimal dotenv reader: KEY=value, optional quotes, # comments. */
export function parseEnv(text) {
    const out = {};
    for (const line of String(text).split(/\r?\n/)) {
        const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!m) continue;
        let value = m[2];
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
        out[m[1]] = value;
    }
    return out;
}

export const readEnvFile = (path = envFilePath()) => (existsSync(path) ? parseEnv(readFileSync(path, 'utf8')) : {});

/** Reads a value from the process first, then the local env file. */
export function demoEnv(key, file = readEnvFile()) {
    return process.env[key] || file[key] || '';
}

/* ---------- Local-only guard ---------- */

const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0']);

export function isLocalUrl(url) {
    try {
        return LOOPBACK.has(new URL(url).hostname);
    } catch {
        return false;
    }
}

/** Throws unless the URL points at this machine. The whole harness hangs on it. */
export function assertLocalUrl(url, what = 'SUPABASE_URL') {
    if (!isLocalUrl(url)) {
        throw new Error(`${what} is "${url || '(unset)'}", which is not a localhost URL. The demo harness only ever runs against the local Supabase stack.`);
    }
}

/* ---------- TOTP (RFC 6238 over RFC 4226 HOTP) ----------

   Supabase returns the enrolment secret as unpadded RFC 4648 base32 and
   verifies SHA-1, 6 digits, 30-second steps — the authenticator-app default.
   Implemented on node:crypto rather than a package: it is twenty lines, and
   the portal's supply-chain policy (docs/RUNBOOK.md §8a) prices every
   dependency. Checked against the RFC 6238 Appendix B vectors. */

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Decode(input) {
    const clean = String(input).toUpperCase().replace(/[\s=-]/g, '');
    let bits = 0;
    let value = 0;
    const bytes = [];
    for (const ch of clean) {
        const idx = BASE32.indexOf(ch);
        if (idx < 0) throw new Error(`Invalid base32 character "${ch}" in TOTP secret.`);
        value = (value << 5) | idx;
        bits += 5;
        if (bits >= 8) {
            bytes.push((value >>> (bits - 8)) & 0xff);
            bits -= 8;
        }
    }
    return Buffer.from(bytes);
}

/** HOTP for a raw key (Buffer) and counter. */
export function hotp(key, counter, digits = 6, algorithm = 'sha1') {
    const msg = Buffer.alloc(8);
    msg.writeBigUInt64BE(BigInt(counter));
    const h = createHmac(algorithm, key).update(msg).digest();
    const o = h[h.length - 1] & 0x0f;
    const bin = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
    return String(bin % 10 ** digits).padStart(digits, '0');
}

/** The current code for a base32 secret. */
export function totp(secret, { now = Date.now(), step = 30, digits = 6 } = {}) {
    return hotp(base32Decode(secret), Math.floor(now / 1000 / step), digits);
}

/** Seconds until the current 30-second code rolls over. */
export const secondsLeftInStep = (now = Date.now(), step = 30) => step - (Math.floor(now / 1000) % step);

/** Resolves once a code will stay valid for at least `min` seconds, so a
    submit never races the step boundary. */
export async function waitForFreshStep(min = 5) {
    const left = secondsLeftInStep();
    if (left < min) await new Promise((r) => setTimeout(r, (left + 1) * 1000));
}
