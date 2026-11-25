// Brock & Tod render clock and fox pose blend, shared by the render files.
// state.time keeps running while paused, so everything that animates from time
// uses this clock instead. It stops in 'paused'. Module level values are only a
// cache and can be rebuilt at any time (a missing history just starts a pose
// at its target).

const BLEND_TIME = 0.2;
const MAX_STEP = 0.25;

const clock = { stamp: null, time: 0, dt: 0 };

// Pose blend for the fox: taunt and sprint go 0 to 1. tail is the tail wag phase.
// calm mirrors state.reduceMotion so the sprite can halve its swing.
export const foxPose = { taunt: 0, sprint: 0, tail: 0, straight: 0, calm: false };

// Start of each timed effect on the render clock, keyed by name.
const effects = {};

function approach(v, target, step) {
    if (v < target) return Math.min(target, v + step);
    return Math.max(target, v - step);
}

/**
 * Advance the clock and the fox pose. Call once at the top of drawScene.
 * Safe to call again with the same state.time (it does nothing).
 */
export function updateAnim(state) {
    foxPose.calm = !!state.reduceMotion;
    const now = state.time || 0;
    if (clock.stamp === null) clock.stamp = now;
    if (now === clock.stamp) return;
    let dt = now - clock.stamp;
    clock.stamp = now;
    if (!(dt > 0)) dt = 0;
    if (dt > MAX_STEP) dt = MAX_STEP;
    if (state.mode === 'paused') {
        clock.dt = 0;
        return;
    }
    clock.dt = dt;
    clock.time += dt;

    const phase = (state.fox && state.fox.phase) || 'cruise';
    const step = dt / BLEND_TIME;
    // Riding straight (snake hit) overrides the taunt and sprint poses.
    const straight = state.fox && state.fox.straight > 0;
    foxPose.straight = approach(foxPose.straight, straight ? 1 : 0, step);
    foxPose.taunt = approach(foxPose.taunt, phase === 'taunt' && !straight ? 1 : 0, step);
    foxPose.sprint = approach(foxPose.sprint, phase === 'sprint' && !straight ? 1 : 0, step);
    // Slow wag when taunting, quick and small when sprinting.
    const freq = 5 + (2.6 - 5) * foxPose.taunt + (7 - 5) * foxPose.sprint;
    foxPose.tail += dt * freq;
}

/** Seconds of animation time, frozen while paused. */
export function animTime() {
    return clock.time;
}

/**
 * Seconds since a timed effect started, on the render clock so it holds still
 * while paused. stamp is the state.time value the logic recorded for the effect
 * and name keys the cache. Returns -1 when there is no effect.
 */
export function effectAge(name, stamp, state) {
    if (typeof stamp !== 'number' || !(stamp > 0)) return -1;
    let e = effects[name];
    if (!e || e.stamp !== stamp) {
        const age = Math.max(0, (state.time || 0) - stamp);
        e = effects[name] = { stamp: stamp, start: clock.time - age };
    }
    return clock.time - e.start;
}
