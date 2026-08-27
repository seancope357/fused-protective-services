/* ==========================================================================
   60-SECOND THREAT & VULNERABILITY ASSESSMENT
   ==========================================================================
   The original engine decided everything by substring-matching the visible
   answer text — `environment.includes('VIP')`, `.includes('Event')`. Two
   consequences: rewording an answer silently changed the recommendation, and
   the Commercial Property branch matched no rule at all, so choosing it
   handed the quote form whatever division happened to be selected already.

   Each option now states its own outcome. The resolution rule is one line
   (see `resolve` below) and the routing is explicit per option, so a copy
   edit is a copy edit and the Commercial path lands where it should.
   ========================================================================== */

import { armedPreferences } from './intake.mjs';

export const recommendations = {
    ppo: 'Level IV Personal Protection Officer (PPO) + Dedicated Plainclothes Escort',
    patrol: '24/7 Marked Mobile Patrols + Level III Static Gatehouse Guard',
    squad: 'Level III Commissioned Armed Security Squad'
};

export const assessment = {
    steps: [
        {
            id: 'environment',
            title: 'Step 1: What is the primary operational environment?',
            options: [
                {
                    id: 'executive',
                    icon: 'executive',
                    label: 'Executive Travel / VIP Personal Escort',
                    value: 'Private VIP / Executive Itinerary',
                    recommend: 'ppo',
                    division: 'Executive & VIP Close Protection (Level IV PPO)',
                    armed: armedPreferences.armed
                },
                {
                    id: 'event',
                    icon: 'event',
                    label: 'Luxury Event / Wedding / Gala Venue',
                    value: 'Special Event / Luxury Wedding / Gala',
                    recommend: 'squad',
                    division: 'Special Event & Venue Security',
                    armed: armedPreferences.mixed
                },
                {
                    id: 'commercial',
                    icon: 'commercial',
                    label: 'Commercial Property / Corporate Complex',
                    value: 'Commercial Property / Office Complex',
                    recommend: 'patrol',
                    division: 'Commercial & Property Patrol',
                    armed: armedPreferences.armed
                },
                {
                    id: 'construction',
                    icon: 'construction',
                    label: 'Construction / High-Value Equipment Site',
                    value: 'Active Construction / High-Value Asset Site',
                    recommend: 'patrol',
                    division: 'Construction Site Security',
                    armed: armedPreferences.armed
                }
            ]
        },
        {
            id: 'threat',
            title: 'Step 2: What is the estimated crowd size or threat level?',
            options: [
                {
                    id: 'low',
                    icon: 'low',
                    label: 'Low / Intimate (< 100 Guests)',
                    value: 'Low Risk / Private Gathering (< 100 Guests)',
                    escalate: false
                },
                {
                    id: 'moderate',
                    icon: 'moderate',
                    label: 'Moderate / Public (100–500 Attendees)',
                    value: 'Medium Risk / Large Event (100 - 500 Guests)',
                    escalate: false
                },
                {
                    id: 'highProfile',
                    icon: 'highProfile',
                    label: 'High Profile / VIP Media Attention',
                    value: 'High Profile / Public VIP Presence',
                    escalate: true
                },
                {
                    id: 'elevated',
                    icon: 'elevated',
                    label: 'Elevated / Immediate Known Threat',
                    value: 'Elevated Threat / Immediate Asset Protection',
                    escalate: false
                }
            ]
        }
    ],

    result: {
        heading: 'Tactical Deployment Recommendation',
        body: 'Based on your threat parameters, our operations team recommends a hybrid perimeter and close-protection detail to ensure zero breach points.',
        cta: 'Transfer Plan to Official Quote Form',
        /* Shown before any answer exists, and the value the markup ships with
           so the panel is never empty on first paint. */
        placeholder: recommendations.squad
    }
};

/**
 * A high-profile detail outranks the venue it happens at; otherwise the
 * environment decides. Preserves the original engine's outcomes exactly.
 */
export const resolve = (environment, threat) =>
    threat?.escalate ? 'ppo' : (environment?.recommend ?? 'squad');
