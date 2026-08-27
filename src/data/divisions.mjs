/* ==========================================================================
   TACTICAL DIVISIONS — SINGLE SOURCE OF TRUTH
   ==========================================================================
   Before this file existed, the six divisions were hand-maintained in five
   separate places: the bookshelf spines, the quote form <select>, the
   schema.org OfferCatalog, the assessment mapping, and the estimator mapping.
   They had already drifted — the catalog carried four entries where the site
   offers six, so two services were invisible to search and AI crawlers.

   Everything about a division now lives in one entry here and is rendered
   into every one of those places by the generator. Adding a seventh division
   is a single object; deleting one removes it everywhere at once.

   `quoteValue` is the contract between the spine's deploy button, the form
   <select> option, and the assessment/estimator pre-fill. It is the division's
   identity as far as the intake flow is concerned, so it must stay stable —
   changing it changes what the operations team receives.
   ========================================================================== */

export const divisions = [
    {
        id: 'div-01',
        code: 'DIV-01 // PPO',
        icon: 'executive',
        spineTitle: 'EXECUTIVE & VIP PROTECTION',
        badge: 'LEVEL IV PPO CERTIFIED',
        heading: 'Executive Close Protection',
        description:
            'Discreet personal protection officers (PPO) providing low-profile armed escorts, advance route security, and secure transit for corporate executives, talent, family offices, and high-threat itineraries.',
        checklist: [
            'Plainclothes Concealed Armed Escorts',
            'Advance Route & Venue Reconnaissance',
            'Threat Vulnerability Assessment & Paparazzi Shielding',
            'Secure Motorcade Transit Logistics'
        ],
        quoteValue: 'Executive & VIP Close Protection (Level IV PPO)',
        schema: {
            name: 'Executive & VIP Close Protection (Level IV PPO)',
            description:
                'Plainclothes concealed armed escort and advance security details for high-profile individuals and executives.'
        }
    },
    {
        id: 'div-02',
        code: 'DIV-02 // GUEST',
        icon: 'event',
        spineTitle: 'SPECIAL EVENT & VENUE',
        badge: 'LUXURY VENUE ACCESS',
        heading: 'Special Event & Venue Security',
        description:
            'Comprehensive crowd management, guest list screening, VIP area isolation, and diplomatic de-escalation for luxury weddings, galas, corporate summits, concerts, and estate parties.',
        checklist: [
            'Strict Guest List Access Control & ID Verification',
            'Polished Customer-Facing Tactical De-escalation',
            'VIP Green Room & Stage Perimeter Lockdown',
            'Emergency First Response & Medical Evacuation'
        ],
        quoteValue: 'Special Event & Venue Security',
        schema: {
            name: 'Special Event & Luxury Venue Security',
            description:
                'Guest access control, VIP area isolation, and de-escalation for weddings, galas, and corporate summits.'
        }
    },
    {
        id: 'div-03',
        code: 'DIV-03 // PATROL',
        icon: 'commercial',
        spineTitle: 'COMMERCIAL PROPERTY',
        badge: 'GPS CHECKPOINT VERIFIED',
        heading: 'Commercial Property & Asset Patrol',
        description:
            'Marked mobile cruiser patrols and dedicated static guard posts deterring vandalism, trespassing, and liability risks across office complexes, retail centers, and automotive dealerships.',
        checklist: [
            'High-Visibility Marked Patrol Cruisers',
            'Timestamped GPS Checkpoint Scans',
            'After-Hours Lockup & Perimeter Sweep',
            'Trespass Warning Enforcement & Police Liaison'
        ],
        quoteValue: 'Commercial & Property Patrol',
        schema: {
            name: 'Commercial & Property Asset Patrol',
            description:
                'Marked mobile patrols and static armed guard posts for office complexes, retail centers, and business parks.'
        }
    },
    {
        id: 'div-04',
        code: 'DIV-04 // ASSET',
        icon: 'construction',
        spineTitle: 'CONSTRUCTION DEFENSE',
        badge: 'LOSS PREVENTION SQUAD',
        heading: 'Construction Site Defense',
        description:
            'Heavy machinery defense, copper/material loss prevention, and strict sub-contractor gate management for active commercial and residential building developments.',
        checklist: [
            '24/7 Gate Access Log Management',
            'Thermal Night Patrol & Perimeter Defense',
            'Heavy Tool & Copper Theft Deterrence',
            'Direct Coordination with Local Law Enforcement'
        ],
        quoteValue: 'Construction Site Security',
        schema: {
            name: 'Construction Site Security & Asset Defense',
            description:
                'Gate access control, thermal night patrol, and equipment loss prevention for active development sites.'
        }
    },
    {
        id: 'div-05',
        code: 'DIV-05 // RANCH',
        icon: 'estate',
        spineTitle: 'ESTATE & RANCH SECURITY',
        badge: 'ESTATE BOUNDARY DEFENSE',
        heading: 'Private Estate & Ranch Defense',
        description:
            'Dedicated access gate monitoring, roving perimeter officers, and immediate alarm dispatch protecting high-value private residences and expansive Texas Hill Country ranch properties.',
        checklist: [
            'Gatehouse & Entryway Access Management',
            'Large Acreage ATV / Mobile Roving Patrol Details',
            'Dedicated Rapid Alarm Response Units',
            'Strict Privacy & Anti-Paparazzi Shielding'
        ],
        quoteValue: 'Private Estate & Ranch Defense',
        schema: {
            name: 'Private Estate & Ranch Defense',
            description:
                'Gatehouse access management, roving acreage patrols, and rapid alarm response for private residences and ranch properties.'
        }
    },
    {
        id: 'div-06',
        code: 'DIV-06 // RAPID',
        icon: 'emergency',
        spineTitle: 'EMERGENCY TACTICAL',
        badge: 'UNDER 45-MIN DISPATCH',
        badgeTone: 'urgent',
        heading: 'Emergency Tactical Dispatch',
        description:
            'Immediate short-term deployment of commissioned armed officers for urgent workplace violence threats, high-risk employee terminations, or sudden property vulnerabilities.',
        checklist: [
            'Under 45-Minute Rapid Urban Dispatch',
            'High-Threat Armed Deterrence Units',
            'Workplace Termination Standing Detail',
            'Short-Term Physical Asset Lockdowns'
        ],
        quoteValue: 'Emergency Tactical Dispatch',
        schema: {
            name: 'Emergency Tactical Dispatch',
            description:
                'Rapid under 45-minute on-demand armed officer deployment for high-risk threats and property vulnerabilities.'
        }
    }
];

/** Ordinal label for a division, derived from position rather than stored. */
export const divisionNumber = (index) => String(index + 1).padStart(2, '0');
