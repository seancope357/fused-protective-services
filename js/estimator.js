/* ==========================================================================
   SECURITY COVERAGE & BUDGET ESTIMATOR CONTROLLER
   ========================================================================== */
let activeRate = 65;
let activeTierName = "Level III Armed";

function selectTier(tierIndex, rate) {
    activeRate = rate;
    const buttons = document.querySelectorAll('.tier-button');
    buttons.forEach((btn, idx) => {
        btn.classList.toggle('active', idx === tierIndex - 1);
    });
    if (tierIndex === 1) activeTierName = "Level II Unarmed";
    if (tierIndex === 2) activeTierName = "Level III Armed";
    if (tierIndex === 3) activeTierName = "Level IV Executive PPO";
    calculateEstimate();
}

function calculateEstimate() {
    const guardRange = document.getElementById('guardRange');
    const hoursRange = document.getElementById('hoursRange');
    if (!guardRange || !hoursRange) return;

    const guards = parseInt(guardRange.value);
    const hours = parseInt(hoursRange.value);

    const guardCountText = document.getElementById('guardCountText');
    const hoursText = document.getElementById('hoursText');
    const calculatedTotal = document.getElementById('calculatedTotal');
    const calculatedFormula = document.getElementById('calculatedFormula');

    if (guardCountText) guardCountText.innerText = guards + (guards === 1 ? ' Officer' : ' Officers');
    if (hoursText) hoursText.innerText = hours + ' Hours';

    const total = guards * hours * activeRate;
    if (calculatedTotal) calculatedTotal.innerText = '$' + total.toLocaleString();
    if (calculatedFormula) calculatedFormula.innerText = `${guards} ${activeTierName} × ${hours} Hours @ $${activeRate}/hr`;
}

function lockInEstimateToForm() {
    const guardRange = document.getElementById('guardRange');
    const hoursRange = document.getElementById('hoursRange');
    if (!guardRange || !hoursRange) return;

    const guards = guardRange.value;
    const hours = hoursRange.value;
    
    const formSchedule = document.getElementById('formSchedule');
    const formDivision = document.getElementById('formDivision');
    const formArmed = document.getElementById('formArmedPreference');

    if (formSchedule) formSchedule.value = `${hours} Hours / Shift (${guards} Guards Estimated)`;
    if (activeTierName.includes("Level IV")) {
        if (formDivision) formDivision.value = "Executive & VIP Close Protection (Level IV PPO)";
        if (formArmed) formArmed.value = "Armed Commissioned Officers (Level III / IV)";
    } else if (activeTierName.includes("Level III")) {
        if (formDivision) formDivision.value = "Commercial & Property Patrol";
        if (formArmed) formArmed.value = "Armed Commissioned Officers (Level III / IV)";
    } else {
        if (formArmed) formArmed.value = "Unarmed Uniformed Security (Level II)";
    }

    const quoteSection = document.getElementById('quote');
    if (quoteSection) {
        quoteSection.scrollIntoView({ behavior: 'smooth' });
    }
}
