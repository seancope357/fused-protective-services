import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
register('./helpers/three-esm-loader.mjs', import.meta.url);
const THREE = await import('../js/vendor/three.module.js');
const { GLTFLoader } = await import('../js/vendor/aerial/GLTFLoader.mjs');

export async function aircraftFixture() {
    const bytes = readFileSync('assets/aerial/aircraft.glb'), length = bytes.readUInt32LE(12);
    const json = JSON.parse(bytes.subarray(20, 20 + length));
    // Geometry-only offline fixture. Runtime materials are never stripped.
    const strip = value => {
        if (!value || typeof value !== 'object') return;
        for (const key of Object.keys(value)) if (key.endsWith('Texture')) delete value[key]; else strip(value[key]);
    };
    strip(json.materials); delete json.images; delete json.textures;
    const text = JSON.stringify(json), padded = Buffer.from(text + ' '.repeat((4 - Buffer.byteLength(text) % 4) % 4));
    const header = Buffer.from(bytes.subarray(0, 20)), binary = bytes.subarray(20 + length);
    header.writeUInt32LE(20 + padded.length + binary.length, 8); header.writeUInt32LE(padded.length, 12);
    const fixture = Buffer.concat([header, padded, binary]);
    return (await new GLTFLoader().parseAsync(fixture.buffer.slice(fixture.byteOffset, fixture.byteOffset + fixture.byteLength), '')).scene;
}
const triangles = root => {
    let total = 0; root.traverse(m => { if (m.isMesh && !m.userData.rotorBlur) total += (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3; }); return total;
};
const snapshot = root => { root.updateMatrixWorld(true); const result = []; root.traverse(m => result.push([m.visible, ...m.matrix.elements])); return result; };
const close = (a, b, tolerance = 1e-6) => assert.ok(a.distanceTo(b) < tolerance, `${a.toArray()} != ${b.toArray()}`);

test('actual GLB: preserves baseline geometry, attributes, world bounds and identifies four tilted rotors', async () => {
    const { prepareAircraft } = await import('../js/aerial/aircraft.mjs');
    const source = await aircraftFixture(), before = new THREE.Box3().setFromObject(source);
    const evidence = [[67, 70, 76, 79], [99, 102, 108, 111], [134, 131, 140, 143], [184, 163, 166, 169]].map(ids => ids.map(id => {
        const mesh = source.getObjectByName(`Object_${id}`);
        return new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
    }));
    const attributeTotals = root => {
        const totals = {};
        root.updateMatrixWorld(true);
        root.traverse(mesh => {
            if (!mesh.isMesh || mesh.userData.rotorBlur) return;
            const clone = mesh.geometry.clone(), geometry = clone.index ? clone.toNonIndexed() : clone;
            geometry.applyMatrix4(mesh.matrixWorld);
            // Renderer flips tangent handedness for reflected source transforms;
            // the baked result stores that correction directly in the attribute.
            const tangent = geometry.attributes.tangent;
            if (tangent && mesh.matrixWorld.determinant() < 0) for (let i = 0; i < tangent.count; i++) tangent.setW(i, -tangent.getW(i));
            for (const [key, attribute] of Object.entries(geometry.attributes)) {
                totals[key] ??= { count: 0, sum: 0, squares: 0 };
                for (const value of attribute.array) { totals[key].count++; totals[key].sum += value; totals[key].squares += value * value; }
            }
            if (geometry !== clone) geometry.dispose(); clone.dispose();
        });
        return totals;
    };
    const expectedAttributes = attributeTotals(source);
    const rig = prepareAircraft(source), stats = rig.stats();
    const actualAttributes = attributeTotals(rig.object);
    assert.deepEqual(Object.keys(actualAttributes).sort(), Object.keys(expectedAttributes).sort());
    for (const key of Object.keys(expectedAttributes)) {
        assert.equal(actualAttributes[key].count, expectedAttributes[key].count);
        assert.ok(Math.abs(actualAttributes[key].sum - expectedAttributes[key].sum) < .001, key);
        assert.ok(Math.abs(actualAttributes[key].squares - expectedAttributes[key].squares) < .001, key);
    }
    rig.rotors.forEach((r, i) => {
        const [upper, lower, pinA, pinB] = evidence[i];
        close(r.axis, upper.clone().sub(lower).normalize());
        assert.ok(r.pivot.clone().sub(lower).cross(r.axis).length() < 1e-8);
        assert.ok(Math.abs(pinA.clone().add(pinB).multiplyScalar(.5).sub(r.pivot).dot(r.axis)) < 1e-8);
        const diskNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(r.blur.quaternion);
        close(diskNormal, r.axis); close(r.blur.position, r.pivot);
        assert.equal(r.blur.geometry.parameters.outerRadius, r.radius);
    });
    assert.ok(rig.object.isGroup); assert.equal(triangles(rig.object), 127011);
    close(new THREE.Box3().setFromObject(rig.object).min, before.min);
    close(new THREE.Box3().setFromObject(rig.object).max, before.max);
    assert.equal(stats.rotorCount, 4); assert.equal(stats.baselineTriangles, 127011);
    assert.equal(stats.animatedTriangles, 5864); assert.ok(stats.drawOverhead <= 7);
    assert.deepEqual(stats.rotors.map(r => r.nodes), [['Object_88', 'Object_91'], ['Object_117', 'Object_120'], ['Object_152', 'Object_155'], ['Object_172', 'Object_178']]);
    for (const r of rig.rotors) {
        assert.ok(r.radius > .09 && r.radius < .105);
        assert.ok(r.axis.y > .98 && r.axis.y < 1);
        assert.ok(r.planeError < .001);
        assert.ok(r.radialMismatch < .003);
        assert.ok(Math.abs(r.pivot.x) > .1 && Math.abs(r.pivot.z) > .08);
    }
    rig.object.traverse(m => { if (m.isMesh && !m.userData.rotorBlur) for (const key of ['normal', 'tangent', 'uv']) assert.equal(m.geometry.attributes[key].count, m.geometry.attributes.position.count); });
    assert.deepEqual(rig.rotors.map(r => r.direction), [1, 1, -1, -1]);
});

test('absolute clock is deterministic, pause freezes, reduced motion restores complete source geometry', async () => {
    const { prepareAircraft } = await import('../js/aerial/aircraft.mjs');
    const rig = prepareAircraft(await aircraftFixture()), initial = snapshot(rig.object);
    rig.update(2); const moving = snapshot(rig.object); assert.notDeepEqual(moving, initial);
    rig.update(2); assert.deepEqual(snapshot(rig.object), moving);
    rig.update(18); rig.update(2); assert.deepEqual(snapshot(rig.object), moving);
    rig.update(18, true); assert.deepEqual(snapshot(rig.object), initial);
    rig.update(99, true); assert.deepEqual(snapshot(rig.object), initial);
    rig.object.traverse(m => { if (m.userData.rotorBlur) assert.equal(m.visible, false); });
});

test('unknown geometry stays static; world transform, every attribute and PBR texture identity survive', async () => {
    const { prepareAircraft } = await import('../js/aerial/aircraft.mjs');
    const root = new THREE.Group(), parent = new THREE.Group(); root.position.set(3, 4, 5); parent.rotation.y = .4; parent.scale.x = -1; root.add(parent);
    const material = new THREE.MeshStandardMaterial();
    for (const key of ['map', 'metalnessMap', 'roughnessMap', 'normalMap', 'aoMap']) material[key] = new THREE.Texture();
    const geometry = new THREE.BoxGeometry(); geometry.setAttribute('custom', new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count).fill(.7), 1));
    parent.add(new THREE.Mesh(geometry, material));
    const before = new THREE.Box3().setFromObject(root), rig = prepareAircraft(root);
    assert.equal(rig.stats().rotorCount, 0); assert.equal(rig.stats().animatedTriangles, 0);
    assert.equal(rig.stats().blurTriangles, 0);
    const mesh = rig.object.children[0]; assert.equal(mesh.material, material);
    for (const key of ['map', 'metalnessMap', 'roughnessMap', 'normalMap', 'aoMap']) assert.equal(mesh.material[key], material[key]);
    assert.equal(mesh.geometry.attributes.custom.count, mesh.geometry.attributes.position.count);
    close(new THREE.Box3().setFromObject(rig.object).min, before.min); close(new THREE.Box3().setFromObject(rig.object).max, before.max);
    const initial = snapshot(rig.object); rig.update(5); assert.deepEqual(snapshot(rig.object), initial);
});


test('incomplete known asset falls back intact; cleanup includes detached blur without disposing authored maps', async () => {
    const { prepareAircraft } = await import('../js/aerial/aircraft.mjs');
    const source = await aircraftFixture(); source.getObjectByName('Object_88').name = 'unknown-blade';
    const fallback = prepareAircraft(source); assert.equal(fallback.rotors.length, 0); assert.equal(triangles(fallback.object), 127011);
    const rig = prepareAircraft(await aircraftFixture());
    let blurDisposed = 0, materialDisposed = 0;
    rig.rotors[0].blur.geometry.addEventListener('dispose', () => blurDisposed++);
    rig.object.children[0].material.addEventListener('dispose', () => materialDisposed++);
    rig.dispose(); rig.dispose(); assert.equal(blurDisposed, 1); assert.equal(materialDisposed, 0);
});
