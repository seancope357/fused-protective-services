/* ==========================================================================
   INTAKE VOCABULARY
   The armed-preference options are referenced by the quote form, the
   assessment hand-off, and the estimator hand-off. Each of those three used
   to carry its own copy of these exact strings; a typo in any one of them
   silently failed to select an option and left the form on its default.
   ========================================================================== */

export const armedPreferences = {
    armed: 'Armed Commissioned Officers (Level III / IV)',
    unarmed: 'Unarmed Uniformed Security (Level II)',
    mixed: 'Mixed Detail (Armed Tactical + Uniformed Concierge)',
    recommend: 'Command Recommendation Based on Assessment'
};

/** Order shown in the quote form's Armed / Unarmed Preference select. */
export const armedPreferenceOrder = ['armed', 'unarmed', 'mixed', 'recommend'];
