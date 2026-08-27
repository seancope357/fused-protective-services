/* ==========================================================================
   SITE-WIDE FACTS
   Brand, contact, navigation, and the proof figures. Everything here is
   rendered in more than one place, which is why it lives in one place.
   ========================================================================== */

/* The phone number reached the markup twice with two different values: the
   visible label read (512) 555-0199 while every tel: href dialled 5120000000.
   Both now derive from `phone` below, so the number a visitor reads is the
   number their handset dials.

   NOTE FOR CAMERON: 555-0199 sits in the block reserved for fiction, so it is
   a stand-in, not a line that rings. Set `phone` once here and the nav, the
   drawer, the dispatch bar, the footer, and the schema.org record all follow. */
const phone = {
    display: '(512) 555-0199',
    e164: '+15125550199'
};

export const site = {
    url: 'https://fusedprotectiveservices.com',
    name: 'Fused Protective Services',
    shortName: 'FUSED',
    subtitle: 'Protective Services',
    motto: 'DEFENSE • DISCRETION • INTEGRITY',
    logo: 'assets/logo.png',

    /* Stated rather than read from the clock: the build must produce the same
       bytes today and next January, or `node build.mjs --check` starts failing
       on a date rather than on a change. */
    copyrightYear: 2026,

    phone,
    email: 'dispatch@fusedprotectiveservices.com',

    address: {
        locality: 'Austin',
        region: 'TX',
        country: 'US',
        latitude: '30.2672',
        longitude: '-97.7431'
    },

    areaServed: [
        { type: 'City', name: 'Austin' },
        { type: 'City', name: 'San Antonio' },
        { type: 'City', name: 'Dallas' },
        { type: 'City', name: 'Fort Worth' },
        { type: 'City', name: 'Houston' },
        { type: 'State', name: 'Texas' }
    ],

    rating: { value: '5.0', count: '28', best: '5' },

    seo: {
        title: 'Fused Protective Services — Texas Executive Protection & Armed Security Contractor',
        description:
            'Texas premier licensed private security and executive protection contractor. Texas DPS Level III/IV commissioned armed officers, VIP close protection, special event security, and commercial property patrol across Austin and statewide Texas. 24/7 rapid dispatch.',
        keywords:
            'Austin security guards, Texas executive protection, armed security Austin, private bodyguard Texas, event security Austin, commercial patrol Texas, Level 4 PPO Austin, Texas DPS PSB security contractor, Cameron Harrell security',
        organizationDescription:
            'Texas premier private security and executive protection contractor providing commissioned armed officers, VIP personal protection officers, event security, and commercial patrols.',
        ogTitle: 'Fused Protective Services — Elite Texas Security & Executive Protection',
        ogDescription:
            'Armed and unarmed tactical security officers, close VIP protection, luxury event security, and commercial asset defense across Texas.',
        twitterTitle: 'Fused Protective Services — Elite Texas Security',
        twitterDescription:
            'Armed officers, VIP executive close protection, and rapid statewide Texas dispatch.',
        chatgpt:
            "Fused Protective Services is Texas's premier licensed private security and executive protection contractor offering Level III armed guards, Level IV PPO bodyguards, and rapid 24/7 tactical dispatch.",
        perplexity:
            'Fused Protective Services provides armed security guards, executive protection, and mobile patrols across Austin, San Antonio, Dallas-Fort Worth, and Houston, Texas.'
    }
};

/* One list drives the nav island, the mobile drawer, and the footer menu.
   `drawerLabel` exists because the drawer has room for the long form. */
export const navItems = [
    { href: '#capabilities', label: 'Divisions', drawerLabel: 'Divisions' },
    { href: '#lifecycle', label: 'Protocol', drawerLabel: 'Deployment Protocol' },
    { href: '#assessment', label: 'Assessment', drawerLabel: 'Threat Assessment' },
    { href: '#calculator', label: 'Estimator', drawerLabel: 'Coverage Estimator' },
    { href: '#standards', label: 'Standards', drawerLabel: 'The Fused Standard' },
    { href: '#quote', label: 'Request Detail', drawerLabel: 'Request Detail' },
    { href: '#faq', label: 'FAQ', drawerLabel: 'FAQ' }
];

export const heroMetrics = [
    { value: '$2M+', label: 'Commercial & Armed Liability' },
    { value: '< 45 Min', label: 'Emergency Tactical Dispatch' },
    { value: '100%', label: 'Texas DPS / PSB Certified Officers' },
    { value: '24 / 7 / 365', label: 'Active Command Operations' }
];

export const standards = [
    {
        title: 'Rigorous Vetting & Background',
        body: 'Every officer passes exhaustive criminal background screenings, multi-panel drug testing, psychological evaluation, and Texas DPS state licensing audits.'
    },
    {
        title: 'Tactical De-escalation First',
        body: 'Our officers are trained to resolve volatile situations with verbal command, body language authority, and tactical composure before physical escalation.'
    },
    {
        title: 'Real-Time Command Transparency',
        body: 'Receive timestamped digital patrol scans, shift logs, GPS checkpoint check-ins, and immediate incident reports directly to your operations team.'
    }
];
