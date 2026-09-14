import type { Metadata } from 'next';
import '../../shared/src/styles/tokens.css';
import '@/styles/app.css';
import { site, logoSrc } from '@/lib/shared';
import { deployEnv, deployEnvLabel, isProduction, supabaseProjectRef } from '@/lib/env';

export const metadata: Metadata = {
    title: { default: `${site.shortName} Portal`, template: `%s — ${site.shortName} Portal` },
    description: `${site.name} operations platform.`,
    robots: { index: false, follow: false },
    icons: { icon: logoSrc }
};

/* Every page outside production says so, above everything else (SPEC-002).
   Someone looking at a preview must never mistake it for the live portal, and
   must be able to see which Supabase project their clicks are writing to. */
function EnvironmentBanner() {
    if (isProduction()) return null;
    const env = deployEnv();
    const project = supabaseProjectRef();
    return (
        <div className="env-banner" role="status" data-env={env}>
            <span className="env-banner__tag">{deployEnvLabel(env)}</span>
            <span>
                This is not the live portal. Data is read from and written to Supabase project{' '}
                <code>{project ?? 'not configured'}</code>.
            </span>
        </div>
    );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link
                    href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;800&family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap"
                    rel="stylesheet"
                />
            </head>
            <body>
                <EnvironmentBanner />
                {children}
            </body>
        </html>
    );
}
