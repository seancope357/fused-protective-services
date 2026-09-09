import type { NextConfig } from 'next';

/* The portal reads business facts straight from ../src/data/*.mjs — the same
   files the static site is generated from — so both agree by construction.
   scripts/sync-shared.mjs mirrors them into app/shared/ before every build,
   typecheck and test run, so nothing is imported from above the app root. */
const nextConfig: NextConfig = {
    reactStrictMode: true,
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
