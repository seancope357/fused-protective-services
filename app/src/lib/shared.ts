/* ==========================================================================
   SHARED BUSINESS FACTS
   The only bridge between the portal and the static site's data layer. Every
   rate, division, term and contact detail is imported from ../src/data — the
   same modules build.mjs renders the marketing site from — so the portal can
   never quote a rate the site does not advertise. Nothing here restates a
   fact; it only adds types and lookups.
   ========================================================================== */

import { vettingStages as rawVettingStages, positions as rawPositions } from '../../shared/src/data/careers.mjs';
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

/* ==========================================================================
   THE CANDIDATE PIPELINE (SPEC-010)

   One vocabulary, described in three places that must never drift:

     1. `src/data/careers.mjs` → `vettingStages`, which the public careers page
        renders and which now carries the machine `id` of each published stage;
     2. the CHECK on `public.candidate_applications.vetting_stage`;
     3. `vettingStageOrder` below, which gives the ids a TypeScript type and a
        forward order the database cannot express.

   `app/tests/candidates.test.ts` pins all three against each other — it parses
   the CHECK out of the migration rather than trusting a copy — so a stage added
   to one and not the others fails the suite.

   Every *label* comes from careers.mjs. The two ids below with no careers.mjs
   entry are not stages a candidate is evaluated in: `application_received` is
   the state a row arrives in, `rejected` is the exit from any stage. Neither is
   published, so neither has site copy, and their display names are derived
   mechanically from the id itself rather than invented here.
   ========================================================================== */

/** Forward order. A candidate moves one step along this list at a time. */
export const vettingStageOrder = [
    'application_received',
    'tops_audit',
    'background_mmpi2',
    'range_physical',
    'command_interview',
    'active_roster'
] as const;

/** The exit, reachable from any stage and outside the forward order. */
export const REJECTED_STAGE = 'rejected';

export type VettingStage = (typeof vettingStageOrder)[number] | typeof REJECTED_STAGE;

export type VettingStageView = {
    id: VettingStage;
    /** Short name for badges, selects and table cells. */
    label: string;
    /** The site's own heading and copy, where the stage is published. */
    heading: string;
    body: string | null;
    checkpoint: string | null;
    /** '01'…'05' for the five published stages; null for the two endpoints. */
    step: string | null;
    /** False for the two ids the careers page deliberately does not publish. */
    published: boolean;
};

/** "application_received" → "Application received". Derived, never authored. */
const labelFromId = (id: string): string => {
    const words = id.replace(/_/g, ' ');
    return words.charAt(0).toUpperCase() + words.slice(1);
};

const publishedStages = new Map(
    (rawVettingStages as { id: string; step: string; name: string; heading: string; body: string; checkpoint: string }[]).map((s) => [s.id, s])
);

/** Every id in the vocabulary, in display order: the six forward states, then the exit. */
export const vettingStageIds: readonly VettingStage[] = [...vettingStageOrder, REJECTED_STAGE];

/** The whole pipeline in display order, labelled from src/data/careers.mjs. */
export const vettingPipeline: VettingStageView[] = vettingStageIds.map((id) => {
    const published = publishedStages.get(id);
    return published
        ? { id, label: published.name, heading: published.heading, body: published.body, checkpoint: published.checkpoint, step: published.step, published: true }
        : { id, label: labelFromId(id), heading: labelFromId(id), body: null, checkpoint: null, step: null, published: false };
});

export const vettingStageById = (id: string | null | undefined): VettingStageView | undefined =>
    vettingPipeline.find((s) => s.id === id);

/** The label the portal shows anywhere a stage is named. Unknown ids show themselves. */
export const vettingStageLabel = (id: string | null | undefined): string =>
    vettingStageById(id)?.label ?? labelFromId(String(id ?? ''));

export const isVettingStage = (value: unknown): value is VettingStage =>
    typeof value === 'string' && vettingPipeline.some((s) => s.id === value);

/** The one stage a candidate may be moved to next, or null at the end of the line. */
export const nextVettingStage = (from: VettingStage): VettingStage | null => {
    const i = (vettingStageOrder as readonly string[]).indexOf(from);
    return i >= 0 && i < vettingStageOrder.length - 1 ? vettingStageOrder[i + 1] : null;
};

/**
 * Whether arriving at this stage is something we tell the candidate.
 *
 * Reaching `active_roster` deliberately sends nothing: a job offer is Cameron's
 * to make in person, not the notification engine's. `application_received` is
 * only ever *re*-entered, by re-opening a rejection, and a candidate who was
 * told no must not then receive an automated "you have advanced" note. Rejection
 * has its own rule and is not a stage arrival.
 */
export const stageNotifiesCandidate = (stage: VettingStage): boolean =>
    stage !== REJECTED_STAGE &&
    stage !== vettingStageOrder[0] &&
    stage !== vettingStageOrder[vettingStageOrder.length - 1];

export type TransitionPlan = { ok: true; to: VettingStage } | { ok: false; reason: string };

/**
 * The only rule that decides whether a stage change may happen.
 *
 * Forward exactly one stage, or reject from any stage, or re-open a rejection
 * back to the start. No skipping: the five stages are a compliance narrative the
 * public site publishes, and a record showing a candidate going from application
 * straight to the active roster is precisely the record we must not produce.
 */
export function planTransition(from: VettingStage, to: VettingStage): TransitionPlan {
    if (!isVettingStage(from)) return { ok: false, reason: `Unknown current stage "${from}".` };
    if (!isVettingStage(to)) return { ok: false, reason: `Unknown target stage "${to}".` };
    if (from === to) return { ok: false, reason: `Already at ${vettingStageLabel(to)}.` };

    if (to === REJECTED_STAGE) return { ok: true, to };

    if (from === REJECTED_STAGE) {
        return to === vettingStageOrder[0]
            ? { ok: true, to }
            : { ok: false, reason: `A rejected application re-opens at ${vettingStageLabel(vettingStageOrder[0])}, not at ${vettingStageLabel(to)}.` };
    }

    const next = nextVettingStage(from);
    if (!next) return { ok: false, reason: `${vettingStageLabel(from)} is the end of the pipeline; there is nothing to advance to.` };
    if (to !== next) {
        return { ok: false, reason: `Stages cannot be skipped. ${vettingStageLabel(from)} advances to ${vettingStageLabel(next)}, not to ${vettingStageLabel(to)}.` };
    }
    return { ok: true, to };
}

/** Position titles as the careers page advertises them; unlisted ids show themselves. */
export const positionTitle = (id: string | null | undefined): string => {
    const match = (rawPositions as { id: string; title: string }[]).find((p) => p.id === id);
    return match?.title ?? labelFromId(String(id ?? '').replace(/-/g, ' '));
};

/** The brand plate, served by this app (mirrored from assets/logo.png by scripts/sync-shared.mjs). */
export const logoSrc = '/logo.png';

/** Absolute URL of this app, for links in email and SMS. */
export const appUrl = (): string => (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')).replace(/\/$/, '');
