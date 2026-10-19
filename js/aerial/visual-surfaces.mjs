import * as THREE from '../vendor/three.module.js';

// World-space value noise avoids stretching or repeating a tiny bitmap over land.
const noise = `
float hashSurface(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noiseSurface(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(hashSurface(i), hashSurface(i+vec2(1,0)), f.x),
        mix(hashSurface(i+vec2(0,1)), hashSurface(i+vec2(1,1)), f.x), f.y);
}`;
export function surface(color, roughness, terrain = false) {
    const material = new THREE.MeshStandardMaterial({ color, roughness, envMapIntensity: .35 });
    material.customProgramCacheKey = () => `aerial-surface-${terrain}`;
    material.onBeforeCompile = shader => {
        shader.vertexShader = 'varying vec3 vSurfaceWorld;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
            '#include <begin_vertex>\nvSurfaceWorld = (modelMatrix * vec4(position, 1.0)).xyz;');
        shader.fragmentShader = 'varying vec3 vSurfaceWorld;\n' + noise + '\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
            #include <color_fragment>
            vec2 p = vSurfaceWorld.xz;
            float grain = noiseSurface(p * 7.0);
            float patches = noiseSurface(p * .12) * .65 + noiseSurface(p * .43) * .35;
            diffuseColor.rgb *= ${terrain ? '.68 + .43 * patches + .025 * grain' : '.94 + .045 * patches + .025 * grain'};
            ${terrain ? `
            // Ground contact under the terrace and a restrained transition into meadow.
            vec2 d = max(abs(p - vec2(0,-8)) - vec2(11.5,7), 0.0);
            float contact = 1.0 - exp(-length(d) * 2.5);
            diffuseColor.rgb *= .62 + .38 * contact;` : ''}
        `);
        shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>',
            '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor + .05 * (grain - .5), .05, 1.0);');
    };
    return material;
}

export function createSky(scene) {
    const material = new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false,
        vertexShader: `varying vec3 direction;
            void main() { direction = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `varying vec3 direction;
            void main() {
                vec3 d = normalize(direction);
                float elevation = max(d.y, 0.0);
                vec3 horizon = vec3(.115,.175,.225);
                vec3 zenith = vec3(.012,.031,.075);
                vec3 sky = mix(horizon, zenith, pow(smoothstep(0.0,.8,elevation),.55));
                float dusk = pow(max(dot(d, normalize(vec3(1.0,.04,-.6))),0.0), 12.0);
                sky += vec3(.065,.028,.008) * dusk * exp(-elevation * 9.0);
                gl_FragColor = vec4(sky,1.0);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }`
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(180, 32, 16), material);
    sky.renderOrder = -1; scene.add(sky);
}
