/* ==========================================================================
   OFFICER CANDIDATE INTAKE FORM
   ========================================================================== */

import { html } from '../../lib/html.mjs';
import { positions } from '../../data/careers.mjs';

export const careersApply = () => html`
<section class="careers-apply-section" id="candidate-application">
    <div class="container">
        <div class="section-header-centered">
            <div class="tactical-badge">COMMAND INTAKE</div>
            <h2 class="section-title">TRANSMIT OFFICER APPLICATION</h2>
            <p class="section-lead">
                Submit your operational profile directly to Cameron Harrell and the Fused Command Desk. Applications are reviewed within 48 business hours.
            </p>
        </div>

        <div class="apply-form-wrapper">
            <form id="candidateApplicationForm" class="tactical-apply-form" novalidate>
                <div class="form-row-duo">
                    <div class="form-field-group">
                        <label for="appPosition" class="form-field-label">Target Requisition *</label>
                        <select id="appPosition" name="appPosition" class="form-select" required>
                            <option value="" disabled selected>Select an Open Post...</option>
                            ${positions.map(
                                (pos) => html`
                            <option value="${pos.id}">${pos.title}</option>`
                            )}
                            <option value="general-roster">General Roster Consideration (Texas DPS Licensed)</option>
                        </select>
                    </div>

                    <div class="form-field-group">
                        <label for="appLicenseLevel" class="form-field-label">Current Texas DPS PSB License *</label>
                        <select id="appLicenseLevel" name="appLicenseLevel" class="form-select" required>
                            <option value="" disabled selected>Select Current Licensure...</option>
                            <option value="level-4">Texas DPS Level IV Personal Protection Officer (PPO)</option>
                            <option value="level-3">Texas DPS Level III Commissioned Armed Officer</option>
                            <option value="level-2">Texas DPS Level II Non-Commissioned Security</option>
                            <option value="transfer">Out-of-State / Prior Military (Eligible to Certify)</option>
                            <option value="dispatcher">Tactical Dispatch / Non-Commissioned Operations</option>
                        </select>
                    </div>
                </div>

                <div class="form-row-duo">
                    <div class="form-field-group">
                        <label for="appFullName" class="form-field-label">Full Legal Name *</label>
                        <input type="text" id="appFullName" name="appFullName" class="form-input" placeholder="e.g. John C. Miller" required autocomplete="name">
                    </div>

                    <div class="form-field-group">
                        <label for="appPhone" class="form-field-label">Mobile Phone Number *</label>
                        <input type="tel" id="appPhone" name="appPhone" class="form-input" placeholder="(512) 000-0000" required autocomplete="tel">
                    </div>
                </div>

                <div class="form-row-duo">
                    <div class="form-field-group">
                        <label for="appEmail" class="form-field-label">Email Address *</label>
                        <input type="email" id="appEmail" name="appEmail" class="form-input" placeholder="john.miller@example.com" required autocomplete="email">
                    </div>

                    <div class="form-field-group">
                        <label for="appLicenseNumber" class="form-field-label">Texas TOPS License Number (If Active)</label>
                        <input type="text" id="appLicenseNumber" name="appLicenseNumber" class="form-input" placeholder="e.g. TX-PSB-0492819">
                    </div>
                </div>

                <div class="form-field-group">
                    <label for="appServiceBranch" class="form-field-label">Prior Military or Law Enforcement Service</label>
                    <select id="appServiceBranch" name="appServiceBranch" class="form-select">
                        <option value="civilian">Civilian Security Experience Only</option>
                        <option value="army">U.S. Army / Army National Guard</option>
                        <option value="marines">U.S. Marine Corps</option>
                        <option value="navy">U.S. Navy / Naval Special Warfare</option>
                        <option value="air-force">U.S. Air Force / Security Forces</option>
                        <option value="coast-guard">U.S. Coast Guard</option>
                        <option value="texas-dps">Texas DPS / Texas Rangers / State Police</option>
                        <option value="municipal-pd">Municipal Police Department / Sheriff's Office</option>
                        <option value="federal-le">Federal Law Enforcement (USMS, ATF, DEA, FBI, DSS)</option>
                    </select>
                </div>

                <div class="form-field-group">
                    <label for="appBio" class="form-field-label">Operational Background &amp; Credentials *</label>
                    <textarea id="appBio" name="appBio" class="form-textarea" rows="4" placeholder="Outline your tactical assignments, firearms qualifications, defensive driving, medical certifications, or paste a link to your digital resume (Google Drive, LinkedIn)..." required></textarea>
                </div>

                <div class="form-actions">
                    <button type="submit" class="btn btn-gold btn-block" id="submitCandidateBtn">
                        Transmit Candidate Application &rarr;
                    </button>
                    <span class="form-disclaimer">
                        By submitting, you certify that all statements are accurate and consent to verification through the Texas Online Private Security (TOPS) portal.
                    </span>
                </div>
            </form>

            <div id="candidateStatus" class="candidate-status-box" aria-live="polite" hidden></div>
        </div>
    </div>
</section>
`;
