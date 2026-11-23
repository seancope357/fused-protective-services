/* ==========================================================================
   PROOF BAND — WHERE FUSED HAS WORKED
   The client-logo strip under the hero. Entries come from src/data/proof.mjs;
   a client with an approved logo shows it, every other client shows its name
   as a wordmark. Renders nothing when the list is empty.
   ========================================================================== */

import { html } from '../lib/html.mjs';
import { proof } from '../data/proof.mjs';

const mark = (client) =>
    client.logo
        ? html`<img src="${client.logo.src}" alt="${client.name}" class="proof-logo" width="${client.logo.width}" height="${client.logo.height}" loading="lazy">`
        : html`<span class="proof-wordmark">${client.name}</span>`;

export const proofBand = () =>
    proof.clients.length === 0
        ? ''
        : html`
    <section class="proof-band" id="proof" aria-labelledby="proof-label">
        <div class="container proof-inner">
            <h2 class="proof-label" id="proof-label">${proof.label}</h2>
            <ul class="proof-list">
                ${proof.clients.map(
                    (client) => html`
                <li class="proof-item">
                    ${mark(client)}
                    ${client.place ? html`<span class="proof-place">${client.place}</span>` : ''}
                </li>`
                )}
            </ul>
        </div>
    </section>`;
