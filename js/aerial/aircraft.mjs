import * as THREE from '../vendor/three.module.js';
import { batchStatic } from './batch.mjs';

// Asset-specific evidence, not a heuristic for arbitrary Object_N meshes.
// Each row: blades, stacked motor rings (upper/lower), paired blade attachments.
const ANATOMY = [
    [[88, 91], [67, 70], [76, 79], [676, 680], 1],
    [[117, 120], [99, 102], [108, 111], [788, 788], 1],
    [[152, 155], [134, 131], [140, 143], [680, 676], -1],
    [[172, 178], [184, 163], [166, 169], [788, 788], -1],
];
const count = mesh => (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
const center = mesh => {
    mesh.geometry.computeBoundingBox();
    return mesh.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
};

function identify(meshes) {
    if (meshes.length !== 147 || meshes.reduce((n, m) => n + count(m), 0) !== 127011) return [];
    const byName = new Map(meshes.map(m => [m.name, m]));
    const found = [];
    for (const [blades, rings, attachments, counts, direction] of ANATOMY) {
        const get = ids => ids.map(id => byName.get(`Object_${id}`));
        const parts = get(blades), motors = get(rings), pins = get(attachments);
        if ([...parts, ...motors, ...pins].some(m => !m || Array.isArray(m.material))) return [];
        if (parts.some((m, i) => count(m) !== counts[i] || m.material.name !== 'jishen')) return [];
        // The authored transforms contain no motor-axis rotation: the tilt is
        // baked into vertices. Stacked concentric rings establish the real axis.
        const lower = center(motors[1]), axis = center(motors[0]).sub(lower).normalize();
        const pinCenters = pins.map(center), midpoint = pinCenters[0].clone().add(pinCenters[1]).multiplyScalar(.5);
        const pivot = lower.clone().addScaledVector(axis, midpoint.clone().sub(lower).dot(axis));
        const planeError = Math.max(...pinCenters.map(p => Math.abs(p.clone().sub(pivot).dot(axis))));
        const radii = parts.map(mesh => {
            const position = mesh.geometry.attributes.position, point = new THREE.Vector3(); let radius = 0;
            for (let i = 0; i < position.count; i++) {
                point.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld).sub(pivot);
                point.addScaledVector(axis, -point.dot(axis)); radius = Math.max(radius, point.length());
            }
            return radius;
        });
        const radius = Math.max(...radii), radialMismatch = Math.abs(radii[0] - radii[1]);
        const ringRadius = new THREE.Box3().setFromObject(motors[0]).getSize(new THREE.Vector3()).length() / 2;
        if (!Number.isFinite(radius) || radius <= 0 || planeError > radius * .01 || radialMismatch > radius * .03 || radius / ringRadius < 5 || radius / ringRadius > 9) return [];
        found.push({ nodes: parts.map(m => m.name), evidenceNodes: [...motors, ...pins].map(m => m.name), parts, pivot, axis, radius, planeError, radialMismatch, direction });
    }
    const radii = found.map(r => r.radius);
    return Math.max(...radii) / Math.min(...radii) < 1.05 ? found : [];
}

/** Consumes static source meshes/geometries like batchStatic; retains materials/maps.
 * Output coordinates are baked world coordinates, before controller normalization.
 */
export function prepareAircraft(root) {
    root.updateWorldMatrix(true, true);
    const meshes = []; root.traverse(m => { if (m.isMesh) meshes.push(m); });
    // Validate before mutating the source hierarchy.
    for (const m of meshes) if (m.isSkinnedMesh || Array.isArray(m.material) || Object.keys(m.geometry.morphAttributes).length) throw new Error('Unsupported aircraft geometry');
    const baselineTriangles = meshes.reduce((n, m) => n + count(m), 0);
    const rotors = identify(meshes), body = new THREE.Group();
    const animatedTriangles = rotors.reduce((sum, r) => sum + r.parts.reduce((n, m) => n + count(m), 0), 0);
    const rotorParts = new Set(rotors.flatMap(r => r.parts));
    const buckets = new Map(rotors.map(r => [r, new THREE.Group()]));
    // Preserve complete world matrices when detaching from the authored hierarchy.
    for (const mesh of meshes) {
        const matrix = mesh.matrixWorld.clone();
        const rotor = rotorParts.has(mesh) ? rotors.find(r => r.parts.includes(mesh)) : null;
        (rotor ? buckets.get(rotor) : body).add(mesh);
        mesh.matrixAutoUpdate = false; mesh.matrix.copy(matrix);
    }
    const object = batchStatic(body); object.name = 'prepared-aircraft';
    const bodyDraws = object.children.length;
    const blurMaterial = rotors.length ? new THREE.MeshStandardMaterial({ color: 0x606060, roughness: .8, metalness: 0, transparent: true, opacity: .085, depthWrite: false, side: THREE.DoubleSide }) : null;
    if (blurMaterial) blurMaterial.forceSinglePass = true;
    for (const rotor of rotors) {
        const group = batchStatic(buckets.get(rotor)); group.position.copy(rotor.pivot);
        for (const mesh of group.children) {
            mesh.geometry.translate(-rotor.pivot.x, -rotor.pivot.y, -rotor.pivot.z);
            mesh.geometry.computeBoundingBox(); mesh.geometry.computeBoundingSphere();
        }
        object.add(group); rotor.object = group;
        const blur = new THREE.Mesh(new THREE.RingGeometry(rotor.radius * .06, rotor.radius, 64), blurMaterial);
        blur.userData.rotorBlur = true; blur.name = `rotor-blur-${rotor.nodes[0]}`;
        blur.position.copy(rotor.pivot); blur.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), rotor.axis);
        blur.visible = false; rotor.blur = blur;
        delete rotor.parts;
    }
    let disposed = false;
    return {
        object, rotors,
        update(time, reduced = false) {
            // A visual phase only, not a measured or claimed aircraft RPM.
            const phase = Number.isFinite(time) ? time : 0;
            const moving = !reduced && phase > 0;
            for (const rotor of rotors) {
                if (moving) rotor.object.quaternion.setFromAxisAngle(rotor.axis, (phase * 24 % (Math.PI * 2)) * rotor.direction);
                else rotor.object.quaternion.identity();
                // Exposure-averaged surface avoids temporal aliasing of opaque blades.
                // Keep actual blades for inspection/reduced motion, not flashing spokes.
                rotor.object.visible = !moving; rotor.blur.visible = moving;
                if (moving && rotor.blur.parent !== object) object.add(rotor.blur);
                else if (!moving) rotor.blur.removeFromParent();
            }
        },
        stats() {
            return {
                rotorCount: rotors.length, baselineTriangles, bodyDraws,
                animatedTriangles,
                blurTriangles: rotors.length * 128,
                drawOverhead: rotors.length,
                aircraftDraws: bodyDraws + rotors.length,
                rotors: rotors.map(({ nodes, evidenceNodes, pivot, axis, radius, planeError, radialMismatch, direction }) => ({ nodes: [...nodes], evidenceNodes: [...evidenceNodes], pivot: pivot.toArray(), axis: axis.toArray(), radius, planeError, radialMismatch, direction })),
            };
        },
        // Own geometry and procedural material only. Artist materials/maps remain
        // controller-owned; include detached blur resources in every cleanup path.
        dispose() {
            if (disposed) return; disposed = true;
            const geometries = new Set(); object.traverse(m => { if (m.isMesh) geometries.add(m.geometry); });
            for (const rotor of rotors) geometries.add(rotor.blur.geometry);
            geometries.forEach(g => g.dispose()); blurMaterial?.dispose();
        },
    };
}
