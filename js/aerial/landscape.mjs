import * as THREE from '../vendor/three.module.js';
import {surface} from './visual-surfaces.mjs';

// Original, deterministic planting and limestone outcrops. Instanced geometry
// adds scale and contact detail without hundreds of independent draw calls.
function rockGeometry(detail=1) {
    const geometry=new THREE.IcosahedronGeometry(1,detail),p=geometry.attributes.position;
    for(let i=0;i<p.count;i++) {
        const x=p.getX(i),y=p.getY(i),z=p.getZ(i),r=.88+.12*Math.sin(x*17+z*11)+.07*Math.cos(y*23-x*9);
        p.setXYZ(i,x*r,y*r,z*r);
    }
    geometry.computeVertexNormals();return geometry;
}
export function createLandscape(scene, height) {
    let seed=32461;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const foliage=surface(0x9b9f80,1,false,'foliage');
    const shrubs=new THREE.InstancedMesh(rockGeometry(2),foliage,45);
    const rockMaterial=surface(0x77796c,.98,false,'rock');
    const rocks=new THREE.InstancedMesh(rockGeometry(),rockMaterial,60);
    const dummy=new THREE.Object3D(),color=new THREE.Color();
    for(let i=0;i<45;i++) {
        let x,z,y,scale;
        if(i<9) {
            const planters=[[-10,-3],[10,-3],[-10,-14]],base=planters[Math.floor(i/3)];
            x=base[0]+(random()-.5)*.5;z=base[1]+(random()-.5)*.5;y=1.08;scale=.28+random()*.15;
        } else {
            x=(i%2?1:-1)*(13.5+random()*3);z=-19+random()*22;scale=.35+random()*.45;y=height(x,z)+scale*.55;
        }
        dummy.position.set(x,y,z);dummy.rotation.set(random()*.7,random()*6,random()*.4);
        dummy.scale.set(scale*1.2,scale*.8,scale);dummy.updateMatrix();shrubs.setMatrixAt(i,dummy.matrix);
        color.setHSL(.2+random()*.07,.12+random()*.15,.38+random()*.12);shrubs.setColorAt(i,color);
    }
    for(let i=0;i<60;i++) {
        const x=(i%2?1:-1)*(13+random()*4),z=-20+random()*26,s=.15+random()*.3;
        dummy.position.set(x,height(x,z)+s*.3,z);dummy.rotation.set(random()*2,random()*6,random()*2);
        dummy.scale.set(s*1.5,s*.55,s);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);
    }
    // Tufts have broad tapered blades rather than one-pixel lines.
    const vertices=[];
    for(let i=0;i<3;i++) {
        const a=i*Math.PI/3,dx=Math.cos(a)*.065,dz=Math.sin(a)*.065;
        vertices.push(-dx,0,-dz,dx,0,dz,dx*.25,.48,dz*.25,-dx,0,-dz,dx*.25,.48,dz*.25,-dx*.25,.48,-dz*.25);
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();
    const grassMaterial=new THREE.MeshStandardMaterial({color:0x777e50,roughness:1,side:THREE.DoubleSide});
    const grasses=new THREE.InstancedMesh(geometry,grassMaterial,1600);
    for(let i=0;i<1600;i++) {
        const x=(i%2?1:-1)*(12.5+random()*8),z=-24+random()*34,s=.4+random()*.7;
        dummy.position.set(x,height(x,z),z);dummy.rotation.set(0,random()*6,0);dummy.scale.set(s,s,s);dummy.updateMatrix();grasses.setMatrixAt(i,dummy.matrix);
        color.setHSL(.19+random()*.08,.15+random()*.2,.4+random()*.12);grasses.setColorAt(i,color);
    }
    shrubs.name='planted-borders';rocks.name='limestone-outcrops';grasses.name='meadow-tufts';
    for(const mesh of [shrubs,rocks,grasses]) {mesh.castShadow=mesh!==grasses;mesh.receiveShadow=true;scene.add(mesh);}
}
