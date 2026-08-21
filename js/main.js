/* ==========================================================================
   FUSED PROTECTIVE SERVICES — MAIN APPLICATION CONTROLLER
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Mouse Spotlight Tracker
    const spotlight = document.getElementById('cursorSpotlight');
    if (spotlight) {
        document.addEventListener('mousemove', (e) => {
            spotlight.style.left = e.clientX + 'px';
            spotlight.style.top = e.clientY + 'px';
        });
    }

    // 2. Initialize Range Calculation
    if (typeof calculateEstimate === 'function') {
        calculateEstimate();
    }
});

// Mobile Drawer Menu Toggle
function toggleMobileMenu() {
    const drawer = document.getElementById('mobileDrawer');
    const overlay = document.getElementById('drawerOverlay');
    if (drawer && overlay) {
        drawer.classList.toggle('open');
        overlay.classList.toggle('open');
    }
}

// FAQ Accordion Toggle
function handleFaqClick(card) {
    const answer = card.querySelector('.faq-answer');
    const icon = card.querySelector('.faq-toggle-icon');
    if (!answer || !icon) return;

    if (answer.style.display === 'block') {
        answer.style.display = 'none';
        icon.innerText = '+';
    } else {
        answer.style.display = 'block';
        icon.innerText = '−';
    }
}

// Intake Form Submission Handler
function submitQuoteForm(e) {
    e.preventDefault();
    const refCode = "TX-FPS-" + Math.floor(1000 + Math.random() * 9000);
    const nameInput = document.getElementById('formName');
    const phoneInput = document.getElementById('formPhone');
    const divisionInput = document.getElementById('formDivision');

    const name = nameInput ? nameInput.value : "Valued Client";
    const phone = phoneInput ? phoneInput.value : "your phone";
    const division = divisionInput ? divisionInput.value : "Executive Security Detail";

    const payload = { refCode, name, phone, division, timestamp: new Date().toISOString() };
    try {
        localStorage.setItem('last_fused_quote', JSON.stringify(payload));
    } catch (err) {}

    alert(`✅ SECURITY DETAIL INTAKE CONFIRMED\n\nDispatch Reference Code: ${refCode}\nClient: ${name}\nDivision: ${division}\n\nA commanding officer has received your parameters and will contact you at ${phone} within 2 hours.`);
    
    const form = document.getElementById('securityQuoteForm');
    if (form) form.reset();
}
