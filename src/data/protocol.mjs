/* ==========================================================================
   THE FUSED DEPLOYMENT PROTOCOL — FOUR OPERATIONAL PHASES
   Numbering is derived from array position, not stored: these are genuinely
   sequential (recon precedes post orders precedes dispatch precedes
   telemetry), so the order carries real information and reordering the array
   is the only edit needed to change the sequence.
   ========================================================================== */

export const protocolStages = [
    {
        id: 'recon',
        name: 'Advance Recon & Audit',
        badge: 'TACTICAL INTELLIGENCE BRIEF',
        heading: 'Site Reconnaissance & Threat Ingress Audit',
        body: 'Before an officer arrives, operational commanders perform physical and spatial audits of the deployment area. We assess ingress/egress chokepoints, high-value asset sightlines, crowd flow patterns, and emergency trauma evacuation corridors.',
        meta: [
            { label: 'Operational Window', value: '< 24 Hours Advance' },
            { label: 'Clearance Tier', value: 'Lead Operations Officer' },
            { label: 'Client Deliverable', value: 'PDF Risk Matrix & Post Map' },
            { label: 'Coordination', value: 'Local Law Enforcement / Venue' }
        ],
        cta: 'Request Advance Site Assessment',
        terminal: {
            file: 'RECON_DIAGNOSTIC_V4.LOG',
            lines: [
                'INITIALIZING SPATIAL INGRESS MATRIX...',
                'PERIMETER CHECKPOINTS: 6 IDENTIFIED',
                'CHOKEPOINTS DETECTED: NORTH GATE / VIP GREENROOM',
                "TRAUMA ROUTE TO ST. DAVID'S / DELL SETON: MAPPED (6.2 MIN)",
                /* A line may emphasise a trailing value; both halves are
                   escaped, so no data field ever carries raw markup. */
                { text: 'THREAT VULNERABILITY SCORE: ', strong: 'LOW-MEDIUM (STABILIZED)' }
            ],
            status: 'STATUS: ADVANCE RECON COMPLETE & ARCHIVED'
        }
    },
    {
        id: 'post-orders',
        name: 'Post Orders & ROE',
        badge: 'RULES OF ENGAGEMENT FORMULATION',
        heading: 'Custom Post Orders & De-escalation SOP',
        body: 'Every venue, executive, and construction project demands unique operational boundaries. We formulate clear Rules of Engagement (ROE), access list verification rules, badge credentialing levels, and executive motorcade protocols tailored to your brand.',
        meta: [
            { label: 'Protocol Standard', value: 'Texas Occupations Code §1702' },
            { label: 'ROE Authorization', value: 'Client Stakeholder Sign-Off' },
            { label: 'Uniform Profile', value: 'Plainclothes / Polo / Uniform' },
            { label: 'Escalation Matrix', value: 'Verbal First > Defense Last' }
        ],
        cta: 'Build Custom Rules of Engagement',
        terminal: {
            file: 'POST_ORDERS_ENCRYPTED.SOP',
            lines: [
                'ACCESS LEVEL 1: ALL-ACCESS VIP / ARTIST WRISTBAND',
                'ACCESS LEVEL 2: VENDOR & CATERING BADGE VERIFY',
                'DISCRETION DIRECTIVE: ZERO INTRUSIVE PAT-DOWNS',
                'TRESPASS DIRECTIVE: IMMEDIATE VERBAL WARNING & ESCORT'
            ],
            status: 'ROE VERIFIED BY CHIEF OF OPERATIONS'
        }
    },
    {
        id: 'dispatch',
        name: 'Commissioned Dispatch',
        badge: 'TACTICAL FORCE MULTIPLIER',
        heading: 'Commissioned Armed & PPO Dispatch',
        body: 'Texas DPS Level III Armed Security Officers and Level IV Personal Protection Officers deploy on schedule. Officers arrive 30 minutes prior to briefing for encrypted comms sync, loadout inspections, and post-order synchronization.',
        meta: [
            { label: 'Officer Credentials', value: 'Texas DPS Level III & IV PPO' },
            { label: 'Comms Channel', value: 'Encrypted Digital Tactical Radio' },
            { label: 'Backup Response', value: 'Statewide QRF on Standby' },
            { label: 'Dispatch Verification', value: 'Pre-Shift Firearms & Armor Check' }
        ],
        cta: 'Request Officer Deployment',
        terminal: {
            file: 'OFFICER_ROSTER_DEPLOYED.DAT',
            lines: [
                'OFFICER 1: C. HARRELL [BADGE #0492 - LEVEL IV PPO]',
                'OFFICER 2: M. VANCE [BADGE #0811 - LEVEL III ARMED]',
                'OFFICER 3: J. REYES [BADGE #1104 - LEVEL III ARMED]',
                'COMMS TAC-NET: CHANNEL 4 ENCRYPTED (AES-256)'
            ],
            status: 'ALL POSTS MANNED & OPERATIONAL'
        }
    },
    {
        id: 'telemetry',
        name: 'Live Telemetry & Log',
        badge: 'REAL-TIME TRANSPARENCY',
        heading: 'Live Shift Verification & Incident Logging',
        body: 'No guessing whether your guards are awake or patrolling. Clients receive timestamped digital NFC/QR checkpoint scans, GPS patrol heatmaps, and shift incident summaries directly upon shift conclusion.',
        meta: [
            { label: 'Telemetry Feed', value: 'Live Timestamped GPS Patrol Logs' },
            { label: 'Incident Reports', value: 'Digital Evidence Package in 1 Hr' },
            { label: 'Proof of Delivery', value: 'Digital Shift Sign-Off & Audit Trail' },
            { label: 'Client Access', value: 'Direct Email / Portal Delivery' }
        ],
        cta: 'Schedule Coverage With Live Telemetry',
        terminal: {
            file: 'SHIFT_TELEMETRY_LOG_TX.JSON',
            lines: [
                '22:00:00 - CHECKPOINT 1 [NORTH GATE]: VERIFIED OK',
                '22:45:12 - CHECKPOINT 2 [VIP ESCORT]: SECURE PASSAGE',
                '23:30:00 - CHECKPOINT 3 [EAST PERIMETER]: SWEEP CLEAR',
                '00:15:22 - CHECKPOINT 4 [MAIN ENTRANCE]: LOCKDOWN CONFIRMED'
            ],
            status: 'SHIFT SUMMARY: 0 SECURITY BREACHES • 100% POST COMPLIANCE'
        }
    }
];
