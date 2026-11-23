/* ==========================================================================
   PROOF — "TRUSTED AT"
   ==========================================================================
   The venues and organizations Fused has worked for, shown as a band of
   marks under the hero. Every entry is a claim Cameron has made directly;
   never add one on inference.

   Each entry: { name, place?, logo? }
     logo: { src, width, height } — the organization's official mark, served
           from assets/clients/ (the CSP allows no third-party images).
           Only add one with the organization's permission: a logo on a
           security company's site reads as an endorsement. Without a logo,
           the name renders as a monochrome wordmark set in the house type,
           which states the fact without borrowing their brand.

   2026-11-23: Circuit of The Americas added at Cameron's request. Official
   name styling is "Circuit of The Americas" (capital T). Logo file is the
   public-domain SVG from Wikimedia Commons (File:Circuit_of_the_Americas_logo.svg);
   public domain covers copyright only, not COTA's trademark.
   TODO(cameron): COTA's ticket policy bars commercial use of its logo without
   prior written consent. Sean deployed the logo on 2026-11-23 with that consent
   still being requested (docs/OPEN_QUESTIONS.md §11). If COTA objects, set
   `logo: null` and the wordmark shows instead.

   2026-11-23: The Texas Tribune Festival added at Sean's request. Logo is the
   Festival's wordmark (festival.texastribune.org/images/horizontal_logo.png)
   rendered black on the Festival's yellow, #ffc200, matching its own share
   image; the Festival has no separate symbol. If Cameron or the Tribune
   supply an official yellow file, replace assets/clients/tribfest.png. Written OK
   from the Tribune is pending, same as COTA (OPEN_QUESTIONS.md §11).
   ========================================================================== */

export const proof = {
    label: 'Trusted at',
    clients: [
        {
            name: 'Circuit of The Americas',
            place: 'Austin, TX',
            logo: { src: 'assets/clients/cota.svg', width: 359, height: 120 }
        },
        {
            name: 'The Texas Tribune Festival',
            place: 'Austin, TX',
            logo: { src: 'assets/clients/tribfest.png', width: 729, height: 77 }
        }
    ]
};
