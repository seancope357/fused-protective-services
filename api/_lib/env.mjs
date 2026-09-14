// ==============================================================================
// Which deployment is this? The single source of truth for the static side.
// Nothing else in api/ reads process.env.VERCEL_ENV.
//
// Vercel sets VERCEL_ENV to exactly one of `production`, `preview` or
// `development`, on every environment, for every deployment. It is absent when
// the function runs anywhere else — `node --test`, serve.py, a laptop — and
// absent is `development`, never production.
//
// The asymmetry is deliberate. Treating an unknown environment as production
// would let a preview page the owner; so `production` is returned only when
// VERCEL_ENV actually says so, and every other value falls to `development`.
// ==============================================================================

/** The reason code every deliberately-suppressed side effect reports. */
export const NON_PRODUCTION_REASON = 'non_production_env';

/**
 * @returns {'production' | 'preview' | 'development'}
 */
export function deployEnv() {
    const raw = String(process.env.VERCEL_ENV ?? '').trim().toLowerCase();
    if (raw === 'production') return 'production';
    if (raw === 'preview') return 'preview';
    return 'development';
}

/** True only on the production deployment of the production project. */
export const isProduction = () => deployEnv() === 'production';

/**
 * The stage outcome for a side effect that was deliberately not attempted
 * because this is not production. Same `{ configured, ok, skipped }` shape the
 * transports already return, so the caller reports it and never fakes a send.
 * @returns {{ configured: false, ok: false, skipped: 'non_production_env' }}
 */
export const suppressedOutsideProduction = () => ({
    configured: false,
    ok: false,
    skipped: NON_PRODUCTION_REASON
});
