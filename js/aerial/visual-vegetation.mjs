import * as THREE from '../vendor/three.module.js';

function randomSource(seed) {
    return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
// Original compound-leaf silhouette. A data texture keeps this deterministic and
// independent of canvas/browser APIs, with mipmaps to soften distant leaf edges.
function leafTexture() {
    const size = 128, pixels = new Uint8Array(size * size * 4), random = randomSource(971);
    for (let leaf = 0; leaf < 36; leaf++) {
        const cx = 16 + random() * 96, cy = 16 + random() * 96;
        const angle = random() * Math.PI, rx = 3 + random() * 3, ry = 6 + random() * 5;
        for (let y = Math.max(0, Math.floor(cy - 12)); y < Math.min(size, cy + 12); y++) {
            for (let x = Math.max(0, Math.floor(cx - 12)); x < Math.min(size, cx + 12); x++) {
                const u = (x-cx)*Math.cos(angle)+(y-cy)*Math.sin(angle);
                const v = -(x-cx)*Math.sin(angle)+(y-cy)*Math.cos(angle);
                if (u*u/(rx*rx)+v*v/(ry*ry) > 1) continue;
                const index = (y*size+x)*4;
                pixels[index] = pixels[index+1] = pixels[index+2] = 255;
                pixels[index+3] = 255;
            }
        }
    }
    const map = new THREE.DataTexture(pixels, size, size);
    map.generateMipmaps = true; map.minFilter = THREE.LinearMipmapLinearFilter;
    map.magFilter = THREE.LinearFilter; map.needsUpdate = true; return map;
}
export function createVegetation(scene, staticWorld, trunkMaterial) {
    const random = randomSource(821), trees = [];
    // Rejection-sampled woodland margins, with a clear arrival road and parcel.
    for (let i = 0; i < 110; i++) {
        const x = (random()-.5)*140, z = (random()-.5)*125-22;
        if (x > -27 && x < 28 && z > -32 && z < 18) continue;
        if (Math.abs(x-7) < 9 && z > 0) continue;
        if (trees.some(t => Math.hypot(t.x-x,t.z-z) < 6)) continue;
        trees.push({ x, z, height: 4 + random()*2.5, slender: random() > .65 });
        if (trees.length === 40) break;
    }
    const material = new THREE.MeshStandardMaterial({ color: 0x33483b, roughness: .94,
        map: leafTexture(), alphaTest: .45, side: THREE.DoubleSide, envMapIntensity: .3 });
    const cardsPerTree = 72;
    const leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), material, trees.length*cardsPerTree);
    const dummy = new THREE.Object3D(), color = new THREE.Color();
    function branch(start, end, radius) {
        const delta = end.clone().sub(start);
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius*.45, radius, delta.length(), 5), trunkMaterial);
        mesh.position.copy(start).add(end).multiplyScalar(.5);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), delta.normalize());
        mesh.castShadow = mesh.receiveShadow = true; staticWorld.add(mesh);
    }
    let index = 0;
    for (const tree of trees) {
        const { x, z, height, slender } = tree, width = slender ? 1.6 : 2.8;
        branch(new THREE.Vector3(x,0,z), new THREE.Vector3(x+.2,height,z), .16);
        for (let b = 0; b < 6; b++) {
            const angle = random()*Math.PI*2;
            branch(new THREE.Vector3(x,height*.45,z),
                new THREE.Vector3(x+Math.cos(angle)*width*.8,height*(.7+random()*.25),z+Math.sin(angle)*width*.8), .075);
        }
        for (let c = 0; c < cardsPerTree; c++) {
            const angle = random()*Math.PI*2, vertical = random()*2-1;
            const radius = Math.sqrt(1-vertical*vertical)*Math.cbrt(random());
            dummy.position.set(x+Math.cos(angle)*radius*width, height*.8+vertical*(slender ? 2.7 : 1.9), z+Math.sin(angle)*radius*width);
            dummy.rotation.set(random()*Math.PI, random()*Math.PI, random()*Math.PI);
            const scale = .85+random()*.8; dummy.scale.set(scale, scale, scale); dummy.updateMatrix();
            leaves.setMatrixAt(index, dummy.matrix);
            color.setHSL(.27+random()*.07, .18+random()*.12, .28+random()*.16);
            leaves.setColorAt(index++, color);
        }
    }
    // Outside the scan parcel: do not duplicate foliage in its solid surface pass.
    leaves.castShadow = false; leaves.receiveShadow = true; scene.add(leaves);
    return leaves;
}
