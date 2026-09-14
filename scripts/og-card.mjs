#!/usr/bin/env node
/* ==========================================================================
   OPENGRAPH CARD — COMPOSITION SOURCE
   ==========================================================================
   Writes the HTML that scripts/build-assets.sh screenshots into
   assets/og-card.png at 1200x630. It is not part of `node build.mjs`, and
   nothing at runtime imports it.

   Why HTML and a browser rather than an image CLI: the card is typeset —
   Cinzel and Outfit, a metallic gradient on the wordmark, real letter-spacing
   — and no resize tool does typography. The palette below is the one in
   context/ui-standards.md, not a second opinion about it.

   Why generated rather than hand-written markup: every word on the card is a
   business fact, and facts live in src/data (specs/README.md, invariant 5).
   The wordmark, the motto, the positioning line and the city list are all
   read from site.mjs here, so the card cannot drift from the page.

   Zero dependencies on purpose — it imports site.mjs and prints HTML. The
   browser is the shell script's problem.

       node scripts/og-card.mjs > card.html
   ========================================================================== */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { site } from '../src/data/site.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* Inlined rather than referenced: a file:// page loading a file:// image is
   at the mercy of the browser's local-file policy, and this has to work the
   same way on every machine that regenerates the card. */
const emblem = readFileSync(join(ROOT, 'assets', 'icon-512.png')).toString('base64');

/* The positioning line. site.seo.twitterDescription is the shortest piece of
   approved positioning copy in the repository and already reads as one line;
   a card is not the place to invent a new claim about what the company does. */
const positioning = site.seo.twitterDescription;
const cities = site.areaServed.filter((a) => a.type === 'City').map((a) => a.name.toUpperCase()).join('  ·  ');

/* Deliberately absent: the DPS licence number. It is still a placeholder
   (src/data/site.mjs), SPEC-001 makes shipping it fatal, and an image cannot
   carry the red placeholder flag the page uses to stay honest about it. */

process.stdout.write(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
<style>
  /* Palette: context/ui-standards.md */
  :root {
    --gold-shadow: #72542b;
    --gold-warm: #87693b;
    --gold-core: #a1814c;
    --gold-bevel: #ba9857;
    --gold-glint: #c6a25c;
    --gold-highlight: #dfc07b;
    --gold-specular: #f7e5b2;
    --void: #050504;
    --surface: #090a09;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; }
  body {
    background: var(--void);
    font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
    overflow: hidden;
    position: relative;
  }

  /* Deep obsidian ground with a single warm source behind the emblem —
     the plate's own lighting, not a second one. */
  .ground {
    position: absolute; inset: 0;
    background:
      radial-gradient(760px 620px at 24% 46%, rgba(186, 152, 87, 0.20) 0%, rgba(134, 105, 59, 0.07) 42%, transparent 72%),
      radial-gradient(1100px 700px at 84% 8%, rgba(255, 255, 255, 0.035) 0%, transparent 60%),
      linear-gradient(145deg, #0b0c0b 0%, var(--void) 48%, #030303 100%);
  }

  /* A hairline plate edge, the same restraint as --border-gold-subtle. */
  .frame {
    position: absolute; inset: 22px;
    border: 1px solid rgba(186, 152, 87, 0.30);
  }
  .frame::after {
    content: ''; position: absolute; inset: 6px;
    border: 1px solid rgba(186, 152, 87, 0.10);
  }

  .stage {
    position: relative;
    height: 100%;
    display: grid;
    grid-template-columns: 430px 1fr;
    align-items: center;
    padding: 0 68px 0 58px;
    gap: 22px;
  }

  .emblem-cell { display: flex; align-items: center; justify-content: center; }
  .emblem {
    width: 326px; height: 326px;
    border-radius: 26px;
    border: 2px solid rgba(186, 152, 87, 0.55);
    box-shadow:
      0 30px 60px rgba(0, 0, 0, 0.95),
      0 0 70px rgba(186, 152, 87, 0.30);
    display: block;
  }

  .copy { padding-bottom: 6px; }

  /* Tactical callout format: uppercase, 0.12-0.18em tracking, gold. */
  .eyebrow {
    font-size: 19px;
    font-weight: 600;
    letter-spacing: 0.30em;
    color: var(--gold-glint);
    margin-bottom: 26px;
    white-space: nowrap;
  }

  .wordmark {
    font-family: 'Cinzel', Georgia, serif;
    font-weight: 900;
    font-size: 118px;
    line-height: 0.92;
    letter-spacing: 0.035em;
    /* --gradient-gold-metallic, on the type itself */
    background: linear-gradient(180deg, #ffffff 0%, var(--gold-specular) 20%, var(--gold-glint) 45%, var(--gold-bevel) 70%, var(--gold-shadow) 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    -webkit-text-fill-color: transparent;
  }

  .subword {
    font-size: 27px;
    font-weight: 600;
    letter-spacing: 0.345em;
    color: var(--gold-bevel);
    margin-top: 14px;
    white-space: nowrap;
  }

  .rule {
    height: 1px;
    margin: 30px 0 26px;
    background: linear-gradient(90deg, var(--gold-bevel) 0%, rgba(186, 152, 87, 0.35) 46%, transparent 100%);
  }

  .positioning {
    font-size: 25px;
    font-weight: 300;
    line-height: 1.46;
    color: rgba(236, 234, 230, 0.90);
    max-width: 620px;
    text-wrap: balance;
  }

  /* Telemetry strip: where, in the structured uppercase the site uses. */
  .cities {
    position: absolute;
    left: 58px; right: 68px; bottom: 52px;
    font-size: 15px;
    font-weight: 500;
    letter-spacing: 0.22em;
    color: rgba(161, 129, 76, 0.95);
    display: flex;
    align-items: center;
    gap: 20px;
  }
  .cities::after {
    content: '';
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, rgba(186, 152, 87, 0.30), transparent);
  }
</style>
</head>
<body>
  <div class="ground"></div>
  <div class="frame"></div>
  <div class="stage">
    <div class="emblem-cell">
      <img class="emblem" src="data:image/png;base64,${emblem}" alt="">
    </div>
    <div class="copy">
      <div class="eyebrow">${site.motto}</div>
      <div class="wordmark">${site.shortName}</div>
      <div class="subword">${site.subtitle.toUpperCase()}</div>
      <div class="rule"></div>
      <div class="positioning">${positioning}</div>
    </div>
  </div>
  <div class="cities">${cities}</div>

<script>
  /* The screenshot waits on html[data-fonts="ready"], and this sets it only
     when BOTH brand faces are really in document.fonts. A card typeset in
     Georgia and Helvetica because a font request quietly 404'd looks almost
     right, which is exactly how it would ship — so the generator hangs and
     then fails instead of producing one. */
  document.fonts.ready.then(function () {
    var families = new Set();
    document.fonts.forEach(function (f) { families.add(f.family); });
    if (families.has('Cinzel') && families.has('Outfit')) {
      document.documentElement.setAttribute('data-fonts', 'ready');
    }
  });
</script>
</body>
</html>
`);
