/* ==========================================================================
   INVOICE BUILDER FORM
   The dark, screen-only half of the page. Reuses the intake form's field
   classes so both forms move together. The tier <select> options and every
   default value render at build time from src/data — the browser script
   reads rates from the JSON island, never from its own constants. All
   buttons route through delegated data-action listeners; the row markup for
   a line item lives in a <template> so adding a line clones markup this file
   produced, not markup assembled in JS.
   ========================================================================== */

import { html } from '../../lib/html.mjs';
import { tiers, defaultTier } from '../../data/estimator.mjs';
import { netTerms, defaultNetTerm, tax, invoiceStatuses, defaultNotes, defaultTerms } from '../../data/invoice.mjs';

const field = ({ id, label, type = 'text', placeholder = '', required = false }) => html`
                        <div class="form-field">
                            <label for="${id}">${label}</label>
                            <input type="${type}" id="${id}" name="${id}" placeholder="${placeholder}"${required ? ' required' : ''}>
                        </div>`;

const tierOptions = (selectedId) => html`${tiers.map(
    (t) => html`<option value="${t.id}"${t.id === selectedId ? ' selected' : ''}>${t.name}</option>`
)}<option value="custom">Custom line</option>`;

/* One line-item row. Rendered once into the visible tbody as the starting
   line and once into the <template> the script clones for "Add line". */
const lineRow = () => html`
                            <tr class="inv-line">
                                <td class="inv-line__service">
                                    <select data-line="tier" aria-label="Service tier">${tierOptions(defaultTier.id)}</select>
                                    <input type="text" data-line="desc" aria-label="Line description" placeholder="Description" value="${defaultTier.name}" data-auto="${defaultTier.name}">
                                </td>
                                <td><input type="number" data-line="officers" aria-label="Officers" min="1" step="1" value="1"></td>
                                <td><input type="number" data-line="hours" aria-label="Hours" min="0" step="0.5" value="8"></td>
                                <td><input type="number" data-line="rate" aria-label="Hourly rate in dollars" min="0" step="0.01" value="${defaultTier.rate}"></td>
                                <td class="inv-line__amount" data-line="amount">—</td>
                                <td class="inv-line__tools">
                                    <button type="button" class="inv-tool-btn" data-action="remove-line" aria-label="Remove line item">✕</button>
                                </td>
                            </tr>`;

export const builder = () => html`
            <section class="inv-builder" aria-label="Invoice builder">
                <form id="invoiceBuilderForm" novalidate>
                    <h2 class="inv-builder__heading">Client</h2>
                    <div class="form-row-2col">
${field({ id: 'invClientName', label: 'Client Contact Name', placeholder: 'Full name', required: true })}
${field({ id: 'invClientCompany', label: 'Company / Organization', placeholder: 'Organization' })}
                    </div>
                    <div class="form-row-2col">
${field({ id: 'invClientEmail', label: 'Email', type: 'email', placeholder: 'name@company.com' })}
${field({ id: 'invClientPhone', label: 'Phone', type: 'tel', placeholder: '(512) 555-0100' })}
                    </div>
                    <div class="form-field form-field--gap">
                        <label for="invClientAddress">Billing Address</label>
                        <textarea id="invClientAddress" name="invClientAddress" rows="2" placeholder="Street, city, state, ZIP"></textarea>
                    </div>

                    <h2 class="inv-builder__heading">Invoice</h2>
                    <div class="form-row-2col">
${field({ id: 'invNumber', label: 'Invoice Number', placeholder: 'Assigned automatically' })}
${field({ id: 'invIssueDate', label: 'Issue Date', type: 'date' })}
                    </div>
                    <div class="form-row-2col">
                        <div class="form-field">
                            <label for="invNetTerm">Payment Terms</label>
                            <select id="invNetTerm" name="invNetTerm">
                                ${netTerms.map(
                                    (t) => html`<option value="${t.id}"${t.id === defaultNetTerm.id ? ' selected' : ''}>${t.label}</option>`
                                )}
                            </select>
                        </div>
${field({ id: 'invDueDate', label: 'Due Date', type: 'date' })}
                    </div>

                    <h2 class="inv-builder__heading">Line Items</h2>
                    <div class="inv-lines-scroll">
                        <table class="inv-lines">
                            <thead>
                                <tr>
                                    <th scope="col">Service</th>
                                    <th scope="col">Officers</th>
                                    <th scope="col">Hours</th>
                                    <th scope="col">Rate $/hr</th>
                                    <th scope="col">Amount</th>
                                    <th scope="col"><span class="visually-hidden">Row actions</span></th>
                                </tr>
                            </thead>
                            <tbody id="invLineItems">
${lineRow()}
                            </tbody>
                        </table>
                    </div>
                    <button type="button" class="btn-secondary-glass inv-add-line" data-action="add-line">+ Add Line Item</button>

                    <div class="form-row-2col inv-tax-row">
                        <div class="form-field">
                            <label for="invTaxRate">${tax.label} %</label>
                            <input type="number" id="invTaxRate" name="invTaxRate" min="0" max="100" step="0.01" value="${tax.defaultRatePct}">
                        </div>
                        <div class="form-field">
                            <label for="invStatus">Status</label>
                            <select id="invStatus" name="invStatus">
                                ${invoiceStatuses.map((s) => html`<option value="${s.id}">${s.label}</option>`)}
                            </select>
                        </div>
                    </div>

                    <div class="form-field form-field--gap">
                        <label for="invNotes">Notes (printed on the invoice)</label>
                        <textarea id="invNotes" name="invNotes" rows="2">${defaultNotes}</textarea>
                    </div>
                    <div class="form-field form-field--gap">
                        <label for="invTerms">Terms (printed on the invoice)</label>
                        <textarea id="invTerms" name="invTerms" rows="3">${defaultTerms}</textarea>
                    </div>

                    <div class="inv-actions">
                        <button type="button" class="btn-gold" data-action="save-invoice">Save Invoice</button>
                        <button type="button" class="btn-secondary-glass" data-action="print-invoice">Print / Save PDF</button>
                        <button type="button" class="btn-secondary-glass" data-action="duplicate-invoice">Duplicate</button>
                        <button type="button" class="btn-secondary-glass" data-action="new-invoice">New</button>
                        <button type="button" class="btn-secondary-glass" data-action="prefill-from-quote" id="invPrefillBtn" hidden>Prefill From Last Quote</button>
                    </div>
                    <p class="form-status" id="invStatusMsg" role="status" aria-live="polite"></p>
                </form>

                <section class="inv-saved" aria-label="Saved invoices">
                    <h2 class="inv-builder__heading">Saved Invoices</h2>
                    <p class="inv-saved__empty" id="invSavedEmpty">Nothing saved yet — saved invoices live in this browser only.</p>
                    <div class="inv-lines-scroll">
                        <table class="inv-lines inv-saved__table" id="invSavedTable" hidden>
                            <thead>
                                <tr>
                                    <th scope="col">Number</th>
                                    <th scope="col">Client</th>
                                    <th scope="col">Issued</th>
                                    <th scope="col">Total</th>
                                    <th scope="col">Status</th>
                                    <th scope="col"><span class="visually-hidden">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody id="invSavedList"></tbody>
                        </table>
                    </div>
                </section>

                <template id="invLineItemRow">
${lineRow()}
                </template>
            </section>`;
