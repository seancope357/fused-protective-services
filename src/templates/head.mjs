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
import { aggregateRating } from '../data/reviews.mjs';

/* The rating block exists only when src/data/reviews.mjs holds real reviews;
   an empty list yields null and the key is omitted rather than claimed. */
const ratingBlock = () => {
    const rating = aggregateRating();
    return rating
        ? {
            aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: rating.value,
                reviewCount: rating.count,
                bestRating: rating.best
            }
        }
        : {};
};

const structuredData = () => ({
    '@context': 'https://schema.org',
    '@graph': [
        {
            '@type': 'SecurityService',
            '@id': `${site.url}/#organization`,
            name: site.name,
            url: site.url,
            /* Two different pictures because they answer two different
               questions: `logo` is the square mark a search result puts beside
               the company name, `image` is the one a rich result shows. */
            logo: `${site.url}/${site.icons.large}`,
            image: `${site.url}/${site.ogCard.path}`,
            description: site.seo.organizationDescription,
            telephone: site.phone.e164,
            email: site.email,
            identifier: {
                '@type': 'PropertyValue',
                propertyID: site.licenseNumber.label,
                value: site.licenseNumber.value
            },
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
            ...ratingBlock()
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

    <!-- Icons. The favicon used to be the 1 MB brand plate, fetched on every
         page load to be painted at 16px. -->
    <link rel="icon" type="image/png" sizes="32x32" href="${site.icons.favicon}">
    <link rel="apple-touch-icon" sizes="180x180" href="${site.icons.appleTouch}">
    <link rel="icon" type="image/png" sizes="512x512" href="${site.icons.large}">

    <!-- AI Search Engine Optimization (GEO & LLMs) -->
    <meta name="ai-content-declaration" content="verified-business-profile">
    <meta name="chatgpt-description" content="${site.seo.chatgpt}">
    <meta name="perplexity-description" content="${site.seo.perplexity}">

    <!-- OpenGraph Metadata -->
    <meta property="og:site_name" content="${site.name}">
    <meta property="og:title" content="${site.seo.ogTitle}">
    <meta property="og:description" content="${site.seo.ogDescription}">
    <meta property="og:image" content="${site.url}/${site.ogCard.path}">
    <meta property="og:image:width" content="${site.ogCard.width}">
    <meta property="og:image:height" content="${site.ogCard.height}">
    <meta property="og:image:alt" content="${site.ogCard.alt}">
    <meta property="og:image:type" content="image/png">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${site.url}">

    <!-- Twitter Card. summary_large_image wants 1200x630; it used to be handed
         a 1000x1000 square, which every client letterboxed. -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${site.seo.twitterTitle}">
    <meta name="twitter:description" content="${site.seo.twitterDescription}">
    <meta name="twitter:image" content="${site.url}/${site.ogCard.path}">
    <meta name="twitter:image:alt" content="${site.ogCard.alt}">

    <!-- Schema.org JSON-LD (generated from src/data — never hand-edited) -->
    <script type="application/ld+json">
${json(structuredData())}
    </script>

    <!-- Typefaces are self-hosted (SPEC-006): the @font-face rules are in
         css/site.css and the woff2 files in assets/fonts/. The two preconnects
         and the fonts.googleapis.com stylesheet that used to sit here are gone
         along with the origin they warmed up. -->
    <link rel="stylesheet" href="css/site.css">

    <!-- Scripting off: the assembly never runs, so collapse its runway and
         hide the readouts that would describe it. A stylesheet rather than an
         inline style block, because style-src is 'self' with no hashes — see
         src/styles/noscript.css for why that is the better trade. -->
    <noscript><link rel="stylesheet" href="css/noscript.css"></noscript>
`;
