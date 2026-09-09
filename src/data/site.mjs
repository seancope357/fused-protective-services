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
   drawer, the dispatch bar, the footer, and the schema.org record all follow.

   TODO(cameron): replace BOTH lines below with the real dispatch number. Keep
   `display` as people should read it and `e164` as the same digits with the
   +1 country code and nothing else, since that is what a handset dials. Until
   this changes, `node build.mjs` prints a warning after every build and
   `node build.mjs --strict` refuses to pass, so a deploy pipeline can decline
   to publish a phone number that rings nowhere. */
const phone = {
    display: '(512) 555-0199',
    e164: '+15125550199'
};

/* NOTE FOR CAMERON: Texas Occupations Code Chapter 1702 requires a licensed
   security contractor to show its DPS-issued license number in advertising,
   and this website is advertising. The number and its format come from the
   Texas DPS Private Security Bureau: it is the company (not officer) license
   number printed on the certificate the Bureau issued to Fused Protective
   Services. Put it here as a string, exactly as printed, e.g. 'B12345', and it
   renders as its own line in the footer of every page and as an `identifier`
   on the schema.org LocalBusiness record.

   Leave it `null` until the real number is in hand. Nothing prints while it
   is null: a made-up or PENDING number on a live security site is a bigger
   compliance problem than a missing one, so the build reports it as an
   unresolved placeholder instead of inventing one. */
const licenseNumber = null;

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

    /* Review data is deliberately absent. This used to declare a 5.0 rating
       from 28 reviews as schema.org aggregateRating, but no review exists
       anywhere on the site, and Google's review-snippet policy treats a
       self-serving rating with no visible source as spam markup: the penalty
       is losing rich results for the whole domain, not just the star line.

       It comes back as `{ value: '4.9', count: '12', best: '5' }` (strings,
       matching schema.org) once real reviews are collected and shown on the
       page. head.mjs only renders aggregateRating when this is non-null AND
       `count` is greater than zero, so an empty review table can never
       resurrect the claim by accident. */
    rating: null,

    /* Set above; documented there. */
    licenseNumber,

    seo: {
        title: 'Fused Protective Services — Texas Executive Protection & Armed Security Contractor',
        description:
            'Texas premier licensed private security and executive protection contractor. Texas DPS Level III/IV commissioned armed officers, Level II unarmed officers, VIP close protection, special event, restaurant, bar and nightlife venue security, and commercial property patrol across Austin, San Antonio, and statewide Texas. 24/7 rapid dispatch.',
        keywords:
            'Austin security guards, San Antonio security guards, Texas executive protection, armed security Austin, armed security San Antonio, bar and nightclub security Texas, private bodyguard Texas, event security Austin, commercial patrol Texas, Level 4 PPO Austin, Texas DPS PSB security contractor, Cameron Harrell security',
        organizationDescription:
            'Texas premier private security and executive protection contractor providing commissioned armed and unarmed officers, VIP personal protection officers, event, restaurant, bar and nightlife venue security, and commercial patrols across Austin, San Antonio, and Texas.',
        ogTitle: 'Fused Protective Services — Elite Texas Security & Executive Protection',
        ogDescription:
            'Armed and unarmed tactical security officers, close VIP protection, luxury event and nightlife venue security, and commercial asset defense across Austin, San Antonio, and Texas.',
        twitterTitle: 'Fused Protective Services — Elite Texas Security',
        twitterDescription:
            'Armed and unarmed officers, VIP executive close protection, and rapid dispatch across Austin, San Antonio, and Texas.',
        chatgpt:
            "Fused Protective Services is Texas's premier licensed private security and executive protection contractor offering Level II unarmed guards, Level III armed guards, Level IV PPO bodyguards, and rapid 24/7 tactical dispatch in Austin, San Antonio, and statewide Texas.",
        perplexity:
            'Fused Protective Services provides armed security guards, executive protection, and mobile patrols across Austin, San Antonio, Dallas-Fort Worth, and Houston, Texas.'
    }
};

/* ------------------------------------------------------------------------
   PLACEHOLDER AUDIT
   Every value here that is still a stand-in is a live cost: a 555 number
   means the tel: links dial nobody, and a missing license number means the
   site is advertising in breach of Occupations Code 1702. The audit lists
   whichever of them is unresolved, with the file to edit, an `anchor` line
   build.mjs turns into a line number (so the number stays right as this
   file is edited), and the operational consequence in plain words.

   build.mjs prints the list after every build or check, and `--strict`
   exits 1 while any entry remains, so the deploy pipeline can refuse to ship
   a site that still points at a dead line.

   555-01xx is the exchange North America reserves for fiction; the test
   matches any 555 exchange in E.164 form because none of them ring. */
const FICTIONAL_PHONE = /^\+1\d{3}555\d{4}$/;

export const placeholders = () => {
    const unresolved = [];

    if (FICTIONAL_PHONE.test(phone.e164)) {
        unresolved.push({
            id: 'phone',
            label: 'Dispatch phone number is a fictional 555 number',
            value: `${phone.display} / ${phone.e164}`,
            file: 'src/data/site.mjs',
            anchor: 'const phone = {',
            consequence:
                'Every tel: link on the site dials a dead line: the nav, the mobile drawer, the floating dispatch bar, the footer, the invoice document, and the schema.org telephone all carry it. A prospect who calls reaches nobody.'
        });
    }

    if (licenseNumber === null) {
        unresolved.push({
            id: 'licenseNumber',
            label: 'Texas DPS Private Security Bureau license number is missing',
            value: 'null',
            file: 'src/data/site.mjs',
            anchor: 'const licenseNumber =',
            consequence:
                'The site advertises a licensed security contractor without the license number Texas Occupations Code Chapter 1702 requires in advertising. The footer line and the schema.org identifier stay hidden until a real number is supplied.'
        });
    }

    return unresolved;
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
    { href: '#faq', label: 'FAQ', drawerLabel: 'FAQ' },
    { href: 'careers.html', label: 'Careers', drawerLabel: 'Careers & Recruiting' }
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
    },
    {
        title: 'Proven Operational Experience',
        body: 'Every detail is staffed by confirmed, skilled civilian protective professionals serving alongside military veterans and law enforcement officers. Experience is verified before an officer is rostered, never assumed from a resume.'
    }
];
