/* ==========================================================================
   INVOICE DOCUMENT — THE PAPER
   The white sheet that prints. Company facts render at build time from
   src/data/site.mjs; every per-invoice value is an empty, id'd slot the
   browser fills through textContent, so nothing typed into the builder can
   ever be parsed as markup. This article is the only thing @media print
   keeps, which is why the preview on screen and the PDF are the same pixels.
   ========================================================================== */

import { html } from '../../lib/html.mjs';
import { site } from '../../data/site.mjs';
import { paymentCopy } from '../../data/invoice.mjs';

export const invoiceDoc = () => html`
                <article class="inv-doc" id="invoiceDoc" aria-label="Invoice preview">
                    <header class="inv-doc__brand">
                        <img class="inv-doc__logo" src="${site.logo}" alt="" width="72" height="72">
                        <div class="inv-doc__identity">
                            <p class="inv-doc__name">${site.name}</p>
                            <p class="inv-doc__motto">${site.motto}</p>
                        </div>
                        <address class="inv-doc__contact">
                            ${site.address.locality}, ${site.address.region}<br>
                            ${site.phone.display}<br>
                            ${site.email}
                        </address>
                    </header>

                    <div class="inv-doc__title-row">
                        <h2 class="inv-doc__title">Invoice</h2>
                        <span class="inv-doc__badge" id="docStatus" data-status="draft">Draft</span>
                    </div>

                    <div class="inv-doc__meta">
                        <div class="inv-doc__billto">
                            <h3 class="inv-doc__label">Bill To</h3>
                            <p class="inv-doc__client-name" id="docClientName"></p>
                            <p id="docClientCompany"></p>
                            <p id="docClientAddress"></p>
                            <p id="docClientEmail"></p>
                            <p id="docClientPhone"></p>
                        </div>
                        <dl class="inv-doc__facts">
                            <div><dt>Invoice №</dt><dd id="docNumber"></dd></div>
                            <div><dt>Issue Date</dt><dd id="docIssueDate"></dd></div>
                            <div><dt>Terms</dt><dd id="docTerms"></dd></div>
                            <div><dt>Due Date</dt><dd id="docDueDate"></dd></div>
                        </dl>
                    </div>

                    <table class="inv-doc__table">
                        <thead>
                            <tr>
                                <th scope="col" class="inv-doc__col-desc">Service</th>
                                <th scope="col" class="inv-doc__col-num">Officers</th>
                                <th scope="col" class="inv-doc__col-num">Hours</th>
                                <th scope="col" class="inv-doc__col-num">Rate</th>
                                <th scope="col" class="inv-doc__col-amt">Amount</th>
                            </tr>
                        </thead>
                        <tbody id="docLines"></tbody>
                    </table>

                    <div class="inv-doc__totals">
                        <div><span>Subtotal</span><span id="docSubtotal"></span></div>
                        <div id="docTaxRow"><span id="docTaxLabel"></span><span id="docTax"></span></div>
                        <div class="inv-doc__total-due"><span>Total Due</span><span id="docTotal"></span></div>
                    </div>

                    <footer class="inv-doc__foot">
                        <div class="inv-doc__foot-block" id="docNotesBlock">
                            <h3 class="inv-doc__label">Notes</h3>
                            <p id="docNotes"></p>
                        </div>
                        <div class="inv-doc__foot-block" id="docTermsBlock">
                            <h3 class="inv-doc__label">Terms</h3>
                            <p id="docTermsText"></p>
                        </div>
                        <div class="inv-doc__foot-block">
                            <h3 class="inv-doc__label">${paymentCopy.heading}</h3>
                            <p>${paymentCopy.instructions}</p>
                            <p>Questions: ${site.email} · ${site.phone.display}</p>
                        </div>
                    </footer>
                </article>`;
