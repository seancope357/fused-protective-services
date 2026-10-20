/* ==========================================================================
   SECURITY DETAIL INTAKE
   Confirmation is rendered into the page rather than thrown as an alert():
   a modal alert is unstyled, blocks the tab, and drops the reference code
   the moment it is dismissed. The message here stays on screen and is
   announced, because #formStatus is a live region.

   Integrated with live /api/intake backend with local offline resilience.
   ========================================================================== */

import { config } from './config.mjs';
import { aerialIntent, prepareAerialInquiry, withAerialIntent } from './aerial-inquiry.mjs';

const reference = () => 'TX-FPS-' + String(Math.floor(1000 + Math.random() * 9000));

async function deliver(payload) {
    /* 1. Local backup (instant offline resilience) */
    try {
        localStorage.setItem('last_fused_quote', JSON.stringify(payload));
    } catch {
        /* Private browsing or a full quota — the submission continues */
    }

    /* 2. Live transmission to backend ingestion endpoint */
    try {
        const response = await fetch('/api/intake', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'quote', ...payload })
        });
        if (response.ok) {
            const result = await response.json();
            if (result?.ok === true || result?.ok === false) return result;
        }
        /* The server answers 503 when every delivery stage failed. Surface that
           rather than telling the visitor their request went through. */
        const failure = response.ok ? null : await response.json().catch(() => null);
        if (failure && failure.ok === false) return failure;
    } catch (err) {
        console.warn('[FPS Dispatch] Live endpoint unreachable, backup stored:', err);
    }
    return { ok: false, message: 'We could not send your request. Please try again or call Fused directly.' };
}

export function initQuoteForm() {
    const form = document.getElementById('securityQuoteForm');
    const status = document.getElementById('formStatus');
    if (!form) return;
    const inquiry = aerialIntent(window.location.search, config?.aerialInquiry);
    prepareAerialInquiry(form, inquiry);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const data = withAerialIntent(Object.fromEntries(new FormData(form)), inquiry);
        const refCode = reference();
        const payload = { refCode, ...data, timestamp: new Date().toISOString() };

        if (status) {
            status.textContent = 'Transmitting security parameters to operations command...';
        }

        const result = await deliver(payload);
        const code = result?.refCode || refCode;

        if (result && result.ok === false) {
            if (status) status.textContent = result.message || 'We could not transmit your request. Please call our dispatch line directly.';
            return;
        }

        const msg = (inquiry ? `${inquiry.confirmation} Reference: ${code}.` : result?.message) ||
            `Request received — dispatch reference ${code}. A commanding officer will contact ${data.formPhone} within 2 hours.`;

        if (status) {
            status.textContent = msg;
        }

        form.reset();
        if (inquiry) form.elements.formArmedPreference.value = inquiry.armedPreference;
        status?.scrollIntoView({
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
            block: 'center'
        });
    });
}
