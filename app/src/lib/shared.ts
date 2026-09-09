/* ==========================================================================
   SHARED BUSINESS FACTS
   The only bridge between the portal and the static site's data layer. Every
   rate, division, term and contact detail is imported from ../src/data — the
   same modules build.mjs renders the marketing site from — so the portal can
   never quote a rate the site does not advertise. Nothing here restates a
   fact; it only adds types and lookups.
   ========================================================================== */

import { divisions as rawDivisions } from '../../shared/src/data/divisions.mjs';
import { tiers as rawTiers, defaultTier as rawDefaultTier } from '../../shared/src/data/estimator.mjs';
import { armedPreferences } from '../../shared/src/data/intake.mjs';
import { numbering, netTerms as rawNetTerms, defaultNetTerm as rawDefaultNetTerm, tax, defaultNotes, defaultTerms, paymentCopy } from '../../shared/src/data/invoice.mjs';
import { site as rawSite } from '../../shared/src/data/site.mjs';

export type Division = {
    id: string;
    code: string;
    heading: string;
    quoteValue: string;
    description: string;
};

export type Tier = {
    id: 'level-2' | 'level-3' | 'level-4';
    label: string;
    sublabel: string;
    name: string;
    rate: number;
    armed: string;
    division: string | null;
};

export type NetTerm = { id: string; label: string; days: number };

export const divisions: Division[] = rawDivisions as Division[];
export const tiers: Tier[] = rawTiers as Tier[];
export const defaultTier: Tier = rawDefaultTier as Tier;
export const netTerms: NetTerm[] = rawNetTerms as NetTerm[];
export const defaultNetTerm: NetTerm = rawDefaultNetTerm as NetTerm;
export const invoiceNumbering = numbering as { prefix: string; pad: number };
export const taxDefaults = tax as { label: string; defaultRatePct: number };
export const invoiceDefaults = { notes: defaultNotes as string, terms: defaultTerms as string, paymentCopy: paymentCopy as { heading: string; instructions: string } };
export { armedPreferences };

export const site = rawSite as {
    url: string;
    name: string;
    shortName: string;
    motto: string;
    logo: string;
    phone: { display: string; e164: string; placeholder: boolean };
    licenseNumber: { label: string; value: string; placeholder: boolean };
    email: string;
    address: { locality: string; region: string; country: string };
    productionHosts: string[];
};

export const divisionByQuoteValue = (value: string | null | undefined): Division | undefined =>
    divisions.find((d) => d.quoteValue === value);

export const tierById = (id: string | null | undefined): Tier | undefined => tiers.find((t) => t.id === id);

/** Armed level labels as the portal shows them; `mixed` has no tier rate. */
export const armedLevels: { id: 'level-2' | 'level-3' | 'level-4' | 'mixed'; label: string; rateCents: number | null }[] = [
    ...tiers.map((t) => ({ id: t.id, label: `${t.label} — ${t.sublabel}`, rateCents: Math.round(t.rate * 100) })),
    { id: 'mixed', label: 'Mixed detail (armed + concierge)', rateCents: null }
];

export const netTermById = (id: string | null | undefined): NetTerm => netTerms.find((t) => t.id === id) ?? defaultNetTerm;

/** The brand plate, served by this app (mirrored from assets/logo.png by scripts/sync-shared.mjs). */
export const logoSrc = '/logo.png';

/** Absolute URL of this app, for links in email and SMS. */
export const appUrl = (): string => (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')).replace(/\/$/, '');
