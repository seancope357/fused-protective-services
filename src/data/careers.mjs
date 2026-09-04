/* ==========================================================================
   CAREERS & RECRUITMENT — SINGLE SOURCE OF TRUTH
   ==========================================================================
   All job openings, compensation bands, vetting pipeline stages, and
   officer benefits live here. This feeds the careers page cards, the
   application pre-fill routing, and the schema.org JobPosting structured
   data records.
   ========================================================================== */

import { site } from './site.mjs';

export const careersSeo = {
    title: 'Careers & Protective Officer Recruiting — Fused Protective Services (Austin, TX)',
    description:
        'Join Fused Protective Services. Hiring Texas DPS Level IV Personal Protection Officers (PPO), Level III Armed Patrol Officers, and Tactical Dispatchers. Industry-leading pay ($28–$65+/hr), paid training, and veteran-first culture.',
    keywords:
        'executive protection jobs Austin, Texas PPO bodyguard hiring, armed security jobs Texas, DPS Level 4 security careers, veteran security contractor Austin, Cameron Harrell security recruiting'
};

export const careersMetrics = [
    { value: '$28 – $65+', label: 'Hourly Compensation Range' },
    { value: 'Top 5%', label: 'Applicant Acceptance Rate' },
    { value: '100%', label: 'Veteran & First Responder Friendly' },
    { value: '40-Hr / Week', label: 'Overtime & Surge Available' }
];

export const officerBenefits = [
    {
        icon: 'executive',
        title: 'Premium Pay & Surge Bonuses',
        body: 'Industry-leading hourly wages with guaranteed bi-weekly direct deposit, holiday overtime multipliers, and short-notice rapid tactical dispatch surge bonuses.'
    },
    {
        icon: 'construction',
        title: 'Paid Advanced Tactical Training',
        body: 'Ongoing company-sponsored training in Tactical Combat Casualty Care (TCCC / Stop The Bleed), executive route advance logistics, and tactical pistol/carbine manipulation.'
    },
    {
        icon: 'emergency',
        title: 'Duty Gear & Uniform Allowance',
        body: 'Stipends for approved Level IIIA concealable body armor, Safariland duty holsters, encrypted tactical radio headsets, and custom Fused branded operational apparel.'
    },
    {
        icon: 'commercial',
        title: 'Veteran & Law Enforcement Fast-Track',
        body: 'Direct rank and experience credit for honorably discharged military veterans, Texas DPS troopers, SWAT operators, and seasoned private protection officers.'
    }
];

export const vettingStages = [
    {
        step: '01',
        name: 'Application & License Audit',
        badge: 'STAGE 1: VERIFICATION',
        heading: 'TOPS License & Credential Verification',
        body: 'We review your professional resume, Texas Online Private Security (TOPS) licensing history, and professional references within 48 business hours.',
        checkpoint: 'Active Texas DPS Level II, III, or IV PPO license confirmed.'
    },
    {
        step: '02',
        name: 'Background & Psychological',
        badge: 'STAGE 2: INTEGRITY',
        heading: 'Federal Fingerprint & Psychological Exam',
        body: 'Exhaustive background investigation covering criminal records, driving history, credit check, 10-panel drug screening, and MMPI-2 psychological evaluation for armed/PPO roles.',
        checkpoint: 'Zero felony convictions, clean drug panel, passed psychological screening.'
    },
    {
        step: '03',
        name: 'Tactical & Physical Readiness',
        badge: 'STAGE 3: PROFICIENCY',
        heading: 'Live Range & Situational Evaluation',
        body: 'Live-fire firearms qualification demonstrating sidearm proficiency, rapid failure clearing, shoot/no-shoot decision making, and physical fitness demonstration.',
        checkpoint: '90%+ range score, verified defensive tactics competence.'
    },
    {
        step: '04',
        name: 'Command Staff Board Interview',
        badge: 'STAGE 4: ETHICS',
        heading: 'Executive Interview with Cameron Harrell',
        body: 'An in-person command board interview evaluating communication presence, situational de-escalation instincts, tactical composure, and alignment with Fused standards.',
        checkpoint: 'Direct sign-off from Chief of Operations Cameron Harrell.'
    },
    {
        step: '05',
        name: 'Roster Activation & Deployment',
        badge: 'STAGE 5: ACTIVE DUTY',
        heading: 'Encrypted Comms Sync & Post Orders',
        body: 'Issuance of tactical callsigns, AES-256 radio assignment, client post orders briefing, and scheduled deployment on active executive or commercial details.',
        checkpoint: 'Fully badged, deployed, and operational.'
    }
];

export const positions = [
    {
        id: 'pos-ppo',
        code: 'POS-01 // PPO',
        title: 'Level IV Personal Protection Officer (Executive PPO)',
        licenseTier: 'Texas DPS Level IV PPO',
        category: 'executive',
        location: 'Austin, TX (Statewide & Domestic Travel)',
        schedule: 'Full-Time & Dedicated Itinerary Details',
        compensation: '$45.00 – $65.00 / hr',
        badge: 'ELITE DETAIL',
        summary:
            'Discreet plainclothes close-protection officers providing armed escorts, advance route security, and secure transit for corporate executives, VIPs, and family offices.',
        requirements: [
            'Current Texas DPS Level IV Personal Protection Officer commission in good standing',
            'Passed Texas DPS-approved psychological examination (MMPI-2)',
            'Minimum 3+ years in military special operations, tactical law enforcement, or executive protection',
            'Valid U.S. Passport and clean Texas driver’s license (defensive driving certified)',
            'Impeccable executive presence, suit-and-tie presentation, and verbal de-escalation skills'
        ],
        duties: [
            'Provide low-profile concealed armed escort during business and personal itineraries',
            'Execute advance route, venue, and trauma facility reconnaissance',
            'Coordinate secure motorcade ingress, parking, and egress logistics',
            'Maintain continuous encrypted tactical radio communication with Command Desk'
        ],
        schema: {
            title: 'Level IV Personal Protection Officer (Executive PPO)',
            description:
                'Executive close protection and plainclothes armed bodyguard detail for high-net-worth clients in Austin and statewide Texas.',
            baseSalary: { minValue: 45, maxValue: 65, unit: 'HOUR' },
            employmentType: 'FULL_TIME'
        }
    },
    {
        id: 'pos-patrol',
        code: 'POS-02 // PATROL',
        title: 'Level III Commissioned Armed Patrol Officer',
        licenseTier: 'Texas DPS Level III Armed',
        category: 'armed',
        location: 'Austin Metro & Travis County, TX',
        schedule: 'Full-Time / Evening & Overnight Shifts',
        compensation: '$28.00 – $38.00 / hr',
        badge: 'MOBILE TACTICAL',
        summary:
            'High-visibility marked cruiser and static armed officers protecting commercial headquarters, technology campuses, and luxury automotive dealerships.',
        requirements: [
            'Current Texas DPS Level III Armed Security Officer commission',
            'Clean criminal record and negative 10-panel drug screen',
            'Valid Texas driver’s license with spotless driving record',
            'Proficient with standard 9mm/.40 duty sidearm and duty belt gear',
            'Prior military, corrections, or armed security patrol experience preferred'
        ],
        duties: [
            'Operate marked tactical patrol cruisers conducting scheduled & random site sweeps',
            'Scan digital NFC/GPS checkpoints at access gates, utility points, and perimeters',
            'Enforce criminal trespass warnings and liaise directly with local law enforcement',
            'Submit real-time digital incident logs upon completion of each patrol shift'
        ],
        schema: {
            title: 'Level III Commissioned Armed Patrol Officer',
            description:
                'Marked cruiser mobile patrols and armed post deterrence for commercial complexes across the Austin metro area.',
            baseSalary: { minValue: 28, maxValue: 38, unit: 'HOUR' },
            employmentType: 'FULL_TIME'
        }
    },
    {
        id: 'pos-event',
        code: 'POS-03 // EVENT',
        title: 'Tactical Event Security & Venue Specialist',
        licenseTier: 'Texas DPS Level III Armed / Level II Mixed',
        category: 'event',
        location: 'Austin, San Antonio & Hill Country, TX',
        schedule: 'Flexible / Event-Based (Galas, Summits, Weddings)',
        compensation: '$30.00 – $42.00 / hr',
        badge: 'LUXURY VENUE ACCESS',
        summary:
            'Front-facing tactical officers delivering crowd screening, VIP area isolation, and diplomatic de-escalation for luxury weddings, summits, and estate galas.',
        requirements: [
            'Current Texas DPS Level III Commissioned or Level II license',
            'Customer-facing diplomatic demeanor with commanding physical presence',
            'Superior conflict resolution and verbal de-escalation capability',
            'Current CPR / First Aid / AED certification (or ability to complete paid training)',
            'Availability for evening, weekend, and holiday luxury events'
        ],
        duties: [
            'Conduct guest access list verification and credential screening',
            'Secure VIP green rooms, stage perimeters, and backstage staging corridors',
            'Respond swiftly and calmly to medical emergencies or unauthorized entry attempts',
            'Maintain pristine tactical polo or suit-and-tie uniform presentation'
        ],
        schema: {
            title: 'Tactical Event Security & Venue Specialist',
            description:
                'Event access control, VIP perimeter defense, and customer-facing tactical security for luxury gatherings.',
            baseSalary: { minValue: 30, maxValue: 42, unit: 'HOUR' },
            employmentType: 'PART_TIME'
        }
    },
    {
        id: 'pos-concierge',
        code: 'POS-04 // CONCIERGE',
        title: 'Corporate & Estate Security Concierge',
        licenseTier: 'Texas DPS Level II Non-Commissioned',
        category: 'unarmed',
        location: 'Austin & Westlake Hills, TX',
        schedule: 'Full-Time / Day & Swing Shifts',
        compensation: '$22.00 – $28.00 / hr',
        badge: 'ESTATE & CORPORATE',
        summary:
            'Professional gatehouse and corporate lobby access specialists managing visitor credentials, phone triage, and physical access control.',
        requirements: [
            'Current Texas DPS Level II Security Officer license (or eligible to certify)',
            'High school diploma or equivalent; clean background and drug screening',
            'Strong interpersonal communication and polished professional appearance',
            'Working knowledge of electronic access control, CCTV, and gate systems',
            'Keen observation skills and reliable punctuality'
        ],
        duties: [
            'Welcome and verify identity credentials for authorized residents, guests, and vendors',
            'Monitor closed-circuit television (CCTV) cameras and perimeter intrusion sensors',
            'Maintain automated electronic visitor logs and notify client hosts',
            'Coordinate rapid alarm dispatch with Fused armed patrol units if threats arise'
        ],
        schema: {
            title: 'Corporate & Estate Security Concierge',
            description:
                'Access gatehouse management and lobby security concierge for private estates and commercial offices.',
            baseSalary: { minValue: 22, maxValue: 28, unit: 'HOUR' },
            employmentType: 'FULL_TIME'
        }
    },
    {
        id: 'pos-dispatch',
        code: 'POS-05 // DISPATCH',
        title: 'Command Desk Operations & Tactical Dispatcher',
        licenseTier: 'Command Operations Tier',
        category: 'operations',
        location: 'Austin Command Operations Center (On-Site)',
        schedule: 'Full-Time / 12-Hour Rotations (24/7/365 Desk)',
        compensation: '$26.00 – $36.00 / hr',
        badge: 'TACTICAL COMMAND',
        summary:
            'Central communications coordinator managing officer GPS telemetry, emergency call intake, rapid dispatch deployments, and client reporting.',
        requirements: [
            'Prior experience in emergency dispatch, 911 communications, or military TOC',
            'Ability to maintain absolute calm and clear articulation during high-stress incidents',
            'Proficient with computer-aided dispatch (CAD), GPS tracking, and digital radio networks',
            'Rapid typing speed (50+ WPM) and precise data entry accuracy',
            'Willingness to work flexible 12-hour shift rotations including nights and weekends'
        ],
        duties: [
            'Answer 24/7 emergency dispatch line and evaluate client operational threat levels',
            'Coordinate under 45-minute rapid deployment details for armed tactical units',
            'Monitor live officer GPS tracking, checkpoint scans, and welfare check-ins',
            'Package timestamped incident evidence logs and route them to client stakeholders'
        ],
        schema: {
            title: 'Command Desk Operations & Tactical Dispatcher',
            description:
                '24/7 active command operations, tactical officer dispatching, and GPS telemetry monitoring.',
            baseSalary: { minValue: 26, maxValue: 36, unit: 'HOUR' },
            employmentType: 'FULL_TIME'
        }
    }
];

export const prequalQuestions = [
    {
        id: 'age',
        label: 'Are you at least 21 years of age?',
        helper: 'Mandatory under Texas Occupations Code for armed security officers.'
    },
    {
        id: 'license',
        label: 'Do you hold an active Texas DPS Private Security license?',
        helper: 'Level II (Unarmed), Level III (Armed), or Level IV (PPO).'
    },
    {
        id: 'background',
        label: 'Can you pass an exhaustive background and 10-panel drug screen?',
        helper: 'Disqualifies any prior felony convictions or active warrants.'
    }
];
