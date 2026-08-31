/* ==========================================================================
   INVOICE PAGE HEAD
   Deliberately spartan next to the marketing head: this is an internal tool,
   so it carries noindex instead of a schema.org graph, and no social cards.
   The robots meta (rather than a robots.txt Disallow) is intentional — a
   disallowed URL is never crawled, so its noindex would never be read.
   ========================================================================== */

import { html } from '../../lib/html.mjs';
import { site } from '../../data/site.mjs';

export const invoiceHead = () => html`
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>Invoicing — ${site.name}</title>
    <meta name="robots" content="noindex, nofollow">
    <meta name="theme-color" content="#050504">
    <link rel="icon" type="image/png" href="${site.logo}">

    <!-- Google Fonts — same faces as the site so the document matches the brand -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700;800;900&family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700;800&display=swap" rel="stylesheet">

    <link rel="stylesheet" href="css/invoice.css">
`;
