// Shared tuning values and the state/view contract for Brock & Tod.
// All distances are metres, all times are seconds, all angles are radians.

export const CONFIG = {
    // Riding
    startSpeed: 20,          // forward speed at the start of a run (m/s)
    maxSpeed: 40,            // forward speed cap (m/s)
    acceleration: 2,         // how fast speed eases up to the level's speed (m/s^2)
    levelDistance: 500,      // metres per level
    maxLevel: 10,            // level 1 rides at startSpeed, maxLevel at maxSpeed, linear between
    steerRate: 10,           // lateral speed at full steer (m/s)
    steerSmoothing: 8,       // how fast player.steer eases towards the input (1/s)

    // Forest
    // Chosen on the splash screen. Only the tree count differs.
    difficulties: {
        beginner: { label: 'Beginner', treeCount: 70 },
        normal: { label: 'Normal', treeCount: 110 },
        expert: { label: 'Expert', treeCount: 150 }
    },
    defaultDifficulty: 'normal',
    // Fairness: no two trees closer than this, so there is always a gap to ride through.
    treeGapX: 2.5,           // lateral spacing enforced between trees...
    treeGapZ: 8,             // ...that are within this distance of each other along z
    spawnDistance: 160,      // z at which recycled trees reappear
    fieldHalfWidth: 60,      // trees live within player.x +/- this
    clearStartDistance: 45,  // no trees closer than this on reset
    trunkRadius: 0.45,
    treeVariants: 3,

    // Collision
    bikeHalfWidth: 0.35,
    hitDistance: 1.0,        // a tree is tested when its z crosses this value

    // Camera
    cameraHeight: 1.2,
    nearPlane: 0.5,
    horizonRatio: 0.42,      // horizon y as a fraction of view height
    focalRatio: 0.9,         // focal length = min(view.w, view.h) * focalRatio
    maxLean: 0.12,           // scene/handlebar roll at full steer

    // Jumps
    rampHalfWidth: 1.6,      // a ramp is this wide either side of its x
    rampLength: 3,           // ramp footprint along z, for drawing
    rampHeight: 0.9,         // lip height, for drawing
    rampGapMin: 180,         // metres ridden between ramp spawns
    rampGapMax: 320,
    rampSpread: 12,          // a ramp spawns within player.x +/- this
    jumpVelocity: 6,         // upward speed when leaving a ramp (m/s)
    gravity: 12,             // m/s^2
    airSteerFactor: 0.4,     // steering authority while airborne
    landingClearLength: 45,  // no trees in the corridor this far past a ramp
    landingClearHalfWidth: 2.5,
    boostSpeed: 8,           // extra forward speed after a jump (m/s)
    boostTime: 2.5,          // seconds the boost lasts

    // Stored boost: earned from jumps, fired by holding left and right together
    jumpsPerCharge: 5,       // landed jumps needed to earn one charge
    maxCharges: 3,
    chargeBoostTime: 4,      // seconds of boost from one charge (same boostSpeed)
    // A fired charge also shields the rider for chargeBoostTime. A ramp boost does not.
    // While shielded, hitting a trunk bounces the rider sideways instead of ending the run.
    bounceClearance: 0.4,    // gap left between bike and trunk straight after a bounce (m)
    bounceKick: 7,           // sideways speed given by a bounce (m/s), away from the trunk
    bounceDecay: 5,          // how fast that sideways speed dies away (1/s)
    shieldWarnTime: 1,       // the last seconds of the shield, shown as a warning

    // Score
    pointsPerMetre: 1,
    jumpBonus: 100,          // points for a landed jump, multiplied by the combo
    comboMax: 5,             // combo multiplier cap; a missed ramp resets the combo to 0
    nearMissMargin: 0.6,     // a trunk passing within this of a hit, without hitting, is a near miss (m)
    nearMissPoints: 25,

    // Pickups. Ridden over on the ground to collect. Gaps are metres ridden between spawns.
    pickupRadius: 1.0,       // collected when within this sideways as it crosses hitDistance (m)
    pickupSpread: 10,        // a pickup spawns within player.x +/- this
    berryPoints: 20,
    berryGapMin: 140,
    berryGapMax: 300,
    berryRowMax: 3,          // berries come in a row of 1 to this many
    berryRowSpacing: 6,      // metres between berries in a row
    mushroomGapMin: 500,
    mushroomGapMax: 900,
    mushroomTime: 15,        // seconds a mushroom is held
    mushroomBonus: 1,        // extra seconds the fox may be out of sight while one is held
    snakeGapMin: 400,
    snakeGapMax: 800,
    snakeFlightTime: 0.6,    // seconds the thrown snake takes to reach the fox
    snakeStraightTime: 3,    // seconds the fox then rides straight
    acornMinLevel: 5,        // no acorns before this level
    acornGapMin: 700,
    acornGapMax: 1200,
    respawnShieldTime: 2.5,  // seconds of tree protection after an acorn saves a crash

    // Look of the forest. Colours and tree shapes only, no effect on play.
    // One theme name per level, index 0 is level 1.
    levelThemes: ['spring', 'spring', 'autumn', 'autumn', 'winter', 'winter',
        'redwood', 'pine', 'cherry', 'cherry'],
    themeBlendTime: 1.5,     // seconds to cross-fade colours when the theme changes

    // Hazards
    logLength: 5,            // a fallen log blocks this much of the trail, centred on its x (m)
    logClearHeight: 0.5,     // a rider higher than this passes over a log (m)
    logEndClearance: 3,      // no tree within this of either end of a log, so there is a way round (m)
    fallTriggerDistance: 95, // a falling tree starts to go when it is this far ahead (m)
    fallTime: 1.6,           // seconds from the first lean to lying flat
    fallLength: 9,           // once down it blocks from its stump out to this far, on one side (m)
    fallBlockFrom: 0.75,     // it only blocks once this fraction of the fall is done
    bearLevelGap: 3,         // at most one bear per this many levels, none on level 1
    bearPeekDistance: 85,    // the bear starts to lean out when its tree is this far ahead (m)
    bearPeekTime: 0.7,       // seconds to lean fully out
    bearReach: 1.3,          // extra blocked width on the bear's side of the trunk (m)
    birdGapMin: 900,         // metres ridden between birds
    birdGapMax: 1800,
    birdBlockTime: 0.5,      // seconds the bird blocks the view

    // Catching the fox, only possible at maxLevel
    catchFoxLead: -1.5,        // fox cruise speed relative to the unboosted player at maxLevel (m/s)
    catchDistance: 3,        // caught when the gap is at or under this (m)...
    catchHalfWidth: 1.5,     // ...and the rider is within this sideways (m)
    catchPoints: 1000,
    catchRestartLevel: 5,    // the run carries on from this level after a catch

    // Fox taunt: now and then the fox eases off so the gap closes, then sprints away
    foxTauntGapMin: 9,       // seconds of normal riding between taunts
    foxTauntGapMax: 16,
    foxTauntTime: 2.5,       // seconds the fox eases off
    foxTauntLead: -3.5,      // fox speed relative to the unboosted player while taunting (m/s)
    foxSprintTime: 2,        // seconds of sprint straight after a taunt
    foxSprintLead: 7,       // fox speed relative to the unboosted player while sprinting (m/s)
    storageKey: 'trailbadger.highscores.v1',
    statsKey: 'trailbadger.stats.v1',

    // Fox
    foxSize: 1.7,            // draw scale of the fox sprite relative to its true size
    foxStartDistance: 30,    // gap to the fox at the start of a run
    foxMinDistance: 16,      // the fox is never closer than this
    foxMaxDistance: 100,     // beyond this the fox counts as out of sight
    foxLead: 1.2,            // the fox is this much faster than the unboosted player (m/s)
    foxSteerRate: 7.5,       // fox lateral speed (m/s), slower than the player
    foxWeaveRange: 18,      // each new fox target is within fox.x +/- this
    foxWeaveTimeMin: 1.5,    // seconds between fox target changes
    foxWeaveTimeMax: 4,
    foxLostLimit: 3,         // seconds out of sight before the run is lost

    // Sound. Everything is synthesised with the Web Audio API, there are no audio files.
    settingsKey: 'trailbadger.settings.v1',
    // reduceMotion is left out on purpose: with nothing stored, the system setting decides.
    defaultSettings: { music: true, effects: true, volume: 'normal', easyRide: false },

    // Accessibility
    easyRideLostFactor: 1.33, // Easy ride: the out-of-sight allowance is this much longer
    maxBlinkRate: 2,         // no on-off blink anywhere may be faster than this (per second)
    volumeLevels: { normal: 1, low: 0.4 },   // master gain per volume setting
    musicLevel: 0.22,        // music gain relative to master, kept well under the effects
    musicMenuDuck: 0.5,      // music is multiplied by this when not riding

    // Flow
    crashLockout: 0.8        // seconds after a run ends before a tap restarts
};

/**
 * Game state, created by createWorld() in world.js.
 *
 * @typedef {Object} GameState
 * @property {'ready'|'riding'|'paused'|'crashed'|'lost'} mode
 *           'crashed' is hitting a tree, 'lost' is the fox getting away,
 *           'paused' is a frozen run that resumes to 'riding'
 * @property {number} combo       ramps landed in a row without missing one (0 after a miss)
 * @property {number} bestCombo   highest combo this run
 * @property {number} jumpPoints  points earned from jumps this run
 * @property {number} lastJumpPoints points given by the most recent landing
 * @property {number} nearMisses  near misses this run
 * @property {Array<{x: number, z: number, type: 'berry'|'mushroom'|'snake'|'acorn'}>} pickups
 *           collectables on the trail, same coordinates as trees
 * @property {Array<{type: 'log'|'fall'|'bear', x: number, z: number, dir: number, progress: number, broken: boolean}>} hazards
 *           x and z as for trees. For 'log', x is the centre. For 'fall', x is the stump
 *           and dir (-1 or 1) is the side it falls to. For 'bear', x is its tree's x and
 *           dir is the side it leans out. progress runs 0 to 1 for the fall or the lean
 *           (always 1 for 'log'). broken is true once a shielded rider smashed through.
 * @property {boolean} reduceMotion  written by main.js from the accessibility setting:
 *           no shake, flash, roll, drifting particles or blinking in the canvas
 * @property {boolean} easyRide   written by main.js: lostLimit is multiplied by easyRideLostFactor
 * @property {string} theme       name from CONFIG.levelThemes for the current level
 * @property {boolean} night      true on every second run: same theme, night colours
 * @property {string} crashCause 'tree', 'log' or 'bear': what ended the run
 * @property {number} smashTime   value of time when a log was last smashed through
 * @property {number} birdTime    value of time when a bird last flew across the view
 * @property {number} birdDir     -1 when that bird flies right to left, 1 for left to right
 * @property {number} berries     berries collected this run
 * @property {number} mushroom    seconds of mushroom left, 0 when none is held
 * @property {number} lostLimit   seconds the fox may be out of sight right now
 *           (foxLostLimit, plus mushroomBonus while a mushroom is held)
 * @property {boolean} acorn      true while an acorn is held
 * @property {number} snakeTime   value of time when a snake was last thrown at the fox
 * @property {number} respawnTime value of time when an acorn last saved a crash
 * @property {number} respawns    crashes saved by an acorn this run
 * @property {number} pickupTime  value of time of the last pickup collected
 * @property {string} pickupType  type of the last pickup collected
 * @property {{x: number, steer: number, speed: number, y: number, vy: number, boost: number}} player
 *           x is lateral world position, steer is smoothed -1 (left) to 1 (right),
 *           speed is the unboosted forward speed, y is height above the ground
 *           (0 when grounded), vy is vertical speed, boost is seconds of boost left
 * @property {Array<{x: number, z: number, variant: number}>} trees
 *           x is world lateral position, z is distance ahead of the player
 * @property {Array<{x: number, z: number}>} ramps
 *           jump ramps, same coordinates as trees, usually zero to two at a time
 * @property {{x: number, z: number, lean: number, lostTime: number, visible: boolean}} fox
 *           x and z as for trees, lean is -1 to 1 following its sideways movement,
 *           lostTime is seconds continuously out of sight, visible is this frame's result.
 *           fox.phase is 'cruise', 'taunt' or 'sprint'.
 *           fox.straight is seconds left riding straight after a snake hit, 0 otherwise
 * @property {number} viewHalfTan  view.w / (2 * view.focal), written by main.js on resize
 * @property {'beginner'|'normal'|'expert'} difficulty  key into CONFIG.difficulties
 * @property {number} distance  metres ridden this run
 * @property {number} score     floor(distance * pointsPerMetre) + jumpPoints
 *           + nearMisses * nearMissPoints + berries * berryPoints + catches * catchPoints
 * @property {number} best      best score for the current difficulty
 * @property {Object<string, number>} bests  best score per difficulty key, loaded from
 *           and saved to localStorage by main.js
 * @property {boolean} newBest  true when the run that just ended beat the stored best
 * @property {number} jumps     jumps landed this run (counted on landing, not on take-off)
 * @property {number} charges   stored boosts ready to fire, 0 to CONFIG.maxCharges
 * @property {number} chargeTime value of time when a stored boost was last fired
 * @property {number} shield    seconds of tree protection left, 0 when unprotected
 * @property {number} bounceTime value of time when the rider last bounced off a trunk
 * @property {number} bounceDir  -1 when that bounce pushed the rider left, 1 for right
 * @property {number} bounces    bounces this run
 * @property {number} level     1 to CONFIG.maxLevel, from distance - levelOrigin
 * @property {number} levelOrigin distance at which level 1 notionally started; moved
 *           forward by a catch so the level drops to catchRestartLevel
 * @property {number} catches   foxes caught this run
 * @property {number} catchTime value of time when the fox was last caught
 * @property {number} levelTime value of time when the level last went up
 * @property {number} time      seconds since the page loaded (keeps running in every mode)
 * @property {number} crashTime value of time when the last run ended (crashed or lost)
 * @property {number} landTime  value of time when the player last landed a jump
 */

/**
 * View metrics in CSS pixels, built by main.js on every resize.
 * The canvas context is already scaled by devicePixelRatio.
 *
 * @typedef {Object} View
 * @property {number} w
 * @property {number} h
 * @property {number} horizonY
 * @property {number} focal
 */
