import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { aerial } from '../src/data/aerial.mjs';
import { aerialPage } from '../src/templates/aerial/page.mjs';
import { aerialIntent, withAerialIntent } from '../js/modules/aerial-inquiry.mjs';

test('only the known aerial service activates the inquiry', () => {
    for (const query of ['', '?service=other', '?service=<script>', '?service=AERIAL']) {
        assert.equal(aerialIntent(query, aerial.inquiry), null);
    }
    assert.equal(aerialIntent('?service=aerial', undefined), null);
    assert.equal(aerialIntent('?service=aerial&utm_source=test', aerial.inquiry), aerial.inquiry);
});
test('drone intent survives empty or edited notes without losing the existing payload', () => {
    const data = { formDivision: 'Private Estate & Ranch Defense', formNotes: 'Gate and north boundary.' };
    const result = withAerialIntent(data, aerial.inquiry);
    assert.equal(result.formDivision, data.formDivision);
    assert.equal(result.formNotes, `${aerial.inquiry.marker}\n\n${data.formNotes}`);
    assert.equal(data.formNotes, 'Gate and north boundary.');
    assert.deepEqual(withAerialIntent(result, aerial.inquiry), result);
    assert.equal(withAerialIntent({}, aerial.inquiry).formNotes.trim(), aerial.inquiry.marker);
    assert.equal(withAerialIntent(data, null), data);
});
test('all five primary CTA placements share one drone inquiry destination', () => {
    const page = String(aerialPage());
    assert.equal(page.split(`href="${aerial.cta.href}"`).length - 1, 5);
    assert.match(page, /Pilot-operated drone patrols/);
    assert.match(page, /before you book/);
    assert.match(page, /not a live feed or a promise of night operations/);
    assert.doesNotMatch(page, /autonomous|FAA-certified|24\/7|guaranteed/i);
});
test('generated homepage supplies the same source-controlled aerial inquiry', () => {
    const page = readFileSync('index.html', 'utf8');
    const island = JSON.parse(page.match(/id="fps-config"[^>]*>([\s\S]*?)<\/script>/)[1]);
    assert.equal(island.aerialInquiry.marker, aerial.inquiry.marker);
    assert.equal(island.aerialInquiry.title, aerial.inquiry.title);
});
