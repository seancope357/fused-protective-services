import * as THREE from '../vendor/three.module.js';

// Original world-space finishes. Derivative-filtered joints stay legible without
// subpixel mesh strips or a bitmap stretched across the entire property.
const noise = `
float hashSurface(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noiseSurface(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(hashSurface(i), hashSurface(i+vec2(1,0)), f.x),
        mix(hashSurface(i+vec2(0,1)), hashSurface(i+vec2(1,1)), f.x), f.y);
}
float surfaceJoint(vec2 p, vec2 size, float width) {
    vec2 grid = abs(fract(p / size + .5) - .5) * size;
    vec2 aa = max(fwidth(p), vec2(.0005));
    vec2 lines = 1.0 - smoothstep(vec2(width), vec2(width) + aa, grid);
    return max(lines.x, lines.y);
}`;
export function surface(color, roughness, terrain = false, finish = 'stone') {
    const material = new THREE.MeshStandardMaterial({ color, roughness, envMapIntensity: .65 });
    material.name = `property-${terrain ? 'terrain' : finish}`;
    material.customProgramCacheKey = () => `aerial-surface-${terrain}-${finish}-v2`;
    material.onBeforeCompile = shader => {
        shader.vertexShader = 'varying vec3 vSurfaceWorld;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
            `#include <begin_vertex>
vec4 surfaceLocal=vec4(position,1.0);
#ifdef USE_INSTANCING
surfaceLocal=instanceMatrix*surfaceLocal;
#endif
vSurfaceWorld=(modelMatrix*surfaceLocal).xyz;`);
        shader.fragmentShader = 'varying vec3 vSurfaceWorld;\n' + noise + '\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
            #include <color_fragment>
            vec3 wp = vSurfaceWorld;
            vec3 wn = abs(normalize(cross(dFdx(wp), dFdy(wp))));
            vec2 p = wn.y > .5 ? wp.xz : (wn.x > .5 ? wp.zy : wp.xy);
            float grain = noiseSurface(p * 23.0);
            float detailFade = 1.0 - smoothstep(.025, .14, length(fwidth(p)));
            float patches = noiseSurface(p * .17) * .6 + noiseSurface(p * 1.7) * .4;
            float joint = 0.0;
            float heightSurface = .003 * grain * detailFade;
            ${terrain ? `
                float meadow = noiseSurface(p * .035) * .5 + noiseSurface(p * .19) * .5;
                diffuseColor.rgb *= .74 + .36 * meadow + .065 * (grain - .5) * detailFade;
                diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.11,.105,.066), .12 * patches);
                heightSurface = .012 * patches;` : finish === 'paving' ? `
                joint = surfaceJoint(p, vec2(1.6,.8), .008);
                float slab = hashSurface(floor(p / vec2(1.6,.8) + .5));
                diffuseColor.rgb *= .87 + .13 * slab + .045 * patches;
                diffuseColor.rgb *= 1.0 - .35 * joint;` : finish === 'stone' ? `
                vec2 masonry = vec2(p.x + mod(floor(p.y/.32),2.0)*.48, p.y);
                joint = wn.y > .5 ? 0.0 : surfaceJoint(masonry, vec2(.96,.32), .006);
                diffuseColor.rgb *= .84 + .2 * patches + .045 * grain * detailFade;
                diffuseColor.rgb *= 1.0 - .22 * joint;` : finish === 'foliage' ? `
                float foliage = noiseSurface(p*15.0)*.6 + noiseSurface(p*37.0)*.4;
                diffuseColor.rgb *= .62 + .5*foliage;
                heightSurface = .015*foliage*detailFade;
            ` : finish === 'rock' ? `
                float strata = noiseSurface(vec2(p.x*3.0,p.y*12.0));
                diffuseColor.rgb *= .65 + .28*patches + .12*strata;
                heightSurface = .014*grain*detailFade;
            ` : finish === 'timber' ? `
                float wood = noiseSurface(p * vec2(3.0,65.0));
                diffuseColor.rgb *= .72 + .28 * wood;
                heightSurface = .002 * wood * detailFade;` : `
                diffuseColor.rgb *= .96 + .04 * patches;`}
        `);
        shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>',
            '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor + .09 * (grain - .5), .08, 1.0);');
        shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `
            #include <normal_fragment_maps>
            vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
            vec3 r1 = cross(sy, normal), r2 = cross(normal, sx);
            float determinantSurface = dot(sx, r1);
            vec3 gradientSurface = sign(determinantSurface) * (dFdx(heightSurface)*r1 + dFdy(heightSurface)*r2);
            normal = normalize(abs(determinantSurface)*normal - gradientSurface);
        `);
    };
    return material;
}

export function createSky(scene) {
    const material = new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false,
        uniforms: { night: { value: 0 } },
        vertexShader: `varying vec3 direction;
            void main() { direction = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform float night; varying vec3 direction;
            void main() {
                vec3 d = normalize(direction);
                float elevation = max(d.y, 0.0);
                vec3 horizon = mix(vec3(.68,.76,.78), vec3(.045,.075,.13), night);
                vec3 zenith = mix(vec3(.14,.36,.61), vec3(.003,.009,.029), night);
                vec3 sky = mix(horizon, zenith, pow(smoothstep(0.0,.9,elevation),.45));
                float sun = max(dot(d, normalize(vec3(-.55,.7,.4))),0.0);
                sky += (1.0-night) * vec3(1.0,.79,.5) * (pow(sun,700.0)*6.0 + pow(sun,12.0)*.1);
                float clouds = sin(d.x*19.0+d.z*9.0) * sin(d.z*26.0-d.x*8.0);
                sky += (1.0-night) * .035 * smoothstep(.05,.7,elevation) * clouds;
                gl_FragColor = vec4(sky,1.0);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }`
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(280, 32, 16), material);
    sky.name = 'property-sky'; sky.renderOrder = -1; scene.add(sky);
    return { setNight(amount) { material.uniforms.night.value = amount; } };
}
