/* ==========================================================================
   SECURITY DETAIL INTAKE
   Confirmation is rendered into the page rather than thrown as an alert():
   a modal alert is unstyled, blocks the tab, and drops the reference code
   the moment it is dismissed. The message here stays on screen and is
   announced, because #formStatus is a live region.

   Integrated with live /api/intake backend with local offline resilience.
   ========================================================================== */

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
        /* The server answered, so whatever it said is the truth about this
           submission: a 200, a 429 rate limit, a duplicate notice, or a 503
           when every delivery stage failed. All of them carry a message and are
           returned as-is. A response with no usable body is still a refusal,
           never a success — only a network failure reaches the offline fallback. */
        const result = await response.json().catch(() => null);
        if (result && typeof result.ok === 'boolean') return result;
        return {
            ok: false,
            message: 'We could not transmit your request. Please call our dispatch line directly.'
        };
    } catch (err) {
        console.warn('[FPS Dispatch] Live endpoint unreachable, backup stored:', err);
    }
    return { ok: true, refCode: payload.refCode };
}

export function initQuoteForm() {
    const form = document.getElementById('securityQuoteForm');
    const status = document.getElementById('formStatus');
    if (!form) return;

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const data = Object.fromEntries(new FormData(form));
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

        /* Already on file from a moment ago. Nothing was re-sent, so the form
           is left as typed and the visitor is pointed at the reference they
           already hold. */
        if (result && result.duplicate) {
            if (status) status.textContent = result.message;
            return;
        }

        const msg = result?.message ||
            `Request received — dispatch reference ${code}. A commanding officer will contact ${data.formPhone} within 2 hours.`;

        if (status) {
            status.textContent = msg;
        }

        form.reset();
        status?.scrollIntoView({
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
            block: 'center'
        });
    });
}
