/* ==========================================================================
   SECURITY DETAIL INTAKE
   Confirmation is rendered into the page rather than thrown as an alert():
   a modal alert is unstyled, blocks the tab, and drops the reference code
   the moment it is dismissed. The message here stays on screen and is
   announced, because #formStatus is a live region.

   NOTE FOR CAMERON: nothing is transmitted anywhere yet — the submission is
   recorded in this browser only. Point `deliver()` at Formspree, Web3Forms,
   or your own endpoint to route it to the command desk.
   ========================================================================== */

const reference = () => 'TX-FPS-' + String(Math.floor(1000 + Math.random() * 9000));

function deliver(payload) {
    /* The single seam a real backend plugs into. Deliberately local until
       an endpoint exists, so a failed POST can never look like a filed request. */
    try {
        localStorage.setItem('last_fused_quote', JSON.stringify(payload));
    } catch {
        /* Private browsing or a full quota — the confirmation still stands. */
    }
}

export function initQuoteForm() {
    const form = document.getElementById('securityQuoteForm');
    const status = document.getElementById('formStatus');
    if (!form) return;

    form.addEventListener('submit', (event) => {
        event.preventDefault();

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        const data = Object.fromEntries(new FormData(form));
        const refCode = reference();

        deliver({ refCode, ...data, timestamp: new Date().toISOString() });

        if (status) {
            status.textContent =
                `Request received — dispatch reference ${refCode}. A commanding officer will contact ${data.formPhone} within 2 hours.`;
        }

        form.reset();
        status?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
}
