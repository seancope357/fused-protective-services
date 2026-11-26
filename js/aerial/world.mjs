import * as THREE from '../vendor/three.module.js';
import { batchStatic } from './batch.mjs';
import { surface } from './visual-surfaces.mjs';
import { createVegetation } from './visual-vegetation.mjs';
import { createProperty } from './property.mjs';
import { createLandscape } from './landscape.mjs';

export function terrainHeight(x, z) {
    const away = Math.max(0, Math.min(1, (Math.hypot(x, z + 8) - 27) / 58));
    const eased = away * away * (3 - 2 * away);
    const hills = 2.1 + 1.8*Math.sin(x*.028 + z*.018) + 1.55*Math.sin(z*.035 - x*.012) + .7*Math.cos((x+z)*.045);
    return -.2 + eased * hills;
}
export function createWorld(scene) {
    const limestone = surface(0xb3ab95, .82), paving = surface(0xa9a698, .88, false, 'paving');
    const ground = surface(0x4c583a, 1, true), road = surface(0x383b39, .96, false, 'asphalt');
    const gravel = surface(0x787a69, 1, false, 'gravel'), timber = surface(0x785137, .69, false, 'timber');
    const metal = new THREE.MeshStandardMaterial({ color: 0x292e2e, roughness: .42, metalness: .72, envMapIntensity: .8 });
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xb3cfcc, roughness: .1, metalness: .15, transparent: true, opacity: .22, depthWrite: false, envMapIntensity: 1.3 });
    const interior = new THREE.MeshStandardMaterial({ color: 0x3d3527, roughness: 1 });
    const roof = surface(0x777970,.95,false,'roof');
    const fabric = surface(0xafa995, .96, false, 'fabric');
    const poolTile = surface(0x265d67, .52, false, 'pool-tile');
    const water = new THREE.MeshPhysicalMaterial({ color: 0x25728a, roughness: .08, metalness: .12, clearcoat: .8, clearcoatRoughness: .06, envMapIntensity: 1.25 });
    water.name = 'property-water';
    const glow = new THREE.MeshStandardMaterial({ color: 0xffdfae, emissive: 0xffb669, emissiveIntensity: 0 });
    const staticWorld = new THREE.Group();
    const fixtures = [];
    function box(w, h, d, x, y, z, material, castShadow = true) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
        mesh.position.set(x, y, z); mesh.castShadow = castShadow; mesh.receiveShadow = true; staticWorld.add(mesh); return mesh;
    }
    const terrain = new THREE.PlaneGeometry(550, 550, 96, 96); terrain.rotateX(-Math.PI/2);
    const positions = terrain.attributes.position;
    for (let i=0; i<positions.count; i++) positions.setY(i, terrainHeight(positions.getX(i), positions.getZ(i)));
    terrain.computeVertexNormals();
    const land = new THREE.Mesh(terrain, ground); land.receiveShadow = true; land.name = 'rolling-meadow'; staticWorld.add(land);
    // Level access drive, gravel shoulders and a generous forecourt. Curving
    // ribbons make the approach read as terrain-aware rather than an infinite
    // rectangular strip across the meadow.
    function ribbon(points, width, y, material) {
        const vertices = [], indices = [];
        for (let i = 0; i < points.length; i++) {
            const point = points[i], before = points[Math.max(0, i - 1)], after = points[Math.min(points.length - 1, i + 1)];
            const dx = after[0] - before[0], dz = after[1] - before[1], length = Math.hypot(dx, dz) || 1;
            const px = -dz / length * width / 2, pz = dx / length * width / 2;
            vertices.push(point[0] + px, terrainHeight(point[0] + px, point[1] + pz) + y, point[1] + pz);
            vertices.push(point[0] - px, terrainHeight(point[0] - px, point[1] - pz) + y, point[1] - pz);
            if (i) indices.push(i * 2 - 2, i * 2 - 1, i * 2, i * 2 - 1, i * 2 + 1, i * 2);
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setIndex(indices); geometry.computeVertexNormals();
        const mesh = new THREE.Mesh(geometry, material); mesh.receiveShadow = true; staticWorld.add(mesh);
    }
    const drive = [[7, 74], [7, 44], [6.2, 23], [8.7, 10], [7, 3.1]];
    ribbon(drive, 6.9, .09, gravel); ribbon(drive, 5.45, .155, road);
    box(10, .13, 8, 7, .01, 3, gravel);
    const property = createProperty(box, { limestone, paving, metal, timber, glass, interior, fabric, light: glow, roof, poolTile, water });
    // Perimeter rails remain within the fictional parcel, with an open vehicle approach.
    for (let x=-19; x<=19; x+=2) for (const z of [-25,7]) {
        if(z===7 && x>3 && x<11) continue;
        box(.13,1.5,.13,x,.65,z,metal);
        for(const y of [.45,1.1]) box(1.97,.065,.08,x+.92,y,z,metal);
    }
    for(const x of [-19,20]) for(let z=-25;z<7;z+=2) {
        box(.13,1.5,.13,x,.65,z,metal);
        for(const y of [.45,1.1]) box(.08,.065,2,x,y,z+1,metal);
    }
    // Actual local luminaires illuminate paving and walls at night, never fake telemetry.
    for(const [x,z] of [[-6,-7.8],[1,-7.8],[9,-7.8]]) {
        const lamp = new THREE.PointLight(0xffcc92, 0, 9, 2); lamp.position.set(x,2.9,z); scene.add(lamp); fixtures.push({lamp,power:38});
        box(.14,.24,.12,x,2.85,z-.35,glow,false);
    }
    for(const z of [3,10,18,26]) for(const x of [3.8,10.2]) {
        box(.12,.65,.12,x,.2,z,metal); box(.14,.06,.14,x,.55,z,glow,false);
    }
    // A single wide arrival fill avoids eight extra light loops per shaded fragment.
    const arrival = new THREE.PointLight(0xffd1a1,0,22,2); arrival.position.set(7,1.7,7); scene.add(arrival); fixtures.push({lamp:arrival,power:45});
    const trunk = surface(0x514737,1,false,'bark');
    const vegetation = createVegetation(scene,staticWorld,trunk,terrainHeight);
    createLandscape(scene,terrainHeight);
    const batched=batchStatic(staticWorld); batched.name='property-batches'; scene.add(batched);
    return {
        property, vegetation,
        setNight(amount) { glow.emissiveIntensity=amount*3.2; fixtures.forEach(({lamp,power})=>{lamp.intensity=power*amount;lamp.visible=amount>0;}); },
        stats:()=>({batches:batched.children.length,trees:vegetation.trees,property}),
    };
}
