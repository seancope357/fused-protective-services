/* ==========================================================================
   HTML TEMPLATING PRIMITIVES
   Zero dependencies. The whole generator is built on these two exports.
   ========================================================================== */

/** Marker for strings that are already markup and must not be escaped. */
class Raw {
    constructor(value) {
        this.value = value;
    }
    toString() {
        return this.value;
    }
}

/**
 * Marks a string as trusted markup so `html` interpolates it verbatim.
 * Only ever call this on markup this repo generates — never on input.
 */
export const raw = (value) => new Raw(String(value));

const ESCAPES = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
};

/** Escapes text for use in element content or a quoted attribute value. */
export const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);

/**
 * Tagged template that escapes every interpolation by default.
 *
 * Escaping is the default rather than the opt-in because the failure modes
 * point opposite ways: a missed escape silently ships broken markup (or worse)
 * the day a division name gains an ampersand, while a missed `raw` fails
 * loudly and visibly the first time you look at the page. Arrays are joined
 * with no separator so `${items.map(...)}` reads the way it looks.
 */
export function html(strings, ...values) {
    let out = strings[0];

    for (let i = 0; i < values.length; i++) {
        out += render(values[i]) + strings[i + 1];
    }

    return raw(out);
}

function render(value) {
    if (value === null || value === undefined || value === false) return '';
    if (value instanceof Raw) return value.value;
    if (Array.isArray(value)) return value.map(render).join('');
    return escape(value);
}

/** Serializes a value as JSON safe to embed inside a <script> element. */
export const json = (value) =>
    raw(JSON.stringify(value, null, 2).replace(/</g, '\\u003c'));
