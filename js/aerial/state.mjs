import { storyPose, sensorEnvelope } from './choreography.mjs';

export const clampProgress = value => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
export const initialState = reduced => ({ paused: reduced, sensor: null, inspect: false, yaw: 0, pitch: 0, progress: 0 });
export const rotate = (state, x, y) => ({ yaw: Math.max(-.6, Math.min(.6, state.yaw + x)), pitch: Math.max(-.3, Math.min(.3, state.pitch + y)) });
// Scene metres: one coherent physical world, including the hero close-up.
export const aircraftSpan = 1.8;
export const aircraftPosition = [2.5, 10.5, 1];
export const exitInspection = state => ({ ...state, inspect: false, yaw: 0, pitch: 0 });
export const pixelRatio = (dpr, width, coarse = false) => Math.min(Math.max(1, dpr || 1), coarse || width < 700 ? 1 : 2);
export const scanPosition = (time, reduced = false) => reduced ? -9 : -9 + 16 * Math.sin(time * .35);
export const scanDirection = (time, reduced = false) => reduced || Math.cos(time * .35) >= 0 ? 1 : -1;
// null follows the scroll chapter; an explicit view choice overrides it.
export const sensorTarget = (progress, enabled) => enabled === null ? sensorEnvelope(progress) : Number(enabled);
export const dampFactor = delta => 1 - Math.exp(-Math.max(0, Number.isFinite(delta) ? delta : 0) * 12);
export const needsFrame = (state, reduced, amount) => (!state.paused && !reduced) || Math.abs(sensorTarget(state.progress, state.sensor) - amount) > .001;
export function cameraPose(progress, reduced = false, aspect = 1.5) {
    return storyPose(reduced ? 0 : progress, aspect);
}
