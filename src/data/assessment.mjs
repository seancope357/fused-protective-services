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
    squad: 'Level III Commissioned Armed Security Squad',
    rapid: 'Emergency Tactical Dispatch — Armed Commissioned Officers. If anyone is in immediate danger, call 911 first.'
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
                    id: 'nightlife',
                    icon: 'nightlife',
                    label: 'Restaurant / Bar / Nightlife Venue',
                    value: 'Restaurant / Bar / Nightlife Venue',
                    recommend: 'squad',
                    division: 'Restaurant, Bar & Nightlife Venue Security',
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
                    value: 'Low Risk / Private Gathering (< 100 Guests)'
                },
                {
                    id: 'moderate',
                    icon: 'moderate',
                    label: 'Moderate / Public (100–500 Attendees)',
                    value: 'Medium Risk / Large Event (100 - 500 Guests)'
                },
                {
                    id: 'highProfile',
                    icon: 'highProfile',
                    label: 'High Profile / VIP Media Attention',
                    value: 'High Profile / Public VIP Presence',
                    recommend: 'ppo'
                },
                {
                    /* An immediate known threat is an emergency wherever it
                       happens. It routes the quote form to Emergency Tactical
                       Dispatch, which the intake and the database both triage
                       as `emergency` — the 45-minute window and the owner page.
                       Until 2026-09-14 this answer carried no routing, so the
                       environment decided and a construction site under threat
                       was recommended routine patrol at standard priority. */
                    id: 'elevated',
                    icon: 'elevated',
                    label: 'Elevated / Immediate Known Threat',
                    value: 'Elevated Threat / Immediate Asset Protection',
                    recommend: 'rapid',
                    division: 'Emergency Tactical Dispatch',
                    armed: armedPreferences.armed
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
 * A threat answer that carries its own routing outranks the venue it happens
 * at: high profile escalates to PPO, an immediate known threat to emergency
 * dispatch. Otherwise the environment decides. `js/modules/assessment.mjs`
 * applies the same rule to the #fps-config island, and a threat answer's
 * `division` / `armed` likewise outrank the environment's on the quote form.
 */
export const resolve = (environment, threat) =>
    threat?.recommend ?? environment?.recommend ?? 'squad';
