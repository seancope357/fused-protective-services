/* ==========================================================================
   LEGAL PAGE SHELL
   One template renders every entry in src/data/legal.mjs. A page whose
   `reviewed` flag is false carries a visible "draft — attorney review" banner
   so drafted legal text is never presented as reviewed.
   ========================================================================== */

import { html } from '../../lib/html.mjs';
import { site } from '../../data/site.mjs';
import { nav, drawer } from '../nav.mjs';
import { dispatchBar, footer } from '../footer.mjs';

const head = (page) => html`
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${page.title} — ${site.name}</title>
    <meta name="description" content="${page.description}">
    <meta name="robots" content="${page.reviewed ? 'index, follow' : 'noindex, follow'}">
    <meta name="theme-color" content="#050504">
    <link rel="canonical" href="${site.url}/${page.slug}">
    <link rel="icon" type="image/png" sizes="32x32" href="${site.icons.favicon}">
    <link rel="apple-touch-icon" sizes="180x180" href="${site.icons.appleTouch}">
    <!-- Typefaces self-hosted; see src/styles/base.css (SPEC-006). -->
    <link rel="stylesheet" href="css/site.css">
`;

export const legalPage = (page) => html`<!DOCTYPE html>
<html lang="en">
<head>
${head(page)}
</head>
<body class="careers-body">

    <a href="#main" class="skip-link">Skip to main content</a>

${drawer(true)}
${nav(true)}

    <main id="main" tabindex="-1" class="legal-main">
        <article class="container legal-doc">
            <header class="legal-head">
                <span class="section-tag">${page.eyebrow}</span>
                <h1 class="section-title">${page.title}</h1>
                <p class="legal-meta">Effective ${page.effective}${page.reviewed ? ` · reviewed ${page.reviewedOn}` : ''}</p>
                ${page.reviewed
                    ? ''
                    : html`<p class="legal-draft" role="note"><strong>Draft.</strong> This text is pending attorney review and is published for transparency about how the platform is intended to operate. It is not legal advice.</p>`}
            </header>
            ${page.sections.map(
                (s) => html`
            <section class="legal-section">
                <h2>${s.heading}</h2>
                ${s.body.map((p) => html`<p>${p}</p>`)}
            </section>`
            )}
        </article>
    </main>

${dispatchBar()}
${footer(true)}

    <script type="module" src="js/app.mjs"></script>
</body>
</html>
`;
