/* ==========================================================================
   CAREERS DOCUMENT HEAD & JOB POSTING STRUCTURED DATA
   ========================================================================== */

import { html, json } from '../../lib/html.mjs';
import { site } from '../../data/site.mjs';
import { careersSeo, positions } from '../../data/careers.mjs';

const structuredData = () => ({
    '@context': 'https://schema.org',
    '@graph': [
        {
            '@type': 'SecurityService',
            '@id': `${site.url}/#organization`,
            name: site.name,
            url: site.url,
            logo: `${site.url}/${site.logo}`,
            telephone: site.phone.e164,
            email: site.email
        },
        ...positions.map((pos) => ({
            '@type': 'JobPosting',
            '@id': `${site.url}/careers#${pos.id}`,
            title: pos.schema.title,
            description: pos.schema.description,
            datePosted: '2026-08-01',
            validThrough: '2027-12-31',
            employmentType: pos.schema.employmentType,
            hiringOrganization: {
                '@type': 'Organization',
                name: site.name,
                sameAs: site.url,
                logo: `${site.url}/${site.logo}`
            },
            jobLocation: {
                '@type': 'Place',
                address: {
                    '@type': 'PostalAddress',
                    addressLocality: site.address.locality,
                    addressRegion: site.address.region,
                    addressCountry: site.address.country
                }
            },
            baseSalary: {
                '@type': 'MonetaryAmount',
                currency: 'USD',
                value: {
                    '@type': 'QuantitativeValue',
                    minValue: pos.schema.baseSalary.minValue,
                    maxValue: pos.schema.baseSalary.maxValue,
                    unitText: pos.schema.baseSalary.unit
                }
            }
        }))
    ]
});

export const careersHead = () => html`
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, minimum-scale=1.0">

    <title>${careersSeo.title}</title>
    <meta name="description" content="${careersSeo.description}">
    <meta name="keywords" content="${careersSeo.keywords}">
    <meta name="author" content="${site.name}">
    <meta name="theme-color" content="#050504">
    <link rel="canonical" href="${site.url}/careers">
    <link rel="icon" type="image/png" href="${site.logo}">

    <!-- OpenGraph Metadata -->
    <meta property="og:site_name" content="${site.name}">
    <meta property="og:title" content="${careersSeo.title}">
    <meta property="og:description" content="${careersSeo.description}">
    <meta property="og:image" content="${site.url}/${site.logo}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${site.url}/careers">

    <!-- Schema.org JobPosting JSON-LD -->
    <script type="application/ld+json">
${json(structuredData())}
    </script>

    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800;900&family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700;800&display=swap" rel="stylesheet">

    <link rel="stylesheet" href="css/site.css">
`;
