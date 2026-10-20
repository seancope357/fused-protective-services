import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cameraPose, initialState, timeOfDay, clampProgress, aircraftSpan, aircraftPosition } from '../js/aerial/state.mjs';
import { aerialPage } from '../src/templates/aerial/page.mjs';
test('camera travel is bounded, reversible, continuous and stays above property', () => {
    assert.equal(clampProgress(-1), 0); assert.equal(clampProgress(2), 1);
    assert.equal(clampProgress(NaN), 0);
    for (let i = 0; i <= 1000; i++) {
        const u = i / 1000, a = cameraPose(u), b = cameraPose(Math.min(1, u + .001));
        assert.ok(a.position[1] >= 6);
        assert.ok(Math.hypot(...a.position.map((v, j) => v - b.position[j])) < .3);
        assert.deepEqual(a, cameraPose(u));
    }
});
test('day is the default, invalid lighting selections are normalized, reduced motion is stable', () => {
    assert.deepEqual(initialState(true), {paused:true,timeOfDay:'day',progress:0});
    assert.equal(timeOfDay('night'),'night');
    for(const value of ['day','sensor',null,{},'NIGHT']) assert.equal(timeOfDay(value),'day');
    assert.deepEqual(cameraPose(0, true), cameraPose(1, true));
});
test('public aerial shell has no inline executable content and is indexable', () => {
    const page = String(aerialPage());
    for (const marker of ['aerial-canvas', 'aerial-track', 'aerial-status', 'Illustrative visualization', '/?service=aerial#quote', '/assets/aerial/PROVENANCE.md']) assert.ok(page.includes(marker), marker);
    for (const action of ['day', 'night']) assert.ok(page.includes(`data-action="${action}"`));
    assert.doesNotMatch(page, /data-action="(?:sensor|pause|inspect|rotate-[^"]*|reset)"/);
    assert.match(page, /role="group" aria-label="Time of day"/);
    assert.doesNotMatch(page, /\s(?:style|on\w+)=/);
    assert.doesNotMatch(page, /<script(?![^>]*src=)/);
    assert.equal((page.match(/<canvas/g) || []).length, 1);
    // It is a hosted page now: crawlable, canonical and described.
    assert.doesNotMatch(page, /noindex/);
    assert.ok(page.includes('rel="canonical"'), 'canonical');
    assert.ok(page.includes('name="description"'), 'description');
    // The honest illustrative/fictional disclaimers must survive going public.
    assert.ok(page.includes('no claim of Fused ownership'), 'ownership disclaimer');
    assert.ok(page.includes('Fictional property'), 'fictional property disclaimer');
});
test('aerial ships in the default build, is linked and listed, QA buffer stays gated', () => {
    const build = readFileSync('build.mjs', 'utf8');
    // No longer an opt-in flag: the page is a normal build artefact.
    assert.doesNotMatch(build, /--aerial-preview/);
    assert.match(build, /aerial\.html/);
    assert.match(build, /components\/aerial\.css/);
    assert.match(readFileSync('js/aerial/scene.mjs', 'utf8'), /preserveDrawingBuffer: verify/);
    // Reachable from the hosted site and declared to crawlers.
    assert.match(readFileSync('src/data/site.mjs', 'utf8'), /href: 'aerial'/);
    assert.match(readFileSync('sitemap.xml', 'utf8'), /fusedprotectiveservices\.com\/aerial/);
});

import { register } from 'node:module';
register('./helpers/three-esm-loader.mjs', import.meta.url);
const THREE = await import('../js/vendor/three.module.js');
const { GLTFLoader } = await import('../js/vendor/aerial/GLTFLoader.mjs');
const { batchStatic } = await import('../js/aerial/batch.mjs');
import { pixelRatio, needsFrame, dampFactor } from '../js/aerial/state.mjs';

test('portrait camera is continuous and uses a dedicated hero composition', () => {
    assert.deepEqual(cameraPose(0, false, 16 / 9).position, [3.8, 10.85, 5.6]);
    assert.notDeepEqual(cameraPose(0, false, .5), cameraPose(0, false, 16 / 9));
    for (const aspect of [.45, .75, 1, 1.2, 2]) for (let i = 0; i < 1000; i++) {
        const a = cameraPose(i / 1000, false, aspect), b = cameraPose((i + 1) / 1000, false, aspect);
        assert.ok(a.position.every(Number.isFinite));
        assert.ok(Math.hypot(...a.position.map((v, j) => v - b.position[j])) < .3);
    }
    assert.equal(pixelRatio(3, 390), 1.75);
    assert.equal(pixelRatio(3, 900, true), 1.75);
    assert.equal(pixelRatio(3, 1440), 2);
});
test('hidden-tab lifecycle discards the old convergence timestamp', () => {
    const source = readFileSync('js/aerial/boot.mjs', 'utf8');
    const handler = source.match(/document.addEventListener\('visibilitychange', \(\) => \{([\s\S]*?)\n\}\);/)[1];
    const run = new Function('document', 'cancelAnimationFrame', 'draw', `let previous = 1000, frame = 7; const qa = { ready: true }; ${handler}; return { previous, frame };`);
    let cancelled = false;
    const result = run({ hidden: true }, id => { cancelled = id === 7; }, () => { throw new Error('hidden tab rendered'); });
    assert.equal(cancelled, true); assert.deepEqual(result, { previous: 0, frame: 0 });
});

test('camera convergence is frame-rate-independent and day/night input leaves touch scrolling native', () => {
    const advance = fps => { let value = 0; for (let i = 0; i < fps; i++) value += (1 - value) * dampFactor(1 / fps); return value; };
    assert.ok(Math.abs(advance(30) - advance(60)) < 1e-10);
    assert.ok(Math.abs(advance(10) - advance(60)) < 1e-10);
    assert.equal(dampFactor(0), 0);
    assert.doesNotMatch(readFileSync('js/aerial/boot.mjs', 'utf8'), /setPointerCapture|preventDefault\(\).*scroll|addEventListener\('wheel'/);
});

test('reduced motion stops autonomous rendering in either lighting mode', () => {
    for(const timeOfDay of ['day','night']) {
        const state={...initialState(false),timeOfDay};
        assert.equal(needsFrame(state,true),false);
        assert.equal(needsFrame({...state,paused:true},false),false);
        assert.equal(needsFrame(state,false),true);
    }
});
test('static batching preserves hierarchy transforms, UVs, normals and material identity', () => {
    const root = new THREE.Group(), parent = new THREE.Group(); parent.position.set(3, 4, -2); parent.rotation.y = .7; root.add(parent);
    const material = new THREE.MeshStandardMaterial(), source = new THREE.BoxGeometry(1, 2, 3);
    const mesh = new THREE.Mesh(source, material); mesh.scale.set(2, 1, .5); parent.add(mesh);
    root.updateMatrixWorld(true);
    const before = new THREE.Box3().setFromObject(root), expected = source.toNonIndexed().applyMatrix4(mesh.matrixWorld);
    let disposed = 0; source.addEventListener('dispose', () => disposed++);
    const result = batchStatic(root), actual = result.children[0].geometry;
    assert.equal(result.children.length, 1); assert.equal(result.children[0].material, material);
    for (const key of ['position', 'normal', 'uv']) assert.deepEqual(actual.attributes[key].array, expected.attributes[key].array);
    assert.ok(new THREE.Box3().setFromObject(result).min.distanceTo(before.min) < 1e-6);
    assert.equal(disposed, 1);
    actual.dispose(); expected.dispose(); material.dispose();
});
test('actual aircraft merges 147 primitives into two material meshes with bounds and triangles intact', async () => {
    // Load actual binary geometry offline. Image decoding belongs to controller
    // browser QA; strip texture references only from this in-memory test fixture.
    const bytes = readFileSync('assets/aerial/aircraft.glb'), jsonLength = bytes.readUInt32LE(12);
    const json = JSON.parse(bytes.subarray(20, 20 + jsonLength));
    const clean = value => {
        if (!value || typeof value !== 'object') return;
        for (const key of Object.keys(value)) if (key.endsWith('Texture')) delete value[key]; else clean(value[key]);
    };
    clean(json.materials); delete json.images; delete json.textures;
    const text = JSON.stringify(json), padded = Buffer.from(text + ' '.repeat((4 - Buffer.byteLength(text) % 4) % 4));
    const binary = bytes.subarray(20 + jsonLength), header = Buffer.alloc(20);
    header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(20 + padded.length + binary.length, 8);
    header.writeUInt32LE(padded.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
    const fixture = Buffer.concat([header, padded, binary]);
    const gltf = await new GLTFLoader().parseAsync(fixture.buffer.slice(fixture.byteOffset, fixture.byteOffset + fixture.byteLength), '');
    const before = new THREE.Box3().setFromObject(gltf.scene), materials = new Set(); let count = 0;
    gltf.scene.traverse(mesh => { if (mesh.isMesh) { count++; materials.add(mesh.material); mesh.castShadow = mesh.receiveShadow = true; } });
    assert.equal(count, 147);
    const merged = batchStatic(gltf.scene), after = new THREE.Box3().setFromObject(merged);
    assert.equal(merged.children.length, 2);
    assert.equal(merged.children.reduce((sum, mesh) => sum + mesh.geometry.attributes.position.count / 3, 0), 127011);
    assert.ok(before.min.distanceTo(after.min) < 1e-6 && before.max.distanceTo(after.max) < 1e-6);
    for (const mesh of merged.children) {
        assert.ok(materials.has(mesh.material));
        for (const key of ['normal', 'uv', 'tangent']) assert.equal(mesh.geometry.attributes[key].count, mesh.geometry.attributes.position.count);
        mesh.geometry.dispose(); mesh.material.dispose();
    }
});

const { createWorld } = await import('../js/aerial/world.mjs');
const { RGBELoader } = await import('../js/vendor/aerial/RGBELoader.mjs');
test('property has real glazing depth, coherent roof layers and bounded instanced landscaping', () => {
    const scene=new THREE.Scene(),world=createWorld(scene),meshes=[];
    scene.updateMatrixWorld(true);scene.traverse(o=>{if(o.isMesh)meshes.push(o);});
    assert.equal(meshes.filter(m=>m.isInstancedMesh).length,5);
    const leaves=scene.getObjectByName('leaf-sprays');
    assert.ok(leaves.count<=55*168);assert.equal(leaves.material.alphaToCoverage,true);
    assert.equal(leaves.material.transparent,false);assert.ok(leaves.material.map.generateMipmaps);
    const opaque=meshes.filter(m=>!m.isInstancedMesh&&!m.material.transparent);
    const ray=new THREE.Raycaster(new THREE.Vector3(.7,1.9,-7),new THREE.Vector3(0,0,-1));
    const hit=ray.intersectObjects(opaque,false)[0];
    assert.ok(hit && hit.distance>5,'window aperture must open into a room instead of overlapping a solid facade');
    assert.ok(world.property.wingStart-world.property.pavilionEnd>=.1,'solid wings must not share coplanar facade faces');
    const triangles=meshes.reduce((sum,m)=>sum+(m.geometry.index?.count??m.geometry.attributes.position.count)/3*(m.count??1),0);
    assert.ok(triangles<200000,`environment triangles: ${triangles}`);
    assert.ok(world.stats().batches<20);
    world.setNight(1);
    assert.ok(scene.children.filter(o=>o.isPointLight).every(l=>l.intensity>0));
    world.setNight(0);
    assert.ok(scene.children.filter(o=>o.isPointLight).every(l=>l.intensity===0));
    scene.traverse(o=>{o.geometry?.dispose();o.material?.map?.dispose();o.material?.dispose();});
});
test('optional local HDR is a decodable 1024 by 512 lighting asset', () => {
    const bytes = readFileSync('assets/aerial/blue-hour.hdr');
    const hdr = new RGBELoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    assert.equal(hdr.width, 1024); assert.equal(hdr.height, 512);
});

const { surface } = await import('../js/aerial/visual-surfaces.mjs');
test('procedural surface keeps preprocessor directives on their own GLSL lines', () => {
    const material = surface(0x333333, .9, true);
    const shader = { vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
    material.onBeforeCompile(shader);
    assert.match(shader.fragmentShader, /}\n+#define STANDARD/);
    assert.doesNotMatch(shader.fragmentShader, /[^\n\s]#(?:define|include|ifdef)/);
    material.dispose();
});

test('physical aircraft fits the hero frame above portrait copy, with the body viewed from above', () => {
    assert.ok(aircraftSpan / 15 >= .1 && aircraftSpan / 15 <= .14);
    for (const aspect of [16 / 9, 1.44, .75, 390 / 844, 320 / 844]) {
        const pose = cameraPose(0, false, aspect);
        const camera = new THREE.PerspectiveCamera(40, aspect, .1, 400);
        camera.position.fromArray(pose.position); camera.lookAt(...pose.target); camera.updateMatrixWorld();
        assert.ok(camera.position.y > aircraftPosition[1], 'view body top, not just underside');
        const center = new THREE.Vector3(...aircraftPosition).project(camera);
        if (aspect < .8) assert.ok(center.y > .4, 'portrait aircraft stays in upper third');
        else assert.ok(center.x > .2, 'desktop aircraft stays right of copy');
        // Conservative bounding cube, including the small hover, fits the viewport.
        for (const x of [-.9, .9]) for (const y of [-.3, .3]) for (const z of [-.9, .9]) {
            const point = new THREE.Vector3(...aircraftPosition).add(new THREE.Vector3(x,y,z)).project(camera);
            assert.ok(Math.abs(point.x) < .98 && Math.abs(point.y) < .98, `${aspect}: ${point.toArray()}`);
        }
    }
});

test('procedural landscape is deterministic and the complete pass count stays conservatively bounded', () => {
    const scenes = [new THREE.Scene(), new THREE.Scene()];
    scenes.forEach(createWorld);
    const foliage = scenes.map(scene => scene.getObjectByName('leaf-sprays'));
    assert.deepEqual(foliage[0].instanceMatrix.array, foliage[1].instanceMatrix.array);
    assert.deepEqual(foliage[0].material.map.image.data, foliage[1].material.map.image.data);
    const meshes = []; scenes[0].traverse(o => { if (o.isMesh) meshes.push(o); });
    // Base world + shadow casters + two aircraft batches twice + one sky.
    // This is a structural upper bound, not a substitute for renderer.info QA.
    assert.ok(meshes.length + meshes.filter(m => m.castShadow).length + 5 <= 50);
    for (const scene of scenes) scene.traverse(o => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose(); });
});

const {terrainHeight}=await import('../js/aerial/world.mjs');
const {createLighting}=await import('../js/aerial/lighting.mjs');
test('day/night changes physical illumination and fixtures together without moving the camera',()=>{
    const scene=new THREE.Scene(),renderer={shadowMap:{}},amounts=[];
    const lighting=createLighting(scene,renderer,{setNight:n=>amounts.push(n)});
    lighting.setMode('day');
    const sun=scene.children.find(o=>o.isDirectionalLight&&o.castShadow),day=sun.intensity;
    lighting.setMode('night');assert.ok(sun.intensity<day);assert.equal(amounts.at(-1),1);
    assert.equal(lighting.stats().mode,'night');assert.equal(renderer.shadowMap.needsUpdate,true);
    const count=amounts.length;lighting.setMode('night');assert.equal(amounts.length,count,'unchanged modes must not rebuild shadows');
    lighting.setMode('day');assert.equal(sun.intensity,day);assert.equal(amounts.at(-1),0);
    assert.ok(sun.shadow.camera.near>0 && sun.shadow.camera.far<100);
    scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
});
test('terrain is level beneath the property and continuous across the meadow transition',()=>{
    for(const [x,z] of [[0,-8],[-19,-25],[20,7],[7,18]])assert.equal(terrainHeight(x,z),-.2);
    let changes=false;
    for(let x=-220;x<=220;x+=.5){
        const a=terrainHeight(x,-75),b=terrainHeight(x+.01,-75);
        assert.ok(Number.isFinite(a)&&Math.abs(a-b)<.02);
        if(Math.abs(a+.2)>.5)changes=true;
    }
    assert.equal(changes,true);
});
