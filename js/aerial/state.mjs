import { storyPose } from './choreography.mjs';
export const clampProgress = value => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
export const initialState = reduced => ({ paused: reduced, timeOfDay: 'day', progress: 0 });
export const timeOfDay = value => value === 'night' ? 'night' : 'day';
export const aircraftSpan = 1.8;
export const aircraftPosition = [2.5, 10.5, 1];
// Retain actual phone detail instead of forcing every coarse-pointer screen to DPR 1.
export const pixelRatio = (dpr, width, coarse = false) => Math.min(Math.max(1, dpr || 1), coarse || width < 700 ? 1.75 : 2);
export const dampFactor = delta => 1 - Math.exp(-Math.max(0, Number.isFinite(delta) ? delta : 0) * 12);
export const needsFrame = (state, reduced) => !state.paused && !reduced;
export function cameraPose(progress, reduced = false, aspect = 1.5) {
    return storyPose(reduced ? 0 : progress, aspect);
}
