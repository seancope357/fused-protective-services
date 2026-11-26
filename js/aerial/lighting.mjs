import * as THREE from '../vendor/three.module.js';
import { createSky } from './visual-surfaces.mjs';

export function createLighting(scene, renderer, world) {
    const sky=createSky(scene);
    const hemisphere=new THREE.HemisphereLight(0xb9d4df,0x5d6048,1.28);scene.add(hemisphere);
    const sun=new THREE.DirectionalLight(0xffebcb,3.05);sun.position.set(-24,34,18);sun.target.position.set(0,0,-8);sun.castShadow=true;
    const mobile=(globalThis.innerWidth??1440)<700 || globalThis.matchMedia?.('(pointer: coarse)')?.matches;
    const mapSize=mobile?2048:4096;
    sun.shadow.mapSize.set(mapSize,mapSize);
    Object.assign(sun.shadow.camera,{left:-30,right:30,top:28,bottom:-32,near:1,far:95});
    sun.shadow.bias=-.00008;sun.shadow.normalBias=.035;sun.shadow.radius=2;
    scene.add(sun,sun.target);
    const rim=new THREE.DirectionalLight(0xd9e7f0,.35);rim.position.set(18,14,-18);scene.add(rim);
    const dayFog=new THREE.Color(0x819fa0),nightFog=new THREE.Color(0x0c182c);
    scene.fog=new THREE.FogExp2(dayFog,.00265);
    let mode='';
    return {
        setMode(value) {
            if(mode===value)return;
            mode=value;const night=value==='night';
            sky.setNight(Number(night));
            hemisphere.color.set(night?0x667da4:0xb9d4df);hemisphere.groundColor.set(night?0x202d26:0x5d6048);hemisphere.intensity=night?.38:1.28;
            sun.color.set(night?0x93b6ed:0xffebcb);sun.intensity=night?.4:3.05;
            rim.intensity=night?.12:.35;
            scene.fog.color.copy(night?nightFog:dayFog);scene.fog.density=night?.008:.00265;
            renderer.toneMappingExposure=night?1:.84;
            world.setNight(Number(night));renderer.shadowMap.needsUpdate=true;
        },
        stats:()=>({mode,shadowMapSize:mapSize}),
    };
}
