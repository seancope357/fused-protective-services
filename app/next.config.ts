import type { NextConfig } from 'next';
import path from 'node:path';

/* The portal reads business facts straight from ../src/data/*.mjs — the same
   files the static site is generated from — so both agree by construction.
   The repo root is declared so Turbopack and output tracing include them. */
const repoRoot = path.join(__dirname, '..');

const nextConfig: NextConfig = {
    reactStrictMode: true,
    turbopack: { root: repoRoot },
    outputFileTracingRoot: repoRoot,
    poweredByHeader: false,
    headers: async () => [
        {
            source: '/(.*)',
            headers: [
                { key: 'X-Content-Type-Options', value: 'nosniff' },
                { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                { key: 'X-Frame-Options', value: 'DENY' },
                { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' }
            ]
        }
    ]
};

export default nextConfig;
