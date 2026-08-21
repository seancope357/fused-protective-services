/* ==========================================================================
   60-SECOND THREAT & VULNERABILITY ASSESSMENT ENGINE
   ========================================================================== */
let selectedEnvironment = "";
let selectedThreatLevel = "";

function selectQuizOption(step, value) {
    if (step === 1) {
        selectedEnvironment = value;
        const step1 = document.getElementById('quizStep1');
        const step2 = document.getElementById('quizStep2');
        if (step1 && step2) {
            step1.classList.remove('active');
            step2.classList.add('active');
        }
    } else if (step === 2) {
        selectedThreatLevel = value;
        const step2 = document.getElementById('quizStep2');
        const step3 = document.getElementById('quizStep3');
        if (step2 && step3) {
            step2.classList.remove('active');
            step3.classList.add('active');
        }

        let rec = "Recommended: Level III Commissioned Armed Security Squad";
        if (selectedEnvironment.includes("VIP") || selectedThreatLevel.includes("High Profile")) {
            rec = "Recommended: Level IV Personal Protection Officer (PPO) + Dedicated Plainclothes Escort";
        } else if (selectedEnvironment.includes("Commercial") || selectedEnvironment.includes("Construction")) {
            rec = "Recommended: 24/7 Marked Mobile Patrols + Level III Static Gatehouse Guard";
        }
        const recText = document.getElementById('quizRecommendationText');
        if (recText) {
            recText.innerText = rec;
        }
    }
}

function applyQuizToQuoteForm() {
    const formDivision = document.getElementById('formDivision');
    const formArmed = document.getElementById('formArmedPreference');
    const formNotes = document.getElementById('formNotes');
    const recText = document.getElementById('quizRecommendationText');

    if (selectedEnvironment.includes("VIP")) {
        if (formDivision) formDivision.value = "Executive & VIP Close Protection (Level IV PPO)";
        if (formArmed) formArmed.value = "Armed Commissioned Officers (Level III / IV)";
    } else if (selectedEnvironment.includes("Event")) {
        if (formDivision) formDivision.value = "Special Event & Venue Security";
        if (formArmed) formArmed.value = "Mixed Detail (Armed Tactical + Uniformed Concierge)";
    } else if (selectedEnvironment.includes("Construction")) {
        if (formDivision) formDivision.value = "Construction Site Security";
        if (formArmed) formArmed.value = "Armed Commissioned Officers (Level III / IV)";
    }

    if (formNotes && recText) {
        formNotes.value = `Assessment Results:\n- Environment: ${selectedEnvironment}\n- Threat Level: ${selectedThreatLevel}\n- Recommended Configuration: ${recText.innerText}`;
    }

    const quoteSection = document.getElementById('quote');
    if (quoteSection) {
        quoteSection.scrollIntoView({ behavior: 'smooth' });
    }
}
