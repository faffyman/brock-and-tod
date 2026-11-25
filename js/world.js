// Game state and simulation. No DOM access, so it runs in Node.
import { CONFIG } from './config.js';

const FIRST_RAMP_DISTANCE = 120;

function rand(min, max) {
    return min + Math.random() * (max - min);
}

function randomVariant() {
    return Math.floor(Math.random() * CONFIG.treeVariants);
}

function randomX(centre) {
    return centre + (Math.random() * 2 - 1) * CONFIG.fieldHalfWidth;
}

function treeTotal(state) {
    return CONFIG.difficulties[state.difficulty].treeCount;
}

function inCorridor(state, x, z) {
    for (const ramp of state.ramps) {
        if (z >= ramp.z && z <= ramp.z + CONFIG.landingClearLength &&
            Math.abs(x - ramp.x) < CONFIG.landingClearHalfWidth) {
            return true;
        }
    }
    return false;
}

// Pickup clearance: no tree within this sideways and along z of a pickup,
// and no pickup within rampHalfWidth + 1 sideways and 8 m along z of a ramp.
const PICKUP_TREE_X = 1.5;
const PICKUP_TREE_Z = 5;
const PICKUP_RAMP_X = CONFIG.rampHalfWidth + 1;
const PICKUP_RAMP_Z = 8;

function nearPickup(state, x, z) {
    for (const p of state.pickups) {
        if (Math.abs(p.x - x) < PICKUP_TREE_X && Math.abs(p.z - z) < PICKUP_TREE_Z) return true;
    }
    return false;
}

function onRamp(state, x, z) {
    for (const ramp of state.ramps) {
        if (Math.abs(ramp.x - x) < PICKUP_RAMP_X && Math.abs(ramp.z - z) < PICKUP_RAMP_Z) return true;
    }
    return false;
}

// Hazard helpers. A hazard is a plain object; a bear also keeps a hidden link to its tree.
const NEVER = 1e12;
const HAZARD_END_Z = 10;       // end clearance and bear clearance apply within this along z
const HAZARD_SPAN_Z = 4;       // no tree inside a blocked span within this along z
const HAZARD_PICKUP_Z = 8;
const HAZARD_RAMP_MARGIN = 1;
const HAZARD_MIN_SEPARATION = 40; // a new hazard keeps this far from another live one along z
const HAZARD_RETRY = 30;
const BIRD_RETRY = 50;

function bearOf(state, tree) {
    for (const h of state.hazards) {
        if (h.type === 'bear' && h.tree === tree) return h;
    }
    return null;
}

// Blocked span of a log or falling tree (the full span, whatever the fall progress).
function spanOf(h) {
    if (h.type === 'log') return [h.x - CONFIG.logLength / 2, h.x + CONFIG.logLength / 2];
    const r = CONFIG.trunkRadius;
    return h.dir > 0 ? [h.x - r, h.x + CONFIG.fallLength] : [h.x - CONFIG.fallLength, h.x + r];
}

// Distance from a bear's trunk centre, on its leaning side, inside which no other tree may stand.
function bearClearSide() {
    return CONFIG.trunkRadius * 2 + CONFIG.bearReach + 2;
}

// Rule-break weight if `tree` stood at x because of live hazards.
function hazardPenalty(state, tree, x) {
    let n = 0;
    for (const h of state.hazards) {
        const dz = Math.abs(tree.z - h.z);
        if (h.type === 'bear') {
            if (h.tree === tree || dz >= HAZARD_END_Z) continue;
            const side = h.dir * (x - h.x);
            if (side > 0 && side < bearClearSide()) n += 80;
        } else {
            const [lo, hi] = spanOf(h);
            const end = CONFIG.logEndClearance;
            if (dz < HAZARD_END_Z && ((x > lo - end && x <= lo) || (x >= hi && x < hi + end))) n += 80;
            else if (dz < HAZARD_SPAN_Z && x > lo && x < hi) n += 80;
        }
    }
    return n;
}

// True when a pickup or ramp at (x, z) with this sideways half width would sit on a blocked span.
function onHazard(state, x, z, halfWidth, zRange) {
    for (const h of state.hazards) {
        if (h.type === 'bear') continue;
        const [lo, hi] = spanOf(h);
        if (x + halfWidth > lo && x - halfWidth < hi && Math.abs(h.z - z) < zRange) return true;
    }
    return false;
}

// True when a log or falling tree at z with span [lo, hi] would touch a live ramp or its corridor.
function hazardHitsRamp(state, lo, hi, z) {
    const half = Math.max(CONFIG.landingClearHalfWidth, CONFIG.rampHalfWidth) + HAZARD_RAMP_MARGIN;
    for (const ramp of state.ramps) {
        if (z >= ramp.z - 8 && z <= ramp.z + CONFIG.landingClearLength + 8 &&
            hi > ramp.x - half && lo < ramp.x + half) {
            return true;
        }
    }
    return false;
}

// Number of rule breaks if `tree` stood at x (its z is already set).
function conflicts(state, tree, x) {
    let n = inCorridor(state, x, tree.z) ? 100 : 0; // corridor breaks weigh most
    n += hazardPenalty(state, tree, x);
    for (const p of state.pickups) {
        if (Math.abs(p.x - x) < PICKUP_TREE_X && Math.abs(p.z - tree.z) < PICKUP_TREE_Z) n += 50;
    }
    for (const other of state.trees) {
        if (other !== tree &&
            Math.abs(other.x - x) < CONFIG.treeGapX &&
            Math.abs(other.z - tree.z) < CONFIG.treeGapZ) {
            n++;
        }
    }
    return n;
}

// Single placement helper: try `firstX`, then random x values, keep the best.
// With `clearOfRider`, random x values stay at least that far from the rider.
// A tree that carries a live bear never moves here (callers drop the bear first to move it).
function placeTree(state, tree, firstX, clearOfRider = 0) {
    if (bearOf(state, tree)) return;
    let bestX = firstX;
    let bestScore = firstX === null ? Infinity : conflicts(state, tree, firstX);
    for (let i = 0; i < 20 && bestScore > 0; i++) {
        let x = randomX(state.player.x);
        if (clearOfRider > 0 && Math.abs(x - state.player.x) < clearOfRider) {
            x = state.player.x + (x < state.player.x ? -1 : 1) * (clearOfRider + Math.random() * 20);
        }
        const score = conflicts(state, tree, x);
        if (score < bestScore) {
            bestScore = score;
            bestX = x;
        }
    }
    tree.x = bestX;
}

function scatterTrees(state) {
    state.trees = [];
    for (let i = 0; i < treeTotal(state); i++) {
        const tree = {
            x: 0,
            z: CONFIG.clearStartDistance +
                Math.random() * (CONFIG.spawnDistance - CONFIG.clearStartDistance),
            variant: randomVariant()
        };
        placeTree(state, tree, null);
        state.trees.push(tree);
    }
}

function computeScore(state) {
    return Math.floor(state.distance * CONFIG.pointsPerMetre) + state.jumpPoints +
        state.nearMisses * CONFIG.nearMissPoints + state.berries * CONFIG.berryPoints +
        state.catches * CONFIG.catchPoints;
}

function addPickups(state, type, x, count) {
    // Offending trees are found first, then moved once the pickups are in place.
    const zs = [];
    for (let i = 0; i < count; i++) {
        zs.push(CONFIG.spawnDistance + i * (type === 'berry' ? CONFIG.berryRowSpacing : 0));
    }
    const trees = state.trees.filter((t) => Math.abs(t.x - x) < PICKUP_TREE_X &&
        zs.some((z) => Math.abs(t.z - z) < PICKUP_TREE_Z));
    for (const z of zs) state.pickups.push({ x, z, type });
    for (const tree of trees) placeTree(state, tree, null);
}

// Try to place a pickup (or a berry row). Returns false if no x clear of ramps was found.
function spawnPickup(state, type, count) {
    const zs = [];
    for (let i = 0; i < count; i++) zs.push(CONFIG.spawnDistance + i * CONFIG.berryRowSpacing);
    let fallback = null;
    for (let attempt = 0; attempt < 8; attempt++) {
        const x = state.player.x + rand(-CONFIG.pickupSpread, CONFIG.pickupSpread);
        if (zs.some((z) => onRamp(state, x, z) ||
            onHazard(state, x, z, PICKUP_TREE_X, HAZARD_PICKUP_Z))) continue;
        const blocked = state.trees.some((t) => Math.abs(t.x - x) < PICKUP_TREE_X &&
            zs.some((z) => Math.abs(t.z - z) < PICKUP_TREE_Z));
        if (!blocked) {
            addPickups(state, type, x, count);
            return true;
        }
        if (fallback === null) fallback = x;
    }
    if (fallback === null) return false;
    addPickups(state, type, fallback, count);
    return true;
}

function collectPickup(state, pickup) {
    state.pickupTime = state.time;
    state.pickupType = pickup.type;
    if (pickup.type === 'berry') {
        state.berries += 1;
    } else if (pickup.type === 'mushroom') {
        state.mushroom = CONFIG.mushroomTime;
    } else if (pickup.type === 'snake') {
        state.snakeTime = state.time;
        state.snakeFlight = CONFIG.snakeFlightTime;
        state.fox.straight = 0; // a new throw restarts the sequence
    } else if (pickup.type === 'acorn') {
        state.acorn = true;
    }
}

function updatePickups(state, step, grounded) {
    const player = state.player;
    const kept = [];
    for (const p of state.pickups) {
        const before = p.z;
        p.z -= step;
        if (before > CONFIG.hitDistance && p.z <= CONFIG.hitDistance &&
            grounded && Math.abs(p.x - player.x) < CONFIG.pickupRadius) {
            collectPickup(state, p);
        } else if (p.z >= CONFIG.nearPlane) {
            kept.push(p);
        }
    }
    state.pickups = kept;

    const types = [
        ['berry', 'nextBerryIn', CONFIG.berryGapMin, CONFIG.berryGapMax],
        ['mushroom', 'nextMushroomIn', CONFIG.mushroomGapMin, CONFIG.mushroomGapMax],
        ['snake', 'nextSnakeIn', CONFIG.snakeGapMin, CONFIG.snakeGapMax],
        ['acorn', 'nextAcornIn', CONFIG.acornGapMin, CONFIG.acornGapMax]
    ];
    for (const [type, key, gapMin, gapMax] of types) {
        state[key] -= step;
        if (state[key] > 0) continue;
        if (type === 'acorn' && (state.level < CONFIG.acornMinLevel || state.acorn ||
            state.pickups.some((p) => p.type === 'acorn'))) {
            state[key] = 100;
            continue;
        }
        const count = type === 'berry' ? 1 + Math.floor(Math.random() * CONFIG.berryRowMax) : 1;
        state[key] = spawnPickup(state, type, count) ? rand(gapMin, gapMax) : 20;
    }
}

function resetPickups(state) {
    state.pickups = [];
    state.berries = 0;
    state.mushroom = 0;
    state.lostLimit = CONFIG.foxLostLimit * (state.easyRide ? CONFIG.easyRideLostFactor : 1);
    state.acorn = false;
    state.snakeTime = -1e9;
    state.snakeFlight = 0;
    state.respawnTime = -1e9;
    state.respawns = 0;
    state.pickupTime = -1e9;
    state.pickupType = '';
    state.nextBerryIn = 60;
    state.nextMushroomIn = rand(CONFIG.mushroomGapMin, CONFIG.mushroomGapMax);
    state.nextSnakeIn = rand(CONFIG.snakeGapMin, CONFIG.snakeGapMax);
    state.nextAcornIn = rand(CONFIG.acornGapMin, CONFIG.acornGapMax);
}

// Scheduling. Log and falling tree: one per level segment, at a random distance in it.
// `seg` counts 500 m segments from levelOrigin, so the top level keeps getting them.
function scheduleHazard(state, seg, minDistance) {
    const start = state.levelOrigin + seg * CONFIG.levelDistance;
    const lo = Math.max(start, minDistance, state.distance);
    // The plan is a list so a delayed spawn never loses the next segment's hazard.
    state.hazardPlan.push({
        at: rand(lo, start + CONFIG.levelDistance),
        type: Math.random() < 0.5 ? 'log' : 'fall'
    });
    state.hazardSegment = seg;
}

function isBearLevel(level) {
    return level >= 2 && (level - 2) % CONFIG.bearLevelGap === 0;
}

function scheduleBear(state) {
    if (!isBearLevel(state.level)) return;
    const start = state.levelOrigin + (state.level - 1) * CONFIG.levelDistance;
    state.bearAt = rand(Math.max(start, state.distance), start + CONFIG.levelDistance);
}

function scheduleBird(state, first) {
    const gap = rand(CONFIG.birdGapMin, CONFIG.birdGapMax);
    state.nextBirdIn = first ? Math.max(600, gap) : gap;
}

function resetHazards(state) {
    state.hazards = [];
    state.crashCause = '';
    state.smashTime = -1e9;
    state.birdTime = -1e9;
    state.birdDir = 0;
    state.hazardPlan = [];
    state.hazardSegment = 0;
    state.bearAt = NEVER;
    scheduleBird(state, true);
}

// Place a log or falling tree at spawnDistance. Returns false if it cannot go there now.
function spawnHazard(state, type) {
    const z = CONFIG.spawnDistance;
    if (state.hazards.some((h) => Math.abs(h.z - z) < HAZARD_MIN_SEPARATION)) return false;
    for (let attempt = 0; attempt < 8; attempt++) {
        const x = state.player.x + rand(-6, 6);
        // A falling tree leans towards the rider's side so that it matters.
        const side = Math.sign(state.player.x - x);
        const dir = type === 'fall' ? (side || (Math.random() < 0.5 ? -1 : 1)) :
            (Math.random() < 0.5 ? -1 : 1);
        const h = {
            type,
            x,
            z,
            dir,
            progress: type === 'log' ? 1 : 0,
            broken: false
        };
        const [lo, hi] = spanOf(h);
        if (hazardHitsRamp(state, lo, hi, z)) continue;
        state.hazards.push(h);
        // Clear pickups off the span, then move every tree that breaks the way-round rules.
        state.pickups = state.pickups.filter((p) => !onHazard(state, p.x, p.z, PICKUP_TREE_X, HAZARD_PICKUP_Z));
        for (const tree of state.trees) {
            if (hazardPenalty(state, tree, tree.x) > 0) placeTree(state, tree, null);
        }
        return true;
    }
    return false;
}

// Attach a bear to a tree ahead that is close to the rider's line. Returns false if none fits.
function spawnBear(state) {
    if (state.hazards.some((h) => h.type === 'bear')) return false;
    const px = state.player.x;
    const candidates = state.trees.filter((t) => t.z >= 120 && t.z <= CONFIG.spawnDistance &&
        Math.abs(t.x - px) <= 8 && !bearOf(state, t) &&
        !state.hazards.some((h) => Math.abs(h.z - t.z) < HAZARD_MIN_SEPARATION));
    if (candidates.length === 0) return false;
    const tree = candidates[Math.floor(Math.random() * candidates.length)];
    const dir = Math.sign(px - tree.x) || (Math.random() < 0.5 ? -1 : 1);
    const bear = { type: 'bear', x: tree.x, z: tree.z, dir, progress: 0, broken: false };
    Object.defineProperty(bear, 'tree', { value: tree, enumerable: false });
    state.hazards.push(bear);
    for (const other of state.trees) {
        if (other !== tree && hazardPenalty(state, other, other.x) > 0) placeTree(state, other, null);
    }
    return true;
}

function dropBear(state, tree) {
    const bear = bearOf(state, tree);
    if (bear) state.hazards = state.hazards.filter((h) => h !== bear);
}

function birdAllowed(state) {
    const player = state.player;
    if (player.y > 0 || player.vy > 0 || state.shield > 0) return false;
    if (state.time - state.levelTime < 2) return false;
    return !state.hazards.some((h) => h.z < 60);
}

function endRun(state, mode) {
    state.score = computeScore(state);
    state.mode = mode;
    state.crashTime = state.time;
    const d = state.difficulty;
    state.bounceVel = 0;
    state.newBest = state.score > (state.bests[d] || 0);
    if (state.newBest) state.bests[d] = state.score;
    state.best = state.bests[d] || 0;
}

function setDifficulty(state, difficulty) {
    if (difficulty && CONFIG.difficulties[difficulty]) state.difficulty = difficulty;
    state.best = state.bests[state.difficulty] || 0;
}

function newFox(state, phase = 'cruise') {
    return {
        x: state.player.x,
        z: CONFIG.foxStartDistance,
        lean: 0,
        lostTime: 0,
        visible: true,
        targetX: state.player.x,
        retargetIn: rand(CONFIG.foxWeaveTimeMin, CONFIG.foxWeaveTimeMax),
        phase,
        phaseIn: phase === 'sprint' ? CONFIG.foxSprintTime :
            rand(CONFIG.foxTauntGapMin, CONFIG.foxTauntGapMax),
        straight: 0
    };
}

function resetRun(state) {
    state.player.x = 0;
    state.player.steer = 0;
    state.player.speed = CONFIG.startSpeed;
    state.player.y = 0;
    state.player.vy = 0;
    state.player.boost = 0;
    state.ramps = [];
    state.nextRampIn = FIRST_RAMP_DISTANCE;
    state.fox = newFox(state);
    resetPickups(state);
    state.distance = 0;
    state.jumps = 0;
    state.score = 0;
    state.combo = 0;
    state.bestCombo = 0;
    state.jumpPoints = 0;
    state.lastJumpPoints = 0;
    state.nearMisses = 0;
    state.newBest = false;
    state.charges = 0;
    state.chargeTime = -1e9;
    state.boostPrev = false;
    state.shield = 0;
    state.bounceTime = -1e9;
    state.bounceDir = 0;
    state.bounces = 0;
    state.bounceVel = 0;
    state.level = 1;
    state.theme = themeFor(1);
    state.levelOrigin = 0;
    state.levelTime = -1e9;
    state.catches = 0;
    state.catchTime = -1e9;
    resetHazards(state);
    scheduleHazard(state, 0, 150);
    scatterTrees(state);
}

// Look of the forest for a level. Colours only.
function themeFor(level) {
    return CONFIG.levelThemes[level - 1] || CONFIG.levelThemes[0];
}

export function createWorld() {
    const state = {
        mode: 'ready',
        player: { x: 0, steer: 0, speed: CONFIG.startSpeed, y: 0, vy: 0, boost: 0 },
        trees: [],
        ramps: [],
        pickups: [],
        fox: null,
        difficulty: CONFIG.defaultDifficulty,
        bests: { beginner: 0, normal: 0, expert: 0 },
        viewHalfTan: 0.55,
        distance: 0,
        best: 0,
        jumps: 0,
        time: 0,
        crashTime: 0,
        landTime: 0,
        score: 0,
        combo: 0,
        bestCombo: 0,
        jumpPoints: 0,
        lastJumpPoints: 0,
        nearMisses: 0,
        newBest: false,
        charges: 0,
        chargeTime: -1e9,
        boostPrev: false,
        shield: 0,
        bounceTime: -1e9,
        bounceDir: 0,
        bounces: 0,
        bounceVel: 0,
        level: 1,
        levelOrigin: 0,
        levelTime: -1e9,
        catches: 0,
        catchTime: -1e9,
        theme: themeFor(1),
        night: false,
        nextRampIn: FIRST_RAMP_DISTANCE,
        hazards: [],
        crashCause: '',
        easyRide: false,
        reduceMotion: false,
        smashTime: -1e9,
        birdTime: -1e9,
        birdDir: 0,
        hazardPlan: [],
        hazardSegment: 0,
        bearAt: NEVER,
        nextBirdIn: 600
    };
    for (const key of Object.keys(CONFIG.difficulties)) state.bests[key] = 0;
    resetRun(state);
    return state;
}

export function resetWorld(state, difficulty) {
    setDifficulty(state, difficulty);
    state.mode = 'riding';
    // Runs alternate day and night. The first run of a session is day.
    state.runCount = (state.runCount || 0) + 1;
    state.night = state.runCount % 2 === 0;
    resetRun(state);
}

// Back to the splash scene: still forest, same best values.
export function setReady(state) {
    setDifficulty(state);
    state.mode = 'ready';
    resetRun(state);
}

// Pause and resume. Only a riding run pauses, only a paused run resumes.
export function pauseWorld(state) {
    if (state.mode === 'riding') state.mode = 'paused';
}

export function resumeWorld(state) {
    if (state.mode !== 'paused') return;
    state.mode = 'riding';
    // Treat both sides as already held, so the resume tap cannot fire a charge.
    state.boostPrev = true;
}

// Fox phases: cruise, then taunt (eases off), then sprint, then cruise again.
function advanceFoxPhase(state, dt) {
    const fox = state.fox;
    fox.phaseIn -= dt;
    if (fox.phaseIn > 0) return;
    if (fox.phase === 'cruise') {
        if (fox.straight > 0) {
            fox.phaseIn = 0.25; // no taunt while riding straight
        } else if (fox.z < CONFIG.foxMinDistance + 10) {
            fox.phaseIn = 1; // too close to ease off, try again shortly
        } else {
            fox.phase = 'taunt';
            fox.phaseIn = CONFIG.foxTauntTime;
            fox.targetX = fox.x; // hold the line
        }
    } else if (fox.phase === 'taunt') {
        fox.phase = 'sprint';
        fox.phaseIn = CONFIG.foxSprintTime;
    } else {
        fox.phase = 'cruise';
        fox.phaseIn = rand(CONFIG.foxTauntGapMin, CONFIG.foxTauntGapMax);
    }
}

// Top level only: close enough and lined up means the fox is caught.
function checkCatch(state) {
    const fox = state.fox;
    if (state.level !== CONFIG.maxLevel || fox.z > CONFIG.catchDistance ||
        Math.abs(fox.x - state.player.x) > CONFIG.catchHalfWidth) return;
    state.catches += 1;
    state.catchTime = state.time;
    // The level drops at once. levelTime is left alone, this is not a level-up.
    state.levelOrigin = state.distance - (CONFIG.catchRestartLevel - 1) * CONFIG.levelDistance;
    state.level = CONFIG.catchRestartLevel;
    state.theme = themeFor(state.level);
    state.hazardPlan = [];
    scheduleHazard(state, CONFIG.catchRestartLevel - 1, 0);
    scheduleBear(state);
    state.snakeFlight = 0;
    state.fox = newFox(state, 'sprint');
    state.score = computeScore(state);
}

function updateFox(state, dt, forward) {
    const fox = state.fox;
    const player = state.player;

    advanceFoxPhase(state, dt);
    const catchable = state.level === CONFIG.maxLevel;
    const lead = fox.phase === 'taunt' ? CONFIG.foxTauntLead :
        fox.phase === 'sprint' ? CONFIG.foxSprintLead :
        catchable ? CONFIG.catchFoxLead : CONFIG.foxLead;
    // Below the top level the fox keeps its distance. At the top level the gap may reach 0.
    fox.z = Math.max(catchable ? 0 : CONFIG.foxMinDistance,
        fox.z + (player.speed + lead - forward) * dt);

    const straight = fox.straight > 0;
    if (straight) {
        fox.straight = Math.max(0, fox.straight - dt);
        fox.targetX = fox.x; // hold the line
    }
    if (fox.phase !== 'taunt' && !straight) fox.retargetIn -= dt;
    if (fox.phase !== 'taunt' && !straight && fox.retargetIn <= 0) {
        fox.targetX = fox.x + rand(-CONFIG.foxWeaveRange, CONFIG.foxWeaveRange);
        fox.retargetIn = rand(CONFIG.foxWeaveTimeMin, CONFIG.foxWeaveTimeMax);
    }
    const gap = fox.targetX - fox.x;
    const move = Math.sign(gap) * Math.min(Math.abs(gap), CONFIG.foxSteerRate * dt);
    fox.x += move;
    const dir = move === 0 ? 0 : Math.sign(move);
    fox.lean += (dir - fox.lean) * Math.min(1, 8 * dt);

    fox.visible = Math.abs(fox.x - player.x) / fox.z <= state.viewHalfTan &&
        fox.z <= CONFIG.foxMaxDistance;
    fox.lostTime = fox.visible ? 0 : fox.lostTime + dt;
}

export function updateWorld(state, dt, steerInput, boostHeld = false) {
    state.time += dt;
    // Paused: only time moves, so render pulses still animate.
    if (state.mode === 'paused') return;
    const player = state.player;
    const riding = state.mode === 'riding';

    const target = riding ? steerInput : 0;
    const k = Math.min(1, CONFIG.steerSmoothing * dt);
    player.steer += (target - player.steer) * k;

    const boostPressed = boostHeld && !state.boostPrev;
    state.boostPrev = boostHeld;

    if (riding) {
        state.mushroom = Math.max(0, state.mushroom - dt);
        if (state.snakeFlight > 0) {
            state.snakeFlight -= dt;
            if (state.snakeFlight <= 0) {
                state.snakeFlight = 0;
                state.fox.straight = CONFIG.snakeStraightTime;
            }
        }
        if (boostPressed && state.charges > 0) {
            state.charges -= 1;
            player.boost = Math.max(player.boost, CONFIG.chargeBoostTime);
            state.chargeTime = state.time;
            state.shield = CONFIG.chargeBoostTime;
        }
        const targetSpeed = CONFIG.startSpeed +
            (CONFIG.maxSpeed - CONFIG.startSpeed) * (state.level - 1) / (CONFIG.maxLevel - 1);
        if (player.speed < targetSpeed) {
            player.speed = Math.min(targetSpeed, player.speed + CONFIG.acceleration * dt);
        } else if (player.speed > targetSpeed) {
            player.speed = Math.max(targetSpeed, player.speed - CONFIG.acceleration * 3 * dt);
        }
        const boosted = player.boost > 0;
        const forward = player.speed + (boosted ? CONFIG.boostSpeed : 0);
        const step = forward * dt;
        if (boosted) player.boost = Math.max(0, player.boost - dt);
        state.shield = Math.max(0, state.shield - dt);

        // Jump physics
        const airborne = player.y > 0 || player.vy > 0;
        if (airborne) {
            player.vy -= CONFIG.gravity * dt;
            player.y += player.vy * dt;
            if (player.y <= 0) {
                player.y = 0;
                player.vy = 0;
                state.landTime = state.time;
                state.jumps += 1;
                state.combo = Math.min(CONFIG.comboMax, state.combo + 1);
                state.bestCombo = Math.max(state.bestCombo, state.combo);
                state.lastJumpPoints = CONFIG.jumpBonus * state.combo;
                state.jumpPoints += state.lastJumpPoints;
                if (state.jumps % CONFIG.jumpsPerCharge === 0) {
                    state.charges = Math.min(CONFIG.maxCharges, state.charges + 1);
                }
            }
        }

        player.x += player.steer * CONFIG.steerRate * dt * (airborne ? CONFIG.airSteerFactor : 1);
        player.x += state.bounceVel * dt;
        state.bounceVel *= Math.exp(-CONFIG.bounceDecay * dt);
        state.distance += step;
        state.score = computeScore(state);
        const level = Math.min(CONFIG.maxLevel,
            1 + Math.floor((state.distance - state.levelOrigin) / CONFIG.levelDistance));
        if (level > state.level) {
            state.level = level;
            state.theme = themeFor(level);
            state.levelTime = state.time;
            scheduleBear(state);
        }
        const segment = Math.floor((state.distance - state.levelOrigin) / CONFIG.levelDistance);
        if (segment > state.hazardSegment) scheduleHazard(state, segment, 0);

        // Test crossings before moving anything, so a hit freezes the trees.
        const reach = CONFIG.trunkRadius + CONFIG.bikeHalfWidth;
        let hit = false;
        let respawned = false;
        let nearMisses = 0;
        const grounded0 = player.y === 0;

        // A rider that would crash can be saved by an acorn: it becomes a shielded rider.
        const useAcorn = () => {
            state.acorn = false;
            state.respawns += 1;
            state.respawnTime = state.time;
            state.shield = CONFIG.respawnShieldTime;
            respawned = true;
        };
        // A trunk contact. `edge` is how far from `cx` the contact reaches; `dir` is the
        // bounce direction (0 picks one from where the rider is).
        const trunkContact = (cx, edge, cause, dir) => {
            if (state.shield === 0 && state.acorn) useAcorn();
            if (state.shield > 0) {
                let d = dir || Math.sign(player.x - cx) || Math.sign(player.steer);
                if (d === 0) d = Math.random() < 0.5 ? -1 : 1;
                player.x = cx + d * (edge + CONFIG.bounceClearance);
                state.bounceVel = d * CONFIG.bounceKick;
                state.bounceTime = state.time;
                state.bounceDir = d;
                state.bounces += 1;
            } else {
                hit = true;
                state.crashCause = cause;
            }
        };

        for (const tree of state.trees) {
            if (!(tree.z > CONFIG.hitDistance && tree.z - step <= CONFIG.hitDistance)) continue;
            const dx = player.x - tree.x;
            const bear = bearOf(state, tree);
            // A leaning bear widens the trunk on its side once it is out far enough.
            const armed = bear && bear.progress >= 0.5 && Math.sign(dx) === bear.dir;
            const outer = reach + (armed ? CONFIG.bearReach : 0);
            if (Math.abs(dx) < reach) {
                trunkContact(tree.x, reach, 'tree', 0);
            } else if (armed && Math.abs(dx) < outer) {
                trunkContact(tree.x, outer, 'bear', bear.dir);
            } else if (Math.abs(dx) < outer + CONFIG.nearMissMargin && grounded0 && state.shield === 0) {
                nearMisses += 1;
            }
            if (hit) break;
        }

        // Logs and fallen trees. A falling tree's stump is a trunk, its span only blocks once down.
        if (!hit) {
            for (const h of state.hazards) {
                if (h.type === 'bear') continue;
                if (!(h.z > CONFIG.hitDistance && h.z - step <= CONFIG.hitDistance)) continue;
                if (h.type === 'fall' && Math.abs(player.x - h.x) < reach) {
                    trunkContact(h.x, reach, 'tree', 0);
                    if (hit) break;
                }
                if (h.broken || player.y > CONFIG.logClearHeight) continue;
                if (h.type === 'fall' && h.progress < CONFIG.fallBlockFrom) continue;
                const [lo, hi] = spanOf(h);
                if (player.x + CONFIG.bikeHalfWidth <= lo || player.x - CONFIG.bikeHalfWidth >= hi) continue;
                if (state.shield === 0 && state.acorn) {
                    useAcorn();
                    h.broken = true;
                } else if (state.shield > 0) {
                    h.broken = true;
                    state.smashTime = state.time;
                } else {
                    hit = true;
                    state.crashCause = 'log';
                    break;
                }
            }
        }

        if (respawned) {
            for (const tree of state.trees) {
                if (tree.z < 25 && Math.abs(tree.x - player.x) < 3) placeTree(state, tree, null, 3);
            }
        }

        if (hit) {
            endRun(state, 'crashed');
        } else {
            if (nearMisses > 0) {
                state.nearMisses += nearMisses;
                state.score = computeScore(state);
            }
            for (const tree of state.trees) tree.z -= step;
            for (const h of state.hazards) {
                if (h.type === 'bear') {
                    h.x = h.tree.x;
                    h.z = h.tree.z;
                    if (h.z < CONFIG.bearPeekDistance) {
                        h.progress = Math.min(1, h.progress + dt / CONFIG.bearPeekTime);
                    }
                } else {
                    h.z -= step;
                    if (h.type === 'fall' && h.z < CONFIG.fallTriggerDistance) {
                        h.progress = Math.min(1, h.progress + dt / CONFIG.fallTime);
                    }
                }
            }
            state.hazards = state.hazards.filter((h) => h.type === 'bear' || h.z >= CONFIG.nearPlane);

            // Ramps: launch on crossing, remove when passed
            const grounded = player.y <= 0 && player.vy <= 0;
            for (const ramp of state.ramps) {
                const before = ramp.z;
                ramp.z -= step;
                if (before > CONFIG.hitDistance && ramp.z <= CONFIG.hitDistance) {
                    if (!grounded) {
                        ramp.ignored = true; // passed while airborne from an earlier ramp
                    } else if (Math.abs(ramp.x - player.x) < CONFIG.rampHalfWidth) {
                        ramp.launched = true;
                        player.vy = CONFIG.jumpVelocity;
                        player.boost = CONFIG.boostTime;
                    }
                }
            }
            state.ramps = state.ramps.filter((r) => {
                if (r.z >= CONFIG.nearPlane) return true;
                if (!r.launched && !r.ignored) state.combo = 0;
                return false;
            });

            updatePickups(state, step, grounded);
            state.score = computeScore(state);

            state.nextRampIn -= step;
            if (state.nextRampIn <= 0) {
                // A ramp never goes onto a log or a fallen tree.
                const rx = [];
                for (let i = 0; i < 10 && rx.length === 0; i++) {
                    const x = player.x + rand(-CONFIG.rampSpread, CONFIG.rampSpread);
                    if (!onHazard(state, x, CONFIG.spawnDistance, PICKUP_RAMP_X, 10)) rx.push(x);
                }
                if (rx.length === 0) {
                    state.nextRampIn = 10;
                } else {
                    const ramp = {
                        x: rx[0],
                        z: CONFIG.spawnDistance,
                        launched: false,
                        ignored: false
                    };
                    state.ramps.push(ramp);
                    state.nextRampIn = rand(CONFIG.rampGapMin, CONFIG.rampGapMax);
                    // A new ramp never lands on a pickup: drop any that it would cover.
                    state.pickups = state.pickups.filter((p) => !onRamp(state, p.x, p.z));
                    for (const tree of state.trees) {
                        if (inCorridor(state, tree.x, tree.z)) placeTree(state, tree, null);
                    }
                }
            }

            for (const plan of state.hazardPlan) {
                if (state.distance < plan.at) continue;
                if (spawnHazard(state, plan.type)) plan.done = true;
                else plan.at = state.distance + HAZARD_RETRY;
            }
            if (state.hazardPlan.some((plan) => plan.done)) {
                state.hazardPlan = state.hazardPlan.filter((plan) => !plan.done);
            }
            if (state.distance >= state.bearAt) {
                state.bearAt = spawnBear(state) ? NEVER : state.distance + 20;
            }
            state.nextBirdIn -= step;
            if (state.nextBirdIn <= 0) {
                if (birdAllowed(state)) {
                    state.birdTime = state.time;
                    state.birdDir = Math.random() < 0.5 ? -1 : 1;
                    scheduleBird(state, false);
                } else {
                    state.nextBirdIn = BIRD_RETRY;
                }
            }

            updateFox(state, dt, forward);
            checkCatch(state);
            state.lostLimit = (CONFIG.foxLostLimit + (state.mushroom > 0 ? CONFIG.mushroomBonus : 0)) *
                (state.easyRide ? CONFIG.easyRideLostFactor : 1);
            if (state.fox.lostTime >= state.lostLimit) {
                endRun(state, 'lost');
            }
        }
    }

    // Recycle and wrap
    const half = CONFIG.fieldHalfWidth;
    for (const tree of state.trees) {
        if (tree.z < CONFIG.nearPlane) {
            dropBear(state, tree);
            tree.z = CONFIG.spawnDistance + Math.random() * 10;
            tree.variant = randomVariant();
            placeTree(state, tree, null);
        } else if (Math.abs(tree.x - player.x) > half) {
            dropBear(state, tree);
            placeTree(state, tree, tree.x - player.x > 0 ? tree.x - 2 * half : tree.x + 2 * half);
        }
    }
}
