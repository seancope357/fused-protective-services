/* ==========================================================================
   ENVIRONMENT FLAG
   Marks the document as non-production when it is served from any host that
   is not one of the production hosts the build declared. The only consumer is
   src/styles/components/placeholder.css, which reveals the PLACEHOLDER flags
   beside facts Cameron has not supplied yet. The generated HTML is identical
   in every environment, so `node build.mjs --check` stays deterministic; the
   distinction is made at runtime from the hostname alone.
   ========================================================================== */

import { config } from './config.mjs';

export function initEnvFlag() {
    const hosts = config?.site?.productionHosts;
    if (!Array.isArray(hosts)) return;
    const host = window.location.hostname.toLowerCase();
    if (!hosts.includes(host)) {
        document.documentElement.dataset.env = 'preview';
    }
}
