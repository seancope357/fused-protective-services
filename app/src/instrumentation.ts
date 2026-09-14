/* ==========================================================================
   Next.js runs register() once per runtime, before anything serves a request.
   It is where the error reporter is started (SPEC-003).

   SERVER AND EDGE ONLY — A DELIBERATE NARROWING OF THE SPEC.

   SPEC-003 §4 says "server + edge + client". This ships the first two and not
   the third, for three reasons worth writing down rather than discovering by
   `git blame`:

     1. All three paths the spec actually names are server-side — the Stripe
        webhook, the cron tick, and the server actions. The browser SDK would
        not cover any of them.
     2. The portal has four client components in total (two login forms, the
        MFA form, a print button). A browser SDK would ship its bundle to
        every page of the portal to watch those four.
     3. It would cost a security-policy edit. The portal's CSP is nonce-based
        with strict-dynamic and a `connect-src` of 'self' plus Supabase
        (src/lib/supabase/proxy.ts). A browser SDK posts to a Sentry ingest
        origin, which that connect-src blocks, so adding it means widening the
        CSP for every portal visitor. Server-side capture posts from the
        server process, which no CSP governs — so as long as the SDK stays out
        of the browser, the policy stays exactly as tight as it is.

   To add the browser half later, three things and no others:
     - `src/instrumentation-client.ts` calling Sentry.init with the same
       errors-only options as app/src/lib/observability.ts;
     - a NEXT_PUBLIC_SENTRY_DSN, because a server-only SENTRY_DSN is not
       inlined into the browser bundle;
     - `https://<org>.ingest.<region>.sentry.io` added to connect-src in
       buildCsp(). That is the security review, and it should have one.
   ========================================================================== */

export async function register(): Promise<void> {
    if (process.env.NEXT_RUNTIME !== 'nodejs' && process.env.NEXT_RUNTIME !== 'edge') return;
    /* Imported lazily so the module — and the SDK it pulls in — is never
       evaluated in a runtime that is not going to use it. */
    const { initSentry } = await import('@/lib/observability');
    initSentry();
}

/**
 * Next calls this for an uncaught error in a server component, a route handler
 * or a server action. It is the backstop for everything the explicit wrappers
 * in src/lib/actions/util.ts and the route handlers do not already catch.
 */
export async function onRequestError(
    err: unknown,
    request: { path?: string; method?: string },
    context: { routerKind?: string; routeType?: string }
): Promise<void> {
    try {
        const { report } = await import('@/lib/observability');
        /* The pathname only. Next hands over the request target, and a
           request target carries a query string. */
        const path = String(request?.path ?? '').split(/[?#]/)[0];
        await report(err, {
            severity: 'error',
            source: `app${path}`,
            context: {
                method: request?.method ?? null,
                routerKind: context?.routerKind ?? null,
                routeType: context?.routeType ?? null
            }
        });
    } catch {
        /* The backstop for the backstop. Next swallows what we throw here
           anyway; making noise about it would not help. */
    }
}
