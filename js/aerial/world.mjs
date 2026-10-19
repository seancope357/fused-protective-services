import * as THREE from '../vendor/three.module.js';
import { batchStatic } from './batch.mjs';
import { createSensor } from './sensor.mjs';
import { surface } from './visual-surfaces.mjs';
import { createVegetation } from './visual-vegetation.mjs';
export function createWorld(scene) {
    const concrete = surface(0x8b897e, .87), stone = surface(0x545957, .88);
    const ground = surface(0x303d32, 1, true), road = surface(0x373e42, .96);
    const metal = new THREE.MeshStandardMaterial({ color: 0x343c40, roughness: .48, metalness: .65, envMapIntensity: .5 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x334a54, roughness: .13, metalness: .65, envMapIntensity: .9, emissive: 0xc48b4b, emissiveIntensity: .12 });
    const interior = new THREE.MeshStandardMaterial({ color: 0x9d8062, roughness: .75, emissive: 0xffc17d, emissiveIntensity: .55 });
    const staticWorld = new THREE.Group();
    function box(w, h, d, x, y, z, material) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
        mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; staticWorld.add(mesh); return mesh;
    }
    box(250, .4, 250, 0, -.3, 0, ground);
    box(5, .06, 60, 7, -.02, 21, road);
    box(23, .14, 14, 0, .02, -8, stone);
    box(15, 3.6, 7, -2, 1.9, -12, concrete);
    box(7, 3, 7, 8, 1.6, -12, stone);
    box(15.8, .3, 7.8, -2, 3.9, -12, metal);
    box(7.8, .3, 7.8, 8, 3.25, -12, metal);
    // Recessed glazing, stone reveals and a few warm occupied bays.
    box(10.3, 2.75, .12, -2, 1.8, -8.42, metal);
    box(10, 2.5, .08, -2, 1.8, -8.33, glass);
    for (const x of [-5.75, -2, 1.75]) box(1.15, 2.35, .02, x, 1.8, -8.275, interior);
    box(10.6, .13, .5, -2, .45, -8.2, stone);
    box(10.6, .16, .5, -2, 3.16, -8.2, concrete);
    // Thin coping and a recessed roof plane make the slab edge legible.
    box(15.3, .09, 7.3, -2, 4.09, -12, stone);
    box(7.3, .09, 7.3, 8, 3.44, -12, stone);
    for (let x = -10; x <= 10; x += 2) box(.018, .005, 13.8, x, .093, -8, metal);
    for (let z = -14; z <= -2; z += 2) box(22.8, .005, .018, 0, .093, z, metal);
    // Horizontal glazing transom and offset arrival steps.
    box(10, .045, .15, -2, 2.65, -8.24, metal);
    box(5.5, .12, 1.1, 6, .04, -.5, stone);
    for (let x = -7; x <= 3; x += 1.25) box(.07, 2.7, .18, x, 1.8, -8.22, metal);
    for (let x = -9; x < 12; x += 1.4) box(.09, .15, 2.7, x, 3.5, -6, metal);
    for (const x of [-9, 11]) box(.14, 3.5, .14, x, 1.8, -4.7, metal);
    box(21, .15, .15, 1, 3.5, -4.7, metal);
    // Warm architectural light belongs to the building, not a screen-space effect.
    for (const x of [-6, 1, 9]) {
        const light = new THREE.PointLight(0xffbd79, 12, 7, 2); light.position.set(x, 2.3, -7.5); scene.add(light);
        box(.16, .35, .1, x, 2.4, -8.3, interior);
    }
    // Perimeter fence, with a clear vehicle opening at the approach.
    for (let x = -19; x <= 19; x += 2) for (const z of [-25, 7]) {
        if (z === 7 && x > 3 && x < 11) continue;
        box(.12, 1.5, .12, x, .75, z, metal);
        box(1.95, .055, .07, x + .9, 1.2, z, metal);
        box(1.95, .055, .07, x + .9, .55, z, metal);
    }
    for (const x of [-19, 20]) for (let z = -25; z < 7; z += 2) {
        box(.12, 1.5, .12, x, .75, z, metal);
        box(.07, .055, 2, x, 1.2, z + 1, metal); box(.07, .055, 2, x, .55, z + 1, metal);
    }
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x39332e, roughness: 1 });
    createVegetation(scene, staticWorld, trunkMaterial);
    const batched = batchStatic(staticWorld);
    scene.add(batched);
    return createSensor(scene, batched);
}
