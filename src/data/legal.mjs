/* ==========================================================================
   LEGAL PAGES — PRIVACY, TERMS, SMS CONSENT
   ==========================================================================
   Rendered by src/templates/legal/page.mjs into privacy.html, terms.html and
   sms-consent.html so they share the site's shell, tokens and footer.

   TODO(cameron): every page below is DRAFT TEXT awaiting attorney review. It
   is marked as such on the page itself (`reviewed: false` renders a visible
   banner). Set `reviewed: true` and `reviewedOn` only once counsel has signed
   off; do not treat anything here as legal advice.
   ========================================================================== */

import { site } from './site.mjs';

const effective = '2026-09-10';

export const legalPages = [
    {
        slug: 'privacy',
        file: 'privacy.html',
        title: 'Privacy Policy',
        eyebrow: 'Legal',
        description: `How ${site.name} collects, uses and protects the information you share with us.`,
        reviewed: false,
        reviewedOn: null,
        effective,
        sections: [
            {
                heading: 'What we collect',
                body: [
                    `When you request a quote, apply for a position, or use the client portal, we collect the details you provide: name, company, phone number, email address, the location and schedule of the detail you need, and any notes you add.`,
                    `When you pay an invoice online, payment details are collected and processed by Stripe. ${site.name} never sees or stores your full card or bank account number.`,
                    `Our website records standard technical information (IP address, browser type, pages visited) for security and abuse prevention.`
                ]
            },
            {
                heading: 'How we use it',
                body: [
                    'To respond to your request, prepare proposals, schedule and staff details, send briefs and reminders, invoice you, and collect payment.',
                    'To send transactional email and, only with your consent, text messages about your details and invoices. We do not send marketing messages.',
                    'To meet our obligations under Texas Occupations Code Chapter 1702 and to keep records required by the Texas Department of Public Safety.'
                ]
            },
            {
                heading: 'Who we share it with',
                body: [
                    'Service providers that operate the platform on our behalf: Supabase (database and authentication), Vercel (hosting), Resend (email), Twilio (text messages) and Stripe (payments). Each processes your information only to provide its service to us.',
                    'Law enforcement or regulators when required by law or to protect the safety of people on a detail.',
                    'We do not sell personal information.'
                ]
            },
            {
                heading: 'Your choices',
                body: [
                    'You may opt out of text messages at any time by replying STOP.',
                    `You may ask us to correct or delete your information by emailing ${site.email}. Records we are required to keep by law are retained for the period the law requires.`
                ]
            },
            {
                heading: 'Security and retention',
                body: [
                    'Data is stored in the United States with encryption in transit and at rest. Access is limited to authorised staff and, for client portal accounts, to the client the record belongs to.',
                    'Lead and application records are retained while they are relevant to an engagement or hiring decision and then for the period required by law.'
                ]
            },
            {
                heading: 'Contact',
                body: [`Questions about this policy: ${site.email} · ${site.phone.display}.`]
            }
        ]
    },
    {
        slug: 'terms',
        file: 'terms.html',
        title: 'Terms of Service',
        eyebrow: 'Legal',
        description: `The terms on which ${site.name} provides security services and the client portal.`,
        reviewed: false,
        reviewedOn: null,
        effective,
        sections: [
            {
                heading: 'Services',
                body: [
                    `${site.name} provides licensed private security services in Texas under Texas Occupations Code Chapter 1702. The scope, officer levels, dates, rates and any exclusions for a given engagement are set out in the written proposal you accept through the client portal or in writing.`,
                    'A proposal accepted electronically in the client portal (typed name, timestamp and network address recorded) is a binding agreement under the Texas Uniform Electronic Transactions Act.'
                ]
            },
            {
                heading: 'Rates, invoicing and payment',
                body: [
                    'Rates are as stated in the accepted proposal. Hours are billed as scheduled; extensions requested on site are billed at the contracted rate. Applicable Texas sales tax is added unless a valid exemption certificate is on file.',
                    'Invoices are due by the date stated on the invoice. Past-due balances accrue interest at 1.5% per month or the maximum rate permitted by Texas law, whichever is lower.',
                    'Where a deposit is stated in the proposal, it is due on acceptance and is applied to the final invoice.'
                ]
            },
            {
                heading: 'Cancellation',
                body: [
                    'TODO(cameron): state the cancellation window and any fee (for example, details cancelled with less than 24 hours notice are billed at a minimum of four hours per scheduled officer).'
                ]
            },
            {
                heading: 'Client responsibilities',
                body: [
                    'Provide accurate site information, access, and an on-site contact; disclose known threats or hazards; and comply with post orders agreed for the detail.'
                ]
            },
            {
                heading: 'Insurance and liability',
                body: [
                    `${site.name} maintains commercial general liability insurance, armed liability coverage and workers' compensation as required by Texas law. Certificates of insurance are issued on request after contract execution.`,
                    'TODO(cameron): limitation of liability and indemnity language for attorney review.'
                ]
            },
            {
                heading: 'Governing law',
                body: ['These terms are governed by the laws of the State of Texas. Venue for any dispute is Travis County, Texas.']
            },
            {
                heading: 'Contact',
                body: [`${site.email} · ${site.phone.display}`]
            }
        ]
    },
    {
        slug: 'sms-consent',
        file: 'sms-consent.html',
        title: 'SMS Program Terms',
        eyebrow: 'Text messaging',
        description: `What you agree to when you consent to text messages from ${site.name}.`,
        reviewed: false,
        reviewedOn: null,
        effective,
        sections: [
            {
                heading: 'Program description',
                body: [
                    `By ticking the SMS consent box on our quote form, or by agreeing with a member of our team, you consent to receive text messages from ${site.name} about your security details and invoices: confirmations, day-before reminders, and payment notices.`,
                    'Consent is not a condition of purchase. Message frequency varies with your engagement; typically one to three messages around each scheduled detail.'
                ]
            },
            {
                heading: 'Opting out',
                body: ['Reply STOP at any time to stop receiving messages. Reply START to resume. Reply HELP for help, or call ' + site.phone.display + '.']
            },
            {
                heading: 'Costs and carriers',
                body: ['Message and data rates may apply. Carriers are not liable for delayed or undelivered messages.']
            },
            {
                heading: 'Privacy',
                body: ['Your phone number is used only for the messages described here and is handled under our Privacy Policy. We do not share mobile numbers with third parties for their marketing.']
            }
        ]
    }
];

/** Short consent language shown beside the checkbox on the intake forms. */
export const smsConsentLabel =
    `I agree to receive text messages from ${site.name} about my request, my details and invoices at the number provided. Message and data rates may apply. Reply STOP to opt out. See the SMS Program Terms and Privacy Policy.`;
