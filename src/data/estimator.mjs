/* ==========================================================================
   COVERAGE & BUDGET ESTIMATOR
   Hourly rates, the officer/hour ranges, and where each tier routes the
   quote form. Rates lived as bare numbers inside onclick attributes
   (`selectTier(2, 65)`), so repricing meant editing markup.
   ========================================================================== */

import { armedPreferences } from './intake.mjs';

export const tiers = [
    {
        id: 'level-2',
        label: 'Level II',
        sublabel: 'Unarmed Guard',
        name: 'Level II Unarmed',
        rate: 45,
        armed: armedPreferences.unarmed,
        division: null
    },
    {
        id: 'level-3',
        label: 'Level III',
        sublabel: 'Armed Officer',
        name: 'Level III Armed',
        rate: 65,
        armed: armedPreferences.armed,
        division: 'Commercial & Property Patrol',
        default: true
    },
    {
        id: 'level-4',
        label: 'Level IV',
        sublabel: 'Executive PPO',
        name: 'Level IV Executive PPO',
        rate: 95,
        armed: armedPreferences.armed,
        division: 'Executive & VIP Close Protection (Level IV PPO)'
    }
];

export const ranges = {
    officers: { min: 1, max: 15, value: 2 },
    hours: { min: 4, max: 24, value: 8 }
};

export const estimatorCopy = {
    disclaimer:
        '*Estimates are for preliminary budgeting. Final quotes depend on location, threat level, and duration.',
    cta: 'Lock In Deployment Slot'
};

/** The tier the markup ships selected. */
export const defaultTier = tiers.find((t) => t.default) ?? tiers[0];
