/* ==========================================================================
   INVOICE PERSISTENCE
   localStorage only, the same deliberate posture as the quote form's
   deliver(): records stay in this browser until a real backend exists, so a
   failed write can never look like a filed invoice. Every read is defensive
   — a torn or foreign value degrades to "nothing saved", never to a throw
   that takes the builder down.

   Numbering is peek/commit rather than a single mint: the builder shows the
   next FPS-YYYY-#### on load, but the counter only advances when an invoice
   is actually saved, so reloading the page never burns numbers.
   ========================================================================== */

const SEQ_KEY = 'fps_invoice_seq_v1';
const LIST_KEY = 'fps_invoices_v1';

function readJson(key) {
    try {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : null;
    } catch {
        return null;
    }
}

function writeJson(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch {
        /* Private browsing or a full quota — callers carry on without persistence. */
        return false;
    }
}

const pad = (n, width) => String(n).padStart(width, '0');

const numberPattern = (numbering, year) =>
    new RegExp(`^${numbering.prefix}-${year}-(\\d{${numbering.pad},})$`);

/** Highest sequence already spoken for this year: the stored counter or any
    saved invoice number, whichever is further along. */
function highestSeq(numbering, year) {
    const stored = readJson(SEQ_KEY);
    let seq = stored && stored.year === year && Number.isInteger(stored.seq) ? stored.seq : 0;

    const pattern = numberPattern(numbering, year);
    for (const inv of listInvoices()) {
        const match = pattern.exec(inv.number);
        if (match) seq = Math.max(seq, parseInt(match[1], 10));
    }
    return seq;
}

/** The number the next saved invoice should carry. Read-only — nothing is
    reserved until commitInvoiceNumber runs. */
export function peekInvoiceNumber(numbering) {
    const year = new Date().getFullYear();
    try {
        return `${numbering.prefix}-${year}-${pad(highestSeq(numbering, year) + 1, numbering.pad)}`;
    } catch {
        /* Storage hostile enough to throw through the guards: fall back to a
           date-stamped number that stays unique without a counter. */
        const now = new Date();
        const stamp = `${pad(now.getMonth() + 1, 2)}${pad(now.getDate(), 2)}`;
        return `${numbering.prefix}-${year}-${stamp}-${pad(Math.floor(Math.random() * 10000), 4)}`;
    }
}

/** Advances the counter past a number that has now been used, so the next
    peek moves on even after the invoice itself is deleted. */
export function commitInvoiceNumber(number, numbering) {
    const year = new Date().getFullYear();
    const match = numberPattern(numbering, year).exec(number);
    if (!match) return;
    const seq = Math.max(highestSeq(numbering, year), parseInt(match[1], 10));
    writeJson(SEQ_KEY, { year, seq });
}

/** Every saved invoice, newest first. Foreign shapes are filtered out. */
export function listInvoices() {
    const list = readJson(LIST_KEY);
    if (!Array.isArray(list)) return [];
    return list.filter((inv) => inv && typeof inv.number === 'string');
}

export function getInvoice(number) {
    return listInvoices().find((inv) => inv.number === number) ?? null;
}

/** Upserts by invoice number. Returns false when storage is unavailable. */
export function saveInvoice(record) {
    const rest = listInvoices().filter((inv) => inv.number !== record.number);
    return writeJson(LIST_KEY, [record, ...rest]);
}

export function deleteInvoice(number) {
    return writeJson(LIST_KEY, listInvoices().filter((inv) => inv.number !== number));
}

/** The marketing page's last quote submission, if this browser made one. */
export function readLastQuote() {
    const quote = readJson('last_fused_quote');
    return quote && typeof quote === 'object' ? quote : null;
}
