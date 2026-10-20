import * as THREE from '../vendor/three.module.js';
import { GLTFLoader } from '../vendor/aerial/GLTFLoader.mjs';
import { RGBELoader } from '../vendor/aerial/RGBELoader.mjs';
import { createWorld } from './world.mjs';
import { cameraPose, pixelRatio, aircraftSpan, aircraftPosition, dampFactor } from './state.mjs';
import { createLighting } from './lighting.mjs';
import { prepareAircraft } from './aircraft.mjs';
import { stabilizationPose } from './choreography.mjs';
export function createScene(canvas, verify) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: verify });
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, .3, 600);
    const world = createWorld(scene), lights = createLighting(scene, renderer, world);
    lights.setMode('day');
    const aircraft = new THREE.Group(); aircraft.position.fromArray(aircraftPosition); aircraft.rotation.y = -.4; scene.add(aircraft);
    // A restrained, shadowless photographic fill picks out the camera glass and
    // composite edges without changing the established property lighting.
    const lensFill = new THREE.SpotLight(0xe8f1ff, 18, 14, .42, .85, 2);
    lensFill.position.set(-1, 13.5, 6.5); lensFill.target.position.fromArray(aircraftPosition);
    scene.add(lensFill, lensFill.target);
    const pmrem = new THREE.PMREMGenerator(renderer);
    // Original studio reflection environment remains usable if optional HDR fails.
    const studio = new THREE.Scene(); studio.background = new THREE.Color(0x40576d);
    for (const [x, y, z, w, h] of [[-8, 6, 4, 8, 5], [6, 4, -6, 6, 8], [0, 12, 0, 10, 10]]) {
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
        panel.position.set(x, y, z); panel.lookAt(0, 0, 0); studio.add(panel);
    }
    let environment = pmrem.fromScene(studio); scene.environment = environment.texture;
    studio.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
    let loaded = false, disposed = false, bounds = null, lighting = 'studio', rig = null;
    const lookTarget = new THREE.Vector3();
    let cameraInitialized = false, cameraSettled = false;
    async function load(progress) {
        // The controller's GLB uses external same-origin images, preserving img-src 'self'.
        const manager = new THREE.LoadingManager();
        let assetFailed = false;
        manager.onError = () => { assetFailed = true; };
        const gltf = await new GLTFLoader(manager).loadAsync('/assets/aerial/aircraft.glb', progress);
        if (assetFailed) { disposeObject(gltf.scene); throw new Error('Aircraft texture could not load'); }
        if (disposed) { disposeObject(gltf.scene); return; }
        gltf.scene.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(gltf.scene), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
        const scale = aircraftSpan / Math.max(size.x, size.y, size.z);
        if (!Number.isFinite(scale) || scale <= 0) { disposeObject(gltf.scene); throw new Error('Aircraft has invalid bounds'); }
        bounds = { min: box.min.toArray(), max: box.max.toArray(), scale, normalizedSpan: aircraftSpan };
        gltf.scene.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true;
            for (const material of Array.isArray(o.material) ? o.material : [o.material]) material.envMapIntensity = .48; } });
        rig = prepareAircraft(gltf.scene);
        const normalized = new THREE.Group(); normalized.add(rig.object); rig.object.position.sub(center); normalized.scale.setScalar(scale);
        aircraft.add(normalized); loaded = true;
        // Optional lighting enhancement cannot turn an otherwise loaded aircraft into an error.
        lighting = 'loading';
        await new RGBELoader().loadAsync('/assets/aerial/blue-hour.hdr').then(hdr => {
            if (!disposed) { const next = pmrem.fromEquirectangular(hdr); environment.dispose(); environment = next; scene.environment = next.texture; lighting = 'hdr'; }
            hdr.dispose();
        }).catch(() => { lighting = 'studio-fallback'; });
    }
    function render(state, reduced, time = 0, parallax = { x: 0, y: 0 }, snapCamera = false, delta = 1 / 60) {
        if (disposed) return;
        const pose = cameraPose(state.progress, reduced, camera.aspect);
        const target = new THREE.Vector3(...pose.target);
        const offset = new THREE.Vector3(...pose.position).sub(target);
        const spherical = new THREE.Spherical().setFromVector3(offset);
        spherical.theta += parallax.x * .015; spherical.phi += parallax.y * .01;
        const desiredPosition = target.clone().add(new THREE.Vector3().setFromSpherical(spherical));
        const alpha = dampFactor(delta);
        if (!cameraInitialized || reduced || snapCamera) {
            camera.position.copy(desiredPosition); lookTarget.copy(target); cameraInitialized = true;
        } else { camera.position.lerp(desiredPosition, alpha); lookTarget.lerp(target, alpha); }
        cameraSettled = camera.position.distanceToSquared(desiredPosition) + lookTarget.distanceToSquared(target) < 1e-7;
        if (cameraSettled) { camera.position.copy(desiredPosition); lookTarget.copy(target); }
        camera.lookAt(lookTarget);
        const stabilization = stabilizationPose(time, reduced);
        aircraft.position.fromArray(aircraftPosition).add(new THREE.Vector3(...stabilization.position));
        aircraft.rotation.set(stabilization.rotation[0], -.4 + stabilization.rotation[1], stabilization.rotation[2]);
        // Rotor motion follows the same pause-aware elapsed clock as the hover.
        // Pausing or reduced motion restores the authored blade pose, never a frozen blur disc.
        rig?.update(time, reduced || state.paused);
        lights.setMode(state.timeOfDay); renderer.render(scene, camera);
    }
    function resize() { renderer.setPixelRatio(pixelRatio(devicePixelRatio, innerWidth, matchMedia('(pointer: coarse)').matches)); renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.fov = 40; camera.updateProjectionMatrix(); }
    function disposeObject(root) {
        const textures = new Set(), materials = new Set(), geometries = new Set();
        root.traverse(o => { o.shadow?.dispose(); if (o.geometry) geometries.add(o.geometry); for (const m of o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []) { materials.add(m); for (const value of Object.values(m)) if (value?.isTexture) textures.add(value); } });
        textures.forEach(t => t.dispose()); materials.forEach(m => m.dispose()); geometries.forEach(g => g.dispose());
    }
    resize();
    return { load, render, resize, isSettling: () => !cameraSettled, context: renderer.getContext(), stats: () => ({ cameraSettled, timeOfDay: lights.stats().mode, shadowMapSize: lights.stats().shadowMapSize, property: world.stats(), calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, camera: { position: camera.position.toArray(), target: lookTarget.toArray(), direction: camera.getWorldDirection(new THREE.Vector3()).toArray() }, modelLoaded: loaded, lighting, pixelRatio: renderer.getPixelRatio(), aircraftDraws: rig?.stats().aircraftDraws ?? 0, rotorCount: rig?.stats().rotorCount ?? 0, bounds }),
        dispose() { disposed = true; rig?.dispose(); rig = null; disposeObject(scene); environment.dispose(); pmrem.dispose(); renderer.dispose(); } };
}
