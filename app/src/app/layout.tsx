import type { Metadata } from 'next';
import '../../../src/styles/tokens.css';
import '@/styles/app.css';
import { site } from '@/lib/shared';

export const metadata: Metadata = {
    title: { default: `${site.shortName} Portal`, template: `%s — ${site.shortName} Portal` },
    description: `${site.name} operations platform.`,
    robots: { index: false, follow: false },
    icons: { icon: `${site.url}/${site.logo}` }
};

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
            <body>{children}</body>
        </html>
    );
}
