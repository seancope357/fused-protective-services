/* ==========================================================================
   DOCUMENT HEAD — META + STRUCTURED DATA
   The schema.org graph is built from the same objects that render the visible
   page, so the OfferCatalog can no longer describe four services while the
   site sells six, and the FAQPage can no longer answer three questions while
   the accordion answers four.
   ========================================================================== */

import { html, json } from '../lib/html.mjs';
import { site } from '../data/site.mjs';
import { divisions } from '../data/divisions.mjs';
import { faqs } from '../data/faq.mjs';

/* Both of these are spread into the organization record below, and each is
   `false` until its data is real, so a missing value leaves no key behind:
   JSON.stringify never sees an `undefined` and the JSON-LD stays valid.

   A rating is only claimed when reviews exist. `site.rating` is null today
   (see site.mjs for the review-snippet policy reasoning), and the count check
   means an empty review table can never publish a rating of nothing. */
const aggregateRating = () =>
    Boolean(site.rating) &&
    Number(site.rating.count) > 0 && {
        aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: site.rating.value,
            reviewCount: site.rating.count,
            bestRating: site.rating.best
        }
    };

/* Occupations Code 1702 wants the DPS license number in advertising; when
   Cameron supplies it in site.mjs it appears here as well as in the footer. */
const licenseIdentifier = () =>
    site.licenseNumber !== null && {
        identifier: {
            '@type': 'PropertyValue',
            propertyID: 'Texas DPS Private Security Bureau License',
            value: site.licenseNumber
        }
    };

const structuredData = () => ({
    '@context': 'https://schema.org',
    '@graph': [
        {
            '@type': 'SecurityService',
            '@id': `${site.url}/#organization`,
            name: site.name,
            url: site.url,
            logo: `${site.url}/${site.logo}`,
            image: `${site.url}/${site.logo}`,
            description: site.seo.organizationDescription,
            telephone: site.phone.e164,
            email: site.email,
            ...licenseIdentifier(),
            priceRange: '$$$',
            address: {
                '@type': 'PostalAddress',
                addressLocality: site.address.locality,
                addressRegion: site.address.region,
                addressCountry: site.address.country
            },
            geo: {
                '@type': 'GeoCoordinates',
                latitude: site.address.latitude,
                longitude: site.address.longitude
            },
            areaServed: site.areaServed.map((a) => ({ '@type': a.type, name: a.name })),
            hasOfferCatalog: {
                '@type': 'OfferCatalog',
                name: 'Protective Services Catalog',
                itemListElement: divisions.map((d) => ({
                    '@type': 'Offer',
                    itemOffered: {
                        '@type': 'Service',
                        name: d.schema.name,
                        description: d.schema.description
                    }
                }))
            },
            ...aggregateRating()
        },
        {
            '@type': 'FAQPage',
            '@id': `${site.url}/#faq`,
            mainEntity: faqs.map((f) => ({
                '@type': 'Question',
                name: f.question,
                acceptedAnswer: { '@type': 'Answer', text: f.answer }
            }))
        }
    ]
});

export const head = () => html`
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, minimum-scale=1.0">

    <!-- Primary SEO Metadata -->
    <title>${site.seo.title}</title>
    <meta name="description" content="${site.seo.description}">
    <meta name="keywords" content="${site.seo.keywords}">
    <meta name="author" content="${site.name}">
    <meta name="theme-color" content="#050504">
    <link rel="canonical" href="${site.url}">
    <link rel="icon" type="image/png" href="${site.logo}">

    <!-- AI Search Engine Optimization (GEO & LLMs) -->
    <meta name="ai-content-declaration" content="verified-business-profile">
    <meta name="chatgpt-description" content="${site.seo.chatgpt}">
    <meta name="perplexity-description" content="${site.seo.perplexity}">

    <!-- OpenGraph Metadata -->
    <meta property="og:site_name" content="${site.name}">
    <meta property="og:title" content="${site.seo.ogTitle}">
    <meta property="og:description" content="${site.seo.ogDescription}">
    <meta property="og:image" content="${site.url}/${site.logo}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${site.url}">

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${site.seo.twitterTitle}">
    <meta name="twitter:description" content="${site.seo.twitterDescription}">
    <meta name="twitter:image" content="${site.url}/${site.logo}">

    <!-- Schema.org JSON-LD (generated from src/data — never hand-edited) -->
    <script type="application/ld+json">
${json(structuredData())}
    </script>

    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800;900&family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700;800&display=swap" rel="stylesheet">

    <link rel="stylesheet" href="css/site.css">
    <noscript><style>.forge-track { height: 120vh; } .forge-hud-left, .forge-cue { display: none; }</style></noscript>
`;
