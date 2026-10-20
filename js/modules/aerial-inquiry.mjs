/* A closed, build-supplied service intent. Never turn URL text into form copy. */
export function aerialIntent(search, inquiry) {
    return inquiry && new URLSearchParams(search).get('service') === inquiry.service ? inquiry : null;
}

export function withAerialIntent(data, inquiry) {
    if (!inquiry) return data;
    const notes = data.formNotes || '';
    return { ...data, formNotes: notes.startsWith(inquiry.marker) ? notes : `${inquiry.marker}\n\n${notes}` };
}

export function prepareAerialInquiry(form, inquiry) {
    if (!inquiry) return;
    const section = form.closest('section');
    const intro = section.querySelector('[data-quote-intro]');
    for (const [selector, value] of [['span', inquiry.tag], ['h2', inquiry.title], ['p', inquiry.description]]) {
        const element = intro?.querySelector(selector);
        if (element) element.textContent = value;
    }
    section.querySelector('label[for="formNotes"]').textContent = inquiry.notesLabel;
    form.elements.formNotes.placeholder = inquiry.notesPlaceholder;
    form.elements.formSchedule.placeholder = inquiry.schedulePlaceholder;
    form.querySelector('[type="submit"]').textContent = inquiry.title;
    // A drone inquiry must not silently become the first (PPO) division.
    const division = form.elements.formDivision;
    const restored = division.value !== division.options[0].value;
    division.prepend(new Option(inquiry.divisionPrompt, '', !restored, !restored));
    division.options[0].disabled = true;
    division.required = true;
    form.elements.formArmedPreference.value = inquiry.armedPreference;
}
