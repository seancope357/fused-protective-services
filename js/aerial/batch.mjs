import * as THREE from '../vendor/three.module.js';
import { mergeGeometries } from '../vendor/aerial/BufferGeometryUtils.mjs';

// Static, single-material meshes only. Bake world transforms before removing the
// hierarchy; retain original materials (including maps) and every vertex attribute.
export function batchStatic(root) {
    root.updateMatrixWorld(true);
    const groups = new Map(), originals = new Set(), meshes = [];
    root.traverse(mesh => {
        if (!mesh.isMesh) return;
        if (Array.isArray(mesh.material) || mesh.isSkinnedMesh || Object.keys(mesh.geometry.morphAttributes).length) throw new Error('Unsupported static batch geometry');
        const signature = Object.keys(mesh.geometry.attributes).sort().map(key => {
            const a = mesh.geometry.attributes[key]; return `${key}:${a.itemSize}:${a.normalized}:${a.array.constructor.name}`;
        }).join('|');
        const key = `${mesh.material.uuid}:${signature}:${mesh.castShadow}:${mesh.receiveShadow}`;
        if (!groups.has(key)) groups.set(key, { material: mesh.material, castShadow: mesh.castShadow, receiveShadow: mesh.receiveShadow, parts: [] });
        const clone = mesh.geometry.clone();
        const geometry = clone.index ? clone.toNonIndexed() : clone;
        if (geometry !== clone) clone.dispose();
        geometry.applyMatrix4(mesh.matrixWorld);
        // Baking a reflection removes the renderer's negative-determinant face
        // correction. Reverse winding and tangent handedness to preserve shading.
        if (mesh.matrixWorld.determinant() < 0) {
            for (const attribute of Object.values(geometry.attributes)) {
                for (let i = 0; i < attribute.count; i += 3) {
                    for (let c = 0; c < attribute.itemSize; c++) {
                        const a = (i + 1) * attribute.itemSize + c, b = (i + 2) * attribute.itemSize + c;
                        const value = attribute.array[a]; attribute.array[a] = attribute.array[b]; attribute.array[b] = value;
                    }
                }
            }
            const tangent = geometry.getAttribute('tangent');
            if (tangent) for (let i = 0; i < tangent.count; i++) tangent.setW(i, -tangent.getW(i));
        }
        groups.get(key).parts.push(geometry); originals.add(mesh.geometry); meshes.push(mesh);
    });
    const result = new THREE.Group();
    for (const group of groups.values()) {
        const geometry = mergeGeometries(group.parts, false);
        group.parts.forEach(part => part.dispose());
        if (!geometry) throw new Error('Static geometry batch failed');
        geometry.computeBoundingBox(); geometry.computeBoundingSphere();
        const mesh = new THREE.Mesh(geometry, group.material);
        mesh.castShadow = group.castShadow; mesh.receiveShadow = group.receiveShadow; result.add(mesh);
    }
    meshes.forEach(mesh => mesh.removeFromParent());
    originals.forEach(geometry => geometry.dispose());
    return result;
}
