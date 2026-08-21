/* ==========================================================================
   3D PERSPECTIVE TILT (HERO EMBLEM SHIELD)
   ========================================================================== */
(function() {
    const emblemWrapper = document.getElementById('emblemWrapper');
    const emblemCard = document.getElementById('emblemCard');
    if (!emblemWrapper || !emblemCard) return;

    emblemWrapper.addEventListener('mousemove', (e) => {
        const rect = emblemWrapper.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        const rotX = -(y / (rect.height / 2)) * 18;
        const rotY = (x / (rect.width / 2)) * 18;
        emblemCard.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.05)`;
    });

    emblemWrapper.addEventListener('mouseleave', () => {
        emblemCard.style.transform = 'rotateX(0deg) rotateY(0deg) scale(1)';
    });
})();
