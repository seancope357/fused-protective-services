import * as THREE from '../vendor/three.module.js';

function randomSource(seed) {
    return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}
// Original compound-leaf silhouette. A data texture keeps this deterministic and
// independent of canvas/browser APIs, with mipmaps to soften distant leaf edges.
function leafTexture() {
    const size = 256, pixels = new Uint8Array(size * size * 4), random = randomSource(971);
    // White RGB even in transparent texels prevents dark mip/filter fringes.
    for(let i=0;i<pixels.length;i+=4) pixels[i]=pixels[i+1]=pixels[i+2]=255;
    for (let leaf = 0; leaf < 70; leaf++) {
        const cx = 24 + random() * 208, cy = 24 + random() * 208;
        const angle = random() * Math.PI, rx = 5 + random() * 5, ry = 10 + random() * 10;
        for (let y = Math.max(0, Math.floor(cy - 22)); y < Math.min(size, cy + 22); y++) {
            for (let x = Math.max(0, Math.floor(cx - 22)); x < Math.min(size, cx + 22); x++) {
                const u = (x-cx)*Math.cos(angle)+(y-cy)*Math.sin(angle);
                const v = -(x-cx)*Math.sin(angle)+(y-cy)*Math.cos(angle);
                const ellipse = u*u/(rx*rx)+v*v/(ry*ry);
                if (ellipse > 1.15) continue;
                const index = (y*size+x)*4;
                pixels[index] = pixels[index+1] = pixels[index+2] = 255;
                pixels[index+3] = Math.max(pixels[index+3], Math.round(255 * Math.max(0, Math.min(1, (1.1-ellipse)*9))));
            }
        }
    }
    const map = new THREE.DataTexture(pixels, size, size);
    map.generateMipmaps = true; map.minFilter = THREE.LinearMipmapLinearFilter;
    map.magFilter = THREE.LinearFilter; map.needsUpdate = true; return map;
}
function crownGeometry() {
    const geometry=new THREE.IcosahedronGeometry(1,2),p=geometry.attributes.position;
    for(let i=0;i<p.count;i++) {
        const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
        const r=.9+.075*Math.sin(x*21+y*13)+.065*Math.sin(y*19-z*17)+.045*Math.cos(z*27+x*11);
        p.setXYZ(i,x*r,y*r,z*r);
    }
    geometry.computeVertexNormals();return geometry;
}
export function createVegetation(scene, staticWorld, trunkMaterial, terrainHeight = () => -.2) {
    const random = randomSource(821), trees = [];
    // Rejection-sampled woodland margins, with a clear arrival road and parcel.
    for (let i = 0; i < 200; i++) {
        const x = (random()-.5)*185, z = (random()-.5)*165-26;
        if (x > -27 && x < 28 && z > -32 && z < 18) continue;
        if (Math.abs(x-7) < 9 && z > 0) continue;
        if (trees.some(t => Math.hypot(t.x-x,t.z-z) < 6)) continue;
        trees.push({ x, z, height: 4 + random()*2.5, slender: random() > .65 });
        if (trees.length === 55) break;
    }
    const material = new THREE.MeshStandardMaterial({ color: 0xb3bd9c, roughness: .94,
        map: leafTexture(), alphaTest: .25, alphaToCoverage: true, side: THREE.DoubleSide, envMapIntensity: .6 });
    const cardsPerTree = 168;
    const leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), material, trees.length*cardsPerTree);
    const dummy = new THREE.Object3D(), color = new THREE.Color();
    // Solid, smooth inner crowns stop the see-through confetti silhouette. Leaf
    // sprays provide the irregular edges, with MSAA alpha-to-coverage for distance.
    const crownMaterial = new THREE.MeshStandardMaterial({color:0x8d9977,roughness:1,envMapIntensity:.6});
    const crowns = new THREE.InstancedMesh(crownGeometry(),crownMaterial,trees.length*5);
    let crownIndex=0;
    function branch(start, end, radius) {
        const delta = end.clone().sub(start);
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius*.45, radius, delta.length(), 8), trunkMaterial);
        mesh.position.copy(start).add(end).multiplyScalar(.5);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), delta.normalize());
        mesh.castShadow = mesh.receiveShadow = true; staticWorld.add(mesh);
    }
    let index = 0;
    for (const tree of trees) {
        const { x, z, height, slender } = tree, width = slender ? 1.9 : 3.2;
        const groundY=terrainHeight(x,z);
        for(let c=0;c<5;c++) {
            const angle=c*Math.PI*.4, radius=c===0?0:width*.5;
            dummy.position.set(x+Math.cos(angle)*radius,groundY+height*.83+(c===0?.5:0),z+Math.sin(angle)*radius);
            dummy.rotation.set(random()*.3,random()*6,random()*.3);
            dummy.scale.set(width*.54,height*.17,width*.54);dummy.updateMatrix();
            crowns.setMatrixAt(crownIndex,dummy.matrix);
            color.setHSL(.23+random()*.055,.2+random()*.15,.36+random()*.12);crowns.setColorAt(crownIndex++,color);
        }
        branch(new THREE.Vector3(x,groundY,z), new THREE.Vector3(x+.2,groundY+height,z), .16);
        for (let b = 0; b < 6; b++) {
            const angle = random()*Math.PI*2;
            branch(new THREE.Vector3(x,groundY+height*.45,z),
                new THREE.Vector3(x+Math.cos(angle)*width*.8,groundY+height*(.7+random()*.25),z+Math.sin(angle)*width*.8), .075);
        }
        for (let c = 0; c < cardsPerTree; c++) {
            const angle = random()*Math.PI*2, vertical = random()*2-1;
            const radius = Math.sqrt(1-vertical*vertical)*Math.cbrt(random());
            dummy.position.set(x+Math.cos(angle)*radius*width, groundY+height*.8+vertical*(slender ? 2.7 : 1.9), z+Math.sin(angle)*radius*width);
            dummy.rotation.set(random()*Math.PI, random()*Math.PI, random()*Math.PI);
            const scale = 1.2+random()*.9; dummy.scale.set(scale, scale, scale); dummy.updateMatrix();
            leaves.setMatrixAt(index, dummy.matrix);
            color.setHSL(.23+random()*.07, .2+random()*.15, .4+random()*.18);
            leaves.setColorAt(index++, color);
        }
    }
    // Outside the scan parcel: do not duplicate foliage in its solid surface pass.
    leaves.castShadow = true; leaves.receiveShadow = true;
    crowns.castShadow = true; crowns.receiveShadow = true;
    leaves.name='leaf-sprays'; crowns.name='tree-crowns';scene.add(crowns,leaves);
    return { leaves,crowns,trees:trees.length };
}
