/* ==========================================================================
   4-STAGE DEPLOYMENT PROTOCOL CONTROLLER
   ========================================================================== */
function switchProtocolStage(stageIdx) {
    const stepperBtns = document.querySelectorAll('.protocol-stepper-btn');
    stepperBtns.forEach((btn, idx) => {
        btn.classList.toggle('active', idx === stageIdx);
    });

    for (let i = 0; i < 4; i++) {
        const panel = document.getElementById(`stagePanel${i}`);
        if (panel) {
            panel.classList.toggle('active', i === stageIdx);
        }
    }
}
