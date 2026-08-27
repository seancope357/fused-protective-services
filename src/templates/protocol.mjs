/* ==========================================================================
   THE FUSED DEPLOYMENT PROTOCOL — FOUR-PHASE HUB
   Rendered as a proper ARIA tablist. Phase numbers come from array position,
   so reordering the data reorders the protocol and renumbers it in one edit.
   ========================================================================== */

import { html } from '../lib/html.mjs';
import { protocolStages } from '../data/protocol.mjs';
import { sectionHead } from './partials.mjs';

const phaseLabel = (index) => `PHASE ${String(index + 1).padStart(2, '0')}`;

const terminalLine = (line) =>
    typeof line === 'string'
        ? html`<div class="terminal-data-line">${line}</div>`
        : html`<div class="terminal-data-line">${line.text}<strong>${line.strong}</strong></div>`;

const panel = (stage, index) => html`
                <div class="protocol-stage-content${index === 0 ? ' active' : ''}" id="stagePanel${index}"
                     role="tabpanel" aria-labelledby="stageTab${index}"${index === 0 ? '' : ' hidden'}>
                    <div>
                        <span class="stage-badge-large">${stage.badge}</span>
                        <h3 class="stage-hero-heading">${stage.heading}</h3>
                        <p class="stage-paragraph">${stage.body}</p>
                        <div class="stage-meta-strip">
                            ${stage.meta.map((m) => html`<div>${m.label}: <strong>${m.value}</strong></div>`)}
                        </div>
                        <a href="#quote" class="btn-gold">
                            ${stage.cta} <span aria-hidden="true">&rarr;</span>
                        </a>
                    </div>

                    <div class="tactical-terminal-card">
                        <div class="terminal-header">
                            <div class="terminal-dot-cluster" aria-hidden="true">
                                <span class="t-dot t-red"></span>
                                <span class="t-dot t-yellow"></span>
                                <span class="t-dot t-green"></span>
                            </div>
                            <span>${stage.terminal.file}</span>
                        </div>
                        ${stage.terminal.lines.map(terminalLine)}
                        <div class="terminal-data-line terminal-data-line--ok">${stage.terminal.status}</div>
                    </div>
                </div>`;

export const protocol = () => html`
    <section class="section-padding section-padding--sunken" id="lifecycle">
        <div class="container">
${sectionHead({
    tag: 'Standard Operating Procedure',
    title: 'The Fused Deployment Protocol',
    desc: 'Inspect each operational phase, from initial threat recon to live shift telemetry.'
})}

            <div class="protocol-hub">
                <div class="protocol-stepper-nav" role="tablist" aria-label="Deployment protocol phases">
                    ${protocolStages.map(
                        (stage, index) => html`
                    <button type="button" class="protocol-stepper-btn${index === 0 ? ' active' : ''}" id="stageTab${index}"
                            role="tab" aria-selected="${index === 0 ? 'true' : 'false'}" aria-controls="stagePanel${index}"
                            tabindex="${index === 0 ? '0' : '-1'}" data-stage="${index}">
                        <span class="step-num">${phaseLabel(index)}</span>
                        <span class="step-name">${stage.name}</span>
                    </button>`
                    )}
                </div>

${protocolStages.map(panel)}
            </div>
        </div>
    </section>`;
