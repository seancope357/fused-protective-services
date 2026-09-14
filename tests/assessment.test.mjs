/* ==========================================================================
   The threat assessment routes an immediate known threat to emergency dispatch.

   "Elevated / Immediate Known Threat" used to carry no routing at all, so the
   environment decided: an immediate threat at a construction site was
   recommended routine patrol, the quote form got the patrol division, and the
   lead was filed at standard priority — no emergency triage, no owner page.

   Proven against the data module and against the committed, generated
   index.html, because the browser only ever reads the #fps-config island.
   Nothing here touches the network or the clock.
   ========================================================================== */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { assessment, recommendations, resolve } from '../src/data/assessment.mjs';
import { divisions } from '../src/data/divisions.mjs';
import { armedPreferences } from '../src/data/intake.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const [environments, threats] = assessment.steps.map((step) => step.options);
const threat = (id) => threats.find((option) => option.id === id);
const quoteValues = new Set(divisions.map((division) => division.quoteValue));

/* Mirrors the emergency rule in api/intake.mjs and the
   triage_client_quote_priority() trigger in the core schema. */
const EMERGENCY = /emergency|tactical dispatch|level iv ppo/i;

test('every recommendation and division an answer names exists', () => {
    for (const option of [...environments, ...threats]) {
        if (option.recommend) assert.ok(recommendations[option.recommend], `${option.id} → ${option.recommend}`);
        if (option.division) assert.ok(quoteValues.has(option.division), `${option.id} → ${option.division}`);
    }
});

test('an immediate known threat routes to armed emergency dispatch from every environment', () => {
    const elevated = threat('elevated');
    for (const environment of environments) {
        assert.equal(resolve(environment, elevated), 'rapid', environment.id);
    }
    assert.equal(elevated.division, 'Emergency Tactical Dispatch');
    assert.equal(elevated.armed, armedPreferences.armed);
    assert.match(elevated.division, EMERGENCY, 'the lead must be triaged as an emergency');
});

test('high profile still escalates to PPO; low and moderate leave the environment in charge', () => {
    for (const environment of environments) {
        assert.equal(resolve(environment, threat('highProfile')), 'ppo', environment.id);
        assert.equal(resolve(environment, threat('low')), environment.recommend, environment.id);
        assert.equal(resolve(environment, threat('moderate')), environment.recommend, environment.id);
    }
    assert.equal(resolve(undefined, undefined), 'squad');
});

test('the browser island carries the threat routing the quiz module reads', () => {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
    const island = html.match(/<script[^>]*id="fps-config"[^>]*>([\s\S]*?)<\/script>/);
    assert.ok(island, 'index.html ships the #fps-config island');
    const { assessment: shipped } = JSON.parse(island[1]);
    assert.equal(shipped.threat.elevated.recommend, 'rapid');
    assert.equal(shipped.threat.elevated.division, 'Emergency Tactical Dispatch');
    assert.equal(shipped.threat.elevated.armed, armedPreferences.armed);
    assert.equal(shipped.threat.highProfile.recommend, 'ppo');
    assert.equal(shipped.recommendations.rapid, recommendations.rapid);
});
