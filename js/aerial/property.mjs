import * as THREE from '../vendor/three.module.js';

// Dimensions are metres. Solid walls stop at the window reveals; glazing and
// interior surfaces occupy separate planes instead of fighting a solid facade.
export function createProperty(box, materials) {
    const { limestone, paving, metal, timber, glass, interior, fabric, light, roof } = materials;
    box(24, .26, 15, 0, .03, -8, paving);
    box(15, .2, 7, -2, .28, -12, paving);
    // Main living pavilion: rear/side walls, solid piers and deep shaded reveals.
    box(15, 3.5, .3, -2, 2.1, -15.35, limestone);
    for (const x of [-9.35, 5.35]) box(.3, 3.5, 7, x, 2.1, -12, limestone);
    for (const x of [-8.6, 4.6]) box(1.2, 3.5, .35, x, 2.1, -8.65, limestone);
    box(12.1, .36, .38, -2, 3.66, -8.65, limestone);
    box(12.1, .14, .5, -2, .46, -8.55, paving);
    box(11.8, 2.94, .035, -2, 2.04, -8.79, glass, false);
    for (let x = -7.9; x <= 4; x += 1.98) box(.055, 3.02, .12, x, 2.02, -8.73, metal);
    box(12, .045, .12, -2, 2.91, -8.73, metal);
    // Ceiling, roof edge, recessed roof bed and parapet coping have real separation.
    box(15.8, .23, 7.8, -2, 3.96, -12, metal);
    for(const z of [-15.51,-8.49]) box(15.2,.12,.18,-2,4.14,z,limestone);
    for(const x of [-9.51,5.51]) box(.18,.12,6.84,x,4.14,-12,limestone);
    box(14.82,.06,6.82,-2,4.105,-12,roof);
    // A separate service wing starts beyond the pavilion wall, with an expansion joint.
    box(5.8, 3.1, 7, 8.6, 1.88, -12, limestone);
    box(6.3, .22, 7.8, 8.6, 3.57, -12, metal);
    box(5.8, .12, 7.2, 8.6, 3.75, -12, limestone);
    box(3.5, 2.7, .12, 8.5, 1.75, -8.43, timber);
    for (let x = 6.82; x <= 10.2; x += .13) box(.035, 2.7, .055, x, 1.75, -8.32, metal);
    box(.045, .55, .045, 9.85, 1.7, -8.25, metal);
    // Timber brise-soleil, with sufficiently thick beams to retain their silhouette.
    for (let x = -9; x < 11.5; x += .48) box(.09, .18, 3.6, x, 3.45, -6.4, timber);
    for (const x of [-9, 11.3]) box(.14, 3.3, .14, x, 1.82, -4.7, metal);
    box(20.5, .18, .18, 1.15, 3.45, -4.7, metal);
    // The room is occupied: floor, wall panels, sofa, cushions, table and dining set.
    box(14, .07, 6, -2, .44, -12, timber);
    box(5, 2.9, .12, -4.5, 1.94, -15.1, timber);
    box(3.5, .48, 1.1, -4.4, .79, -11.7, fabric);
    box(3.5, .7, .24, -4.4, 1.22, -12.2, fabric);
    for (const x of [-5.6, -4.4, -3.2]) box(1.08, .12, .85, x, 1.07, -11.64, fabric);
    box(2.1, .12, .85, -4.4, .89, -10.0, timber);
    for (const x of [-5.2, -3.6]) box(.07, .4, .07, x, .62, -10, metal);
    box(2.5, .12, 1.05, 1.6, 1.18, -12.0, timber);
    for (const x of [.6, 2.6]) for (const z of [-12.8, -11.2]) {
        box(.45, .1, .45, x, .86, z, fabric); box(.45, .6, .09, x, 1.13, z + (z < -12 ? -.2 : .2), timber);
    }
    box(6, .035, .06, -4, 3.74, -10.8, light, false);
    // Broad arrival steps do not intersect the terrace top or each other.
    for (let i = 0; i < 3; i++) box(5.8, .08, .75, 7, .06 - i*.08, -.15 + i*.75, paving);
    // Outdoor furnishings and raised planters give the terrace a domestic scale.
    for (const x of [-6, -2]) {
        box(1.8, .36, .7, x, .49, -4.5, fabric);
        box(1.8, .48, .1, x, .83, -4.84, timber);
    }
    box(1.1, .38, .7, -4, .48, -3.7, limestone);
    for (const [x,z] of [[-10,-3],[10,-3],[-10,-14]]) {
        box(1.2, .65, 1.2, x, .48, z, limestone);
        box(1.04, .06, 1.04, x, .84, z, interior);
    }
    return { frontWall: -8.65, glazing: -8.79, roofTop: 4.2, terraceTop: .16, wingStart: 5.7, pavilionEnd: 5.5 };
}
