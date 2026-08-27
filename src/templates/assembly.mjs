/* ==========================================================================
   "THE ASSEMBLY" — SCROLL-FORGED EMBLEM INTRO
   The track's height is the length of the assembly; js/logo-forge.js measures
   this element, and css/forge.css collapses it for reduced motion and for the
   no-WebGL fallback. The copy beats ride the module's published --assembly
   clock, so the words cannot drift from the cubes.
   ========================================================================== */

import { html } from '../lib/html.mjs';
import { site } from '../data/site.mjs';

export const assembly = () => html`
    <section class="forge-track" id="assembly-intro" aria-label="${site.name} — brand introduction">
        <div class="forge-stage">
            <div class="forge-beat forge-beat-1">
                <span class="forge-eyebrow">FPS // Assembly Protocol</span>
                <p class="forge-line">Protection is a thousand moving parts.</p>
            </div>
            <div class="forge-beat forge-beat-2">
                <p class="forge-line">We fuse them into <span class="gold-gradient-text">one</span>.</p>
            </div>
            <div class="forge-beat forge-beat-3">
                <p class="forge-motto">${site.motto}</p>
                <span class="forge-continue">CONTINUE <span class="forge-continue-arrow" aria-hidden="true">&darr;</span></span>
            </div>
            <div class="forge-hud-left font-mono" id="forgeReadout" aria-hidden="true">ASSEMBLING 000.0%</div>
            <div class="forge-cue font-mono" id="forgeCue" aria-hidden="true">SCROLL TO ASSEMBLE <span class="forge-cue-arrow">&darr;</span></div>
        </div>
    </section>`;
