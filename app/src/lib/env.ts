/* ==========================================================================
   WHICH DEPLOYMENT IS THIS?
   The portal's single source of truth. Nothing else in app/src reads
   process.env.VERCEL_ENV; the mirror of this module for the static side is
   api/_lib/env.mjs, and the two agree by construction.

   Vercel sets VERCEL_ENV to exactly one of `production`, `preview` or
   `development` on every deployment. It is absent under `next dev`, vitest and
   anywhere else — and absent is `development`, never production. Treating an
   unknown environment as production would let a preview page the owner, so
   `production` is returned only when VERCEL_ENV actually says so.

   Server-side only in practice: VERCEL_ENV is not a NEXT_PUBLIC_ variable, so
   a client component would always read `development`. Every caller here is a
   Server Component or a route handler.
   ========================================================================== */

export type DeployEnv = 'production' | 'preview' | 'development';

/** The reason code every deliberately-suppressed side effect reports. */
export const NON_PRODUCTION_REASON = 'non_production_env';

export function deployEnv(): DeployEnv {
    const raw = String(process.env.VERCEL_ENV ?? '').trim().toLowerCase();
    if (raw === 'production') return 'production';
    if (raw === 'preview') return 'preview';
    return 'development';
}

/** True only on the production deployment of the production project. */
export const isProduction = (): boolean => deployEnv() === 'production';

/** How the banner names this deployment to a human. */
export const deployEnvLabel = (env: DeployEnv = deployEnv()): string =>
    env === 'preview' ? 'Preview deploy' : env === 'development' ? 'Local development' : 'Production';

/**
 * The Supabase project this deployment is pointed at, as its project ref —
 * the first label of the API hostname, which is what the dashboard shows.
 * Returns null when the URL is unset or not a recognisable Supabase host, so
 * the banner can say "unconfigured" rather than invent a project.
 */
export function supabaseProjectRef(): string | null {
    const raw = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    if (!raw) return null;
    try {
        const host = new URL(raw).hostname;
        /* A local stack is addressed by loopback, whose first label ("127") is not a project. */
        if (host === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return 'local';
        const [ref] = host.split('.');
        return ref || null;
    } catch {
        return null;
    }
}
