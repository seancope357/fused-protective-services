/* ==========================================================================
   INVOICE BUILDER
   Drives invoice.html: auto numbering and dates, line-item math, the live
   paper preview, and the saved-invoice list. Every rate, term, and label it
   knows arrived through the #fps-config island — nothing here restates a
   number from src/data. All totals are computed in integer cents; floats
   only exist at the input boundary.

   The paper is filled exclusively through textContent, so nothing typed
   into the builder is ever parsed as markup.
   ========================================================================== */

import { config } from './config.mjs';
import {
    peekInvoiceNumber,
    commitInvoiceNumber,
    listInvoices,
    getInvoice,
    saveInvoice,
    deleteInvoice,
    readLastQuote
} from './invoice-store.mjs';

const $ = (id) => document.getElementById(id);
const pad2 = (n) => String(n).padStart(2, '0');

const money = (cents) =>
    (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

/* Date inputs speak YYYY-MM-DD in local time; the paper speaks prose. */
const todayIso = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const addDays = (iso, days) => {
    const [y, m, d] = iso.split('-').map(Number);
    const date = new Date(y, m - 1, d + days);
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};

const prettyDate = (iso) => {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
};

export function initInvoiceBuilder() {
    const linesBody = $('invLineItems');
    const invoiceCfg = config?.invoice;
    const tiersCfg = config?.estimator?.tiers;
    if (!linesBody || !invoiceCfg || !tiersCfg) return;

    const form = $('invoiceBuilderForm');
    const rowTemplate = $('invLineItemRow');
    const statusMsg = $('invStatusMsg');
    const prefillBtn = $('invPrefillBtn');
    const builderRoot = form.closest('.inv-builder');

    const announce = (message) => {
        if (statusMsg) statusMsg.textContent = message;
    };

    /* ── Line items ────────────────────────────────────────────────────── */

    const rows = () => [...linesBody.querySelectorAll('tr.inv-line')];

    const rowInput = (row, name) => row.querySelector(`[data-line="${name}"]`);

    function addRow() {
        linesBody.append(rowTemplate.content.cloneNode(true));
        return rows().at(-1);
    }

    /* A tier pick fills the rate and, unless the description was hand-edited,
       the description too. data-auto remembers what we wrote, so a value we
       set is ours to replace and a value the user typed never is. */
    function applyTier(row) {
        const tier = tiersCfg[rowInput(row, 'tier').value];
        const desc = rowInput(row, 'desc');
        if (!tier) {
            if (desc.value === desc.dataset.auto) desc.value = '';
            desc.dataset.auto = '';
            return;
        }
        rowInput(row, 'rate').value = tier.rate;
        if (!desc.value || desc.value === desc.dataset.auto) desc.value = tier.name;
        desc.dataset.auto = tier.name;
    }

    const readRow = (row) => ({
        tierId: rowInput(row, 'tier').value,
        desc: rowInput(row, 'desc').value.trim(),
        officers: Math.max(0, parseFloat(rowInput(row, 'officers').value) || 0),
        hours: Math.max(0, parseFloat(rowInput(row, 'hours').value) || 0),
        rate: Math.max(0, parseFloat(rowInput(row, 'rate').value) || 0)
    });

    const lineCents = (line) => Math.round(line.officers * line.hours * line.rate * 100);

    /* ── Totals + live paper preview ───────────────────────────────────── */

    function recalc() {
        let subtotal = 0;
        for (const row of rows()) {
            const cents = lineCents(readRow(row));
            rowInput(row, 'amount').textContent = money(cents);
            subtotal += cents;
        }
        const taxRate = Math.max(0, parseFloat($('invTaxRate').value) || 0);
        const tax = Math.round((subtotal * taxRate) / 100);
        syncDocument({ subtotal, tax, taxRate, total: subtotal + tax });
    }

    function syncDocument(totals) {
        const set = (id, text) => {
            const el = $(id);
            if (el) el.textContent = text;
        };

        set('docNumber', $('invNumber').value.trim() || '—');
        set('docIssueDate', prettyDate($('invIssueDate').value));
        set('docDueDate', prettyDate($('invDueDate').value));
        set('docTerms', invoiceCfg.netTerms[$('invNetTerm').value]?.label ?? '—');

        set('docClientName', $('invClientName').value.trim());
        set('docClientCompany', $('invClientCompany').value.trim());
        set('docClientAddress', $('invClientAddress').value.trim());
        set('docClientEmail', $('invClientEmail').value.trim());
        set('docClientPhone', $('invClientPhone').value.trim());

        const docLines = $('docLines');
        docLines.textContent = '';
        for (const row of rows()) {
            const line = readRow(row);
            const tr = document.createElement('tr');
            for (const text of [
                line.desc || tiersCfg[line.tierId]?.name || 'Service',
                String(line.officers),
                String(line.hours),
                money(Math.round(line.rate * 100)),
                money(lineCents(line))
            ]) {
                const td = document.createElement('td');
                td.textContent = text;
                tr.append(td);
            }
            docLines.append(tr);
        }

        set('docSubtotal', money(totals.subtotal));
        set('docTaxLabel', `${invoiceCfg.tax.label} (${totals.taxRate}%)`);
        set('docTax', money(totals.tax));
        $('docTaxRow').hidden = totals.taxRate === 0;
        set('docTotal', money(totals.total));

        const status = $('invStatus').value;
        const badge = $('docStatus');
        badge.textContent = $('invStatus').selectedOptions[0]?.textContent ?? status;
        badge.dataset.status = status;

        const notes = $('invNotes').value.trim();
        const terms = $('invTerms').value.trim();
        set('docNotes', notes);
        set('docTermsText', terms);
        $('docNotesBlock').hidden = !notes;
        $('docTermsBlock').hidden = !terms;

        return totals;
    }

    /* ── Dates ─────────────────────────────────────────────────────────── */

    function updateDueDate() {
        const due = $('invDueDate');
        if (due.dataset.touched) return;
        const issue = $('invIssueDate').value || todayIso();
        const days = invoiceCfg.netTerms[$('invNetTerm').value]?.days ?? 0;
        due.value = addDays(issue, days);
    }

    /* ── Serialize / load ──────────────────────────────────────────────── */

    function currentTotals() {
        const subtotal = rows().reduce((sum, row) => sum + lineCents(readRow(row)), 0);
        const taxRate = Math.max(0, parseFloat($('invTaxRate').value) || 0);
        const tax = Math.round((subtotal * taxRate) / 100);
        return { subtotalCents: subtotal, taxCents: tax, taxRatePct: taxRate, totalCents: subtotal + tax };
    }

    const serialize = () => ({
        number: $('invNumber').value.trim(),
        status: $('invStatus').value,
        issueDate: $('invIssueDate').value,
        dueDate: $('invDueDate').value,
        netTermId: $('invNetTerm').value,
        client: {
            name: $('invClientName').value.trim(),
            company: $('invClientCompany').value.trim(),
            email: $('invClientEmail').value.trim(),
            phone: $('invClientPhone').value.trim(),
            address: $('invClientAddress').value.trim()
        },
        lines: rows().map(readRow),
        notes: $('invNotes').value,
        terms: $('invTerms').value,
        totals: currentTotals(),
        savedAt: new Date().toISOString()
    });

    function loadRecord(record) {
        form.reset();
        $('invNumber').value = record.number;
        $('invStatus').value = record.status ?? 'draft';
        $('invIssueDate').value = record.issueDate ?? todayIso();
        if (invoiceCfg.netTerms[record.netTermId]) $('invNetTerm').value = record.netTermId;
        $('invDueDate').value = record.dueDate ?? '';
        $('invDueDate').dataset.touched = '1';

        $('invClientName').value = record.client?.name ?? '';
        $('invClientCompany').value = record.client?.company ?? '';
        $('invClientEmail').value = record.client?.email ?? '';
        $('invClientPhone').value = record.client?.phone ?? '';
        $('invClientAddress').value = record.client?.address ?? '';
        $('invNotes').value = record.notes ?? '';
        $('invTerms').value = record.terms ?? '';
        $('invTaxRate').value = record.totals?.taxRatePct ?? 0;

        linesBody.textContent = '';
        for (const line of Array.isArray(record.lines) && record.lines.length ? record.lines : [{}]) {
            const row = addRow();
            const tierSelect = rowInput(row, 'tier');
            tierSelect.value = tiersCfg[line.tierId] || line.tierId === 'custom' ? line.tierId : 'custom';
            rowInput(row, 'desc').dataset.auto = '';
            rowInput(row, 'desc').value = line.desc ?? '';
            rowInput(row, 'officers').value = line.officers ?? 1;
            rowInput(row, 'hours').value = line.hours ?? 0;
            rowInput(row, 'rate').value = line.rate ?? 0;
        }
        recalc();
    }

    function freshInvoice() {
        form.reset();
        delete $('invDueDate').dataset.touched;
        linesBody.textContent = '';
        addRow();
        $('invNumber').value = peekInvoiceNumber(invoiceCfg.numbering);
        $('invIssueDate').value = todayIso();
        updateDueDate();
        recalc();
    }

    /* ── Saved list ────────────────────────────────────────────────────── */

    function renderSaved() {
        const list = listInvoices();
        $('invSavedTable').hidden = list.length === 0;
        $('invSavedEmpty').hidden = list.length > 0;

        const body = $('invSavedList');
        body.textContent = '';
        for (const inv of list) {
            const tr = document.createElement('tr');

            const cells = [
                inv.number,
                inv.client?.company || inv.client?.name || '—',
                prettyDate(inv.issueDate),
                money(inv.totals?.totalCents ?? 0)
            ];
            for (const text of cells) {
                const td = document.createElement('td');
                td.textContent = text;
                tr.append(td);
            }

            const statusTd = document.createElement('td');
            const chip = document.createElement('span');
            chip.className = 'inv-status-chip';
            chip.dataset.status = inv.status ?? 'draft';
            chip.textContent = inv.status ?? 'draft';
            statusTd.append(chip);
            tr.append(statusTd);

            const toolsTd = document.createElement('td');
            const tools = document.createElement('div');
            tools.className = 'inv-saved__actions';
            for (const [action, label] of [
                ['open-saved', 'Open'],
                ['delete-saved', 'Delete']
            ]) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'inv-tool-btn';
                btn.dataset.action = action;
                btn.dataset.number = inv.number;
                btn.textContent = label;
                tools.append(btn);
            }
            toolsTd.append(tools);
            tr.append(toolsTd);
            body.append(tr);
        }
    }

    /* ── Actions ───────────────────────────────────────────────────────── */

    function save() {
        if (!$('invClientName').value.trim()) {
            announce('Add a client contact name before saving.');
            $('invClientName').focus();
            return;
        }
        if (!$('invNumber').value.trim()) $('invNumber').value = peekInvoiceNumber(invoiceCfg.numbering);

        const record = serialize();
        if (saveInvoice(record)) {
            commitInvoiceNumber(record.number, invoiceCfg.numbering);
            renderSaved();
            announce(`Saved ${record.number} — ${money(record.totals.totalCents)} (${record.status}).`);
        } else {
            announce('This browser is blocking storage — the invoice was NOT saved. Print or PDF it instead.');
        }
    }

    function duplicate() {
        $('invNumber').value = peekInvoiceNumber(invoiceCfg.numbering);
        $('invStatus').value = 'draft';
        $('invIssueDate').value = todayIso();
        delete $('invDueDate').dataset.touched;
        updateDueDate();
        recalc();
        announce(`Duplicated as ${$('invNumber').value} — save to keep it.`);
    }

    function prefillFromQuote() {
        const quote = readLastQuote();
        if (!quote) return;
        $('invClientName').value = quote.formName ?? '';
        $('invClientCompany').value = quote.formCompany ?? '';
        $('invClientEmail').value = quote.formEmail ?? '';
        $('invClientPhone').value = quote.formPhone ?? '';
        const detail = [
            quote.formDivision && `Division: ${quote.formDivision}`,
            quote.formLocation && `Location: ${quote.formLocation}`,
            quote.formSchedule && `Schedule: ${quote.formSchedule}`
        ].filter(Boolean);
        if (detail.length) {
            const address = $('invClientAddress');
            if (!address.value.trim()) address.value = detail.join('\n');
        }
        recalc();
        announce(quote.refCode ? `Client details loaded from quote ${quote.refCode}.` : 'Client details loaded from the last quote.');
    }

    /* Two-click delete: the first click arms the button, the second acts.
       Styled, in-flow, and announced — window.confirm is neither. */
    function armOrDelete(btn) {
        if (!btn.dataset.armed) {
            btn.dataset.armed = '1';
            btn.textContent = 'Confirm';
            setTimeout(() => {
                btn.dataset.armed = '';
                btn.textContent = 'Delete';
            }, 3000);
            return;
        }
        deleteInvoice(btn.dataset.number);
        renderSaved();
        announce(`Deleted ${btn.dataset.number}.`);
    }

    /* ── Wiring ────────────────────────────────────────────────────────── */

    builderRoot.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-action]');
        if (!btn) return;

        switch (btn.dataset.action) {
            case 'add-line':
                addRow();
                recalc();
                break;
            case 'remove-line': {
                btn.closest('tr.inv-line')?.remove();
                if (rows().length === 0) addRow();
                recalc();
                break;
            }
            case 'save-invoice':
                save();
                break;
            case 'print-invoice':
                recalc();
                window.print();
                break;
            case 'new-invoice':
                freshInvoice();
                announce(`Started ${$('invNumber').value}.`);
                break;
            case 'duplicate-invoice':
                duplicate();
                break;
            case 'prefill-from-quote':
                prefillFromQuote();
                break;
            case 'open-saved': {
                const record = getInvoice(btn.dataset.number);
                if (record) {
                    loadRecord(record);
                    announce(`Opened ${record.number}.`);
                }
                break;
            }
            case 'delete-saved':
                armOrDelete(btn);
                break;
        }
    });

    form.addEventListener('input', (event) => {
        if (event.target.id === 'invDueDate') event.target.dataset.touched = '1';
        recalc();
    });

    form.addEventListener('change', (event) => {
        if (event.target.matches('[data-line="tier"]')) {
            applyTier(event.target.closest('tr.inv-line'));
        }
        if (event.target.id === 'invNetTerm' || event.target.id === 'invIssueDate') {
            updateDueDate();
        }
        recalc();
    });

    /* ── Boot ──────────────────────────────────────────────────────────── */

    $('invNumber').value = peekInvoiceNumber(invoiceCfg.numbering);
    $('invIssueDate').value = todayIso();
    updateDueDate();
    if (prefillBtn && readLastQuote()) prefillBtn.hidden = false;
    renderSaved();
    recalc();
}
