import * as THREE from '../vendor/three.module.js';
import { createSky } from './visual-surfaces.mjs';

export function createLighting(scene, renderer, world) {
    const sky=createSky(scene);
    const hemisphere=new THREE.HemisphereLight(0xc7dce9,0x76745b,1.65);scene.add(hemisphere);
    const sun=new THREE.DirectionalLight(0xfff1d6,3.5);sun.position.set(-24,34,18);sun.target.position.set(0,0,-8);sun.castShadow=true;
    const mobile=(globalThis.innerWidth??1440)<700 || globalThis.matchMedia?.('(pointer: coarse)')?.matches;
    const mapSize=mobile?2048:4096;
    sun.shadow.mapSize.set(mapSize,mapSize);
    Object.assign(sun.shadow.camera,{left:-30,right:30,top:28,bottom:-32,near:1,far:95});
    sun.shadow.bias=-.00008;sun.shadow.normalBias=.035;sun.shadow.radius=2;
    scene.add(sun,sun.target);
    const rim=new THREE.DirectionalLight(0xd9e7f0,.35);rim.position.set(18,14,-18);scene.add(rim);
    const dayFog=new THREE.Color(0xa9bdc2),nightFog=new THREE.Color(0x0c182c);
    scene.fog=new THREE.FogExp2(dayFog,.0045);
    let mode='';
    return {
        setMode(value) {
            if(mode===value)return;
            mode=value;const night=value==='night';
            sky.setNight(Number(night));
            hemisphere.color.set(night?0x667da4:0xc7dce9);hemisphere.groundColor.set(night?0x202d26:0x76745b);hemisphere.intensity=night?.38:1.65;
            sun.color.set(night?0x93b6ed:0xfff1d6);sun.intensity=night?.4:3.5;
            rim.intensity=night?.12:.35;
            scene.fog.color.copy(night?nightFog:dayFog);scene.fog.density=night?.008:.0045;
            renderer.toneMappingExposure=night?1:.92;
            world.setNight(Number(night));renderer.shadowMap.needsUpdate=true;
        },
        stats:()=>({mode,shadowMapSize:mapSize}),
    };
}
