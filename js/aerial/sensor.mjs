import * as THREE from '../vendor/three.module.js';
import { mergeGeometries } from '../vendor/aerial/BufferGeometryUtils.mjs';
import { scanPosition, scanDirection } from './state.mjs';

// A second surface pass, not an X-ray: ordinary depth testing keeps hidden walls
// hidden. Shader clipping bounds even triangles spanning the parcel boundary.
export function createSensor(scene, world) {
    const parts = world.children.map(mesh => {
        const geometry = mesh.geometry.clone();
        for (const key of Object.keys(geometry.attributes)) if (key !== 'position') geometry.deleteAttribute(key);
        return geometry;
    });
    const geometry = mergeGeometries(parts, false); parts.forEach(part => part.dispose());
    const material = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, depthTest: true,
        polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
        uniforms: { amount: { value: 0 }, sweep: { value: -9 }, direction: { value: 1 } },
        vertexShader: `varying vec3 surfacePosition;
            void main() { surfacePosition = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform float amount; uniform float sweep; uniform float direction; varying vec3 surfacePosition;
            float mark(float value, float spacing, float width) {
                float distanceToLine = abs(mod(value + spacing * .5, spacing) - spacing * .5);
                return 1.0 - smoothstep(width, width * 2.0, distanceToLine);
            }
            void main() {
                vec3 p = surfacePosition;
                if (p.x < -19.0 || p.x > 20.0 || p.z < -25.0 || p.z > 7.0) discard;
                float edge = min(min(p.x + 19.0, 20.0 - p.x), min(p.z + 25.0, 7.0 - p.z));
                float perimeter = 1.0 - smoothstep(.08, .18, edge);
                float grid = max(mark(p.x, 1.0, .018), mark(p.z, 1.0, .018));
                float contour = mark(p.y + .12 * sin(p.x * .5) + .16 * cos(p.z * .4), .35, .012);
                float head = exp(-pow((p.z - sweep) / .65, 2.0));
                float behind = (sweep - p.z) * direction;
                float trail = exp(-max(behind, 0.0) / 5.0) * step(0.0, behind);
                float alpha = amount * min(.8, perimeter * .65 + head * .4 + trail * (.055 + grid * .3 + contour * .12));
                gl_FragColor = vec4(vec3(.72, .83, .78), alpha);
            }`
    });
    const overlay = new THREE.Mesh(geometry, material); overlay.visible = false;
    scene.add(overlay);
    return { sensor(amount, time, reduced) {
        material.uniforms.amount.value = amount;
        material.uniforms.sweep.value = scanPosition(time, reduced);
        material.uniforms.direction.value = scanDirection(time, reduced);
        overlay.visible = amount > .001;
    } };
}
