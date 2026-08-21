/* ==========================================================================
   HORIZONTAL MAGAZINE BOOKSHELF ACCORDION CONTROLLER
   ========================================================================== */
function activateSpine(el) {
    const spines = document.querySelectorAll('.bookshelf-spine');
    spines.forEach(s => s.classList.remove('active'));
    el.classList.add('active');
}

function selectDivisionForQuote(divisionName) {
    const divisionSelect = document.getElementById('formDivision');
    if (divisionSelect) {
        divisionSelect.value = divisionName;
    }
    const quoteSection = document.getElementById('quote');
    if (quoteSection) {
        quoteSection.scrollIntoView({ behavior: 'smooth' });
    }
}
