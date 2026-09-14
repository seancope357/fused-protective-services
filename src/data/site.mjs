/* ==========================================================================
   SITE-WIDE FACTS
   Brand, contact, navigation, and the proof figures. Everything here is
   rendered in more than one place, which is why it lives in one place.
   ========================================================================== */

/* The phone number reached the markup twice with two different values: the
   visible label read (512) 555-0199 while every tel: href dialled 5120000000.
   Both now derive from `phone` below, so the number a visitor reads is the
   number their handset dials.

   Confirmed as the dispatch line by Sean on 2026-09-09. If it ever changes,
   edit `display` and `e164` here; nothing else needs to move. Setting
   `placeholder` back to true re-enables the build warning, the red flag on
   every host (see src/templates/partials.mjs), and a failing
   `node build.mjs --verify-release`. */
const phone = {
    display: '(512) 555-0199',
    e164: '+15125550199',
    placeholder: false
};

/* TODO(cameron): 37 Tex. Admin. Code §35.9 requires a licensed security company
   to show its DPS license number — and its address as it appears in DPS records,
   unless that is a residential address — in any advertisement, which includes
   this website. Replace `value` with the company licence number (format B12345 or
   C12345) and set `placeholder` to false. Until then the footer and the
   schema.org record carry a labelled placeholder. */
const licenseNumber = {
    label: 'Texas DPS Private Security Licence',
    value: 'B00000',
    placeholder: true
};

export const site = {
    url: 'https://fusedprotectiveservices.com',
    name: 'Fused Protective Services',
    shortName: 'FUSED',
    subtitle: 'Protective Services',
    motto: 'DEFENSE • DISCRETION • INTEGRITY',

    /* The brand plate every page paints — nav, hero, footer, invoice — and the
       texture js/logo-forge.js maps onto its 65,536 cubes. One file for both
       jobs, so a first view fetches it once.

       WebP rather than PNG, and at full 1000x1000 rather than downscaled: the
       forge's sharpness is a property of this file (the cube grid is a fixed
       256 rows whatever the source), and measurement on a real browser put a
       512 downscale 22% down on acutance while q95 WebP at full size is 95%
       and a fifth of the bytes. See scripts/build-assets.sh.

       There is no <picture> fallback because this site cannot render in a
       browser that would need one: css/site.css is built around @layer, which
       shipped a year and a half AFTER WebP was universal. A browser that
       cannot decode this file cannot lay out the page it sits on. */
    logo: 'assets/logo.webp',

    /* The same plate as PNG at the largest size anything paints it. Nothing on
       the marketing site links it; app/scripts/sync-shared.mjs mirrors it into
       the portal, which serves its logo from its own origin. */
    logoFallback: 'assets/logo-512.png',

    /* Cropped to the shield alone — at 32px the FUSED wordmark under it is
       noise. Generated and committed by scripts/build-assets.sh; build.mjs
       asserts each one exists, because a renamed icon is otherwise a broken
       image nobody notices. */
    icons: {
        favicon: 'assets/icon-32.png',
        appleTouch: 'assets/icon-180.png',
        large: 'assets/icon-512.png'
    },

    /* The social card. Width and height are stated because Twitter and
       Facebook both lay the card out before they have fetched the image, and
       `alt` because a shared link is read aloud as often as it is looked at. */
    ogCard: {
        path: 'assets/og-card.png',
        width: 1200,
        height: 630,
        alt: 'Fused Protective Services — the gold shield emblem beside the FUSED wordmark on a carbon field, over the line "Armed and unarmed officers, VIP executive close protection, and rapid dispatch across Austin, San Antonio, and Texas."'
    },

    /* Stated rather than read from the clock: the build must produce the same
       bytes today and next January, or `node build.mjs --check` starts failing
       on a date rather than on a change. */
    copyrightYear: 2026,

    phone,
    licenseNumber,
    email: 'dispatch@fusedprotectiveservices.com',

    /* Hosts that serve the real site: the apex and www, nothing else.

       This list no longer has anything to do with placeholder flags — those
       are fail-closed and show on every host (SPEC-001). Its one live reader
       is api/_lib/http.mjs, which builds the CORS origin allowlist from it.
       src/templates/page.mjs still copies it into the page's config JSON, but
       nothing on the client reads it now that js/modules/env.mjs is gone; that
       emission is dead weight and can be dropped with its own change.

       `fused-protective-services.vercel.app` used to be listed here and was
       removed: a deploy alias is not the production site, and treating it as
       one is what let a placeholder licence number render unflagged on the
       public URL. Vercel's own hostnames are still allowed for CORS at
       runtime through the VERCEL_* environment variables. */
    productionHosts: [
        'fusedprotectiveservices.com',
        'www.fusedprotectiveservices.com'
    ],

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

/* One list drives the nav island, the mobile drawer, and the footer menu.
   `drawerLabel` exists because the drawer has room for the long form. */
export const navItems = [
    { href: '#capabilities', label: 'Divisions', drawerLabel: 'Divisions' },
    { href: '#lifecycle', label: 'How It Works', drawerLabel: 'How It Works' },
    { href: '#assessment', label: 'Assessment', drawerLabel: 'Threat Assessment' },
    { href: '#calculator', label: 'Estimator', drawerLabel: 'Coverage Estimator' },
    { href: '#standards', label: 'Standards', drawerLabel: 'The Fused Standard' },
    { href: '#quote', label: 'Request Detail', drawerLabel: 'Request Detail' },
    { href: '#faq', label: 'FAQ', drawerLabel: 'FAQ' },
    { href: 'careers.html', label: 'Careers', drawerLabel: 'Careers & Recruiting' }
];

/* The authenticated operations platform lives on its own host. Clients reach
   their proposals, briefs and invoices there; staff run the business there. */
export const portalUrl = 'https://app.fusedprotectiveservices.com';

/* Footer-only links: generated legal pages from src/data/legal.mjs. */
export const legalLinks = [
    { href: 'privacy', label: 'Privacy' },
    { href: 'terms', label: 'Terms' },
    { href: 'sms-consent', label: 'SMS Terms' }
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
