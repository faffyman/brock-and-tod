// Brock & Tod scene renderer: sky, treeline, forest floor, trees, crash feedback.
// Draws with flat fills and simple paths. Module level data below is only a
// cache of values that can be rebuilt at any time.
//
// Looks: six themes (spring, autumn, winter, redwood, pine, cherry), each in a
// day and a night version. A palette is one flat number vector (see the slot
// layout below), so a cross-fade is a plain per element mix.

import { CONFIG } from '../config.js';
import { drawRamp, drawFox, drawPickup, drawLog, drawFallingTree, drawBear, drawBird, drawSmash, BIRD_FEATHER_TIME } from './sprites.js';
import { updateAnim, animTime, foxPose, effectAge } from './anim.js';

const TAU = 6.2832;

// ---------------------------------------------------------------------------
// Palettes
// ---------------------------------------------------------------------------

// Vector slots. Each colour slot is 3 numbers (r, g, b). Tree colours per
// variant: trunk, trunk light side, foliage, foliage highlight, mark.
const S_SKY_TOP = 0;
const S_SKY_MID = 1;
const S_SKY_LOW = 2;
const S_HAZE = 3;           // colour far things fade into
const S_HILL_FAR = 4;
const S_HILL_NEAR = 5;
const S_GROUND_FAR = 6;
const S_GROUND_MID = 7;
const S_GROUND_NEAR = 8;
const S_BAND = 9;           // perspective bands on the ground
const S_SPECK_LIGHT = 10;
const S_SPECK_DARK = 11;
const S_TREE = 12;          // 3 variants x 5 colours: slots 12 to 26
const COLOUR_SLOTS = 27;
const N_BAND_A = COLOUR_SLOTS * 3;   // scalars follow the colours
const N_LIGHT_A = N_BAND_A + 1;
const N_DARK_A = N_BAND_A + 2;
const N_SNOW = N_BAND_A + 3;
const N_PETAL = N_BAND_A + 4;
const N_NIGHT = N_BAND_A + 5;        // 1 shows moon and stars
const VEC_LEN = N_BAND_A + 6;

function makePalette(o) {
    const v = new Float64Array(VEC_LEN);
    const put = (slot, c) => { v[slot * 3] = c[0]; v[slot * 3 + 1] = c[1]; v[slot * 3 + 2] = c[2]; };
    put(S_SKY_TOP, o.sky[0]);
    put(S_SKY_MID, o.sky[1]);
    put(S_SKY_LOW, o.sky[2]);
    put(S_HAZE, o.haze);
    put(S_HILL_FAR, o.hill[0]);
    put(S_HILL_NEAR, o.hill[1]);
    put(S_GROUND_FAR, o.ground[0]);
    put(S_GROUND_MID, o.ground[1]);
    put(S_GROUND_NEAR, o.ground[2]);
    put(S_BAND, o.band);
    put(S_SPECK_LIGHT, o.speckLight);
    put(S_SPECK_DARK, o.speckDark);
    for (let t = 0; t < 3; t++) {
        for (let k = 0; k < 5; k++) put(S_TREE + t * 5 + k, o.trees[t][k]);
    }
    v[N_BAND_A] = o.band[3];
    v[N_LIGHT_A] = o.speckLight[3];
    v[N_DARK_A] = o.speckDark[3];
    v[N_SNOW] = o.snow || 0;
    v[N_PETAL] = o.petal || 0;
    v[N_NIGHT] = 0;
    return v;
}

// Day palettes. Spring is the original look of the game.
const DAY = {
    spring: makePalette({
        sky: [[111, 159, 176], [167, 199, 184], [201, 208, 166]],
        haze: [176, 186, 150],
        hill: [[138, 164, 134], [108, 138, 106]],
        ground: [[170, 180, 138], [102, 119, 74], [42, 36, 22]],
        band: [214, 226, 150, 0.1],
        speckLight: [230, 214, 150, 0.55],
        speckDark: [30, 22, 12, 0.5],
        trees: [
            [[70, 48, 34], [100, 72, 48], [24, 64, 50], [38, 90, 64], [50, 34, 24]],
            [[92, 70, 50], [126, 98, 68], [72, 118, 46], [102, 150, 58], [60, 44, 32]],
            [[226, 222, 206], [250, 246, 232], [158, 170, 62], [200, 192, 78], [58, 52, 46]]
        ]
    }),
    autumn: makePalette({
        sky: [[124, 118, 150], [226, 168, 128], [250, 208, 140]],
        haze: [228, 190, 148],
        hill: [[196, 142, 112], [152, 96, 70]],
        ground: [[206, 168, 112], [148, 100, 54], [58, 34, 16]],
        band: [255, 186, 96, 0.1],
        speckLight: [240, 154, 60, 0.6],
        speckDark: [64, 26, 10, 0.5],
        trees: [
            [[78, 52, 36], [112, 78, 52], [196, 134, 34], [236, 182, 62], [52, 34, 22]],
            [[96, 64, 44], [132, 92, 62], [188, 62, 32], [230, 112, 38], [62, 40, 28]],
            [[226, 222, 206], [250, 246, 232], [228, 160, 42], [246, 200, 72], [58, 52, 46]]
        ]
    }),
    winter: makePalette({
        sky: [[116, 132, 154], [168, 182, 200], [210, 220, 230]],
        haze: [206, 216, 228],
        hill: [[178, 192, 210], [146, 162, 184]],
        ground: [[228, 236, 244], [202, 216, 232], [156, 174, 202]],
        band: [120, 150, 206, 0.1],
        speckLight: [255, 255, 255, 0.7],
        speckDark: [100, 124, 166, 0.4],
        snow: 1,
        trees: [
            [[58, 42, 34], [88, 66, 54], [30, 66, 58], [236, 242, 250], [40, 28, 22]],
            [[84, 66, 58], [122, 100, 90], [76, 60, 54], [244, 247, 252], [54, 40, 34]],
            [[222, 220, 214], [248, 246, 240], [92, 76, 66], [244, 247, 252], [58, 52, 46]]
        ]
    }),
    redwood: makePalette({
        sky: [[148, 170, 172], [190, 206, 196], [216, 224, 204]],
        haze: [190, 198, 178],
        hill: [[150, 170, 150], [112, 138, 116]],
        ground: [[178, 160, 132], [102, 76, 54], [40, 24, 16]],
        band: [226, 200, 150, 0.09],
        speckLight: [204, 150, 96, 0.5],
        speckDark: [26, 14, 8, 0.5],
        trees: [
            [[118, 50, 32], [166, 80, 50], [18, 62, 40], [32, 90, 56], [64, 24, 16]],
            [[108, 46, 30], [152, 74, 46], [22, 70, 44], [38, 98, 60], [58, 22, 14]],
            [[126, 56, 36], [172, 88, 56], [16, 52, 36], [28, 78, 52], [70, 28, 18]]
        ]
    }),
    pine: makePalette({
        sky: [[110, 140, 164], [158, 184, 196], [192, 208, 208]],
        haze: [160, 178, 178],
        hill: [[116, 144, 142], [82, 112, 112]],
        ground: [[164, 152, 128], [112, 94, 68], [46, 36, 26]],
        band: [220, 210, 180, 0.08],
        speckLight: [196, 170, 120, 0.5],
        speckDark: [24, 16, 10, 0.5],
        trees: [
            [[74, 50, 36], [104, 74, 54], [18, 50, 42], [32, 74, 60], [48, 32, 22]],
            [[62, 44, 32], [92, 66, 48], [24, 58, 44], [38, 84, 62], [46, 32, 24]],
            [[116, 64, 40], [152, 90, 56], [30, 64, 46], [48, 92, 64], [72, 40, 26]]
        ]
    }),
    cherry: makePalette({
        sky: [[200, 192, 226], [238, 214, 230], [253, 232, 228]],
        haze: [238, 220, 226],
        hill: [[216, 188, 208], [190, 158, 186]],
        ground: [[230, 214, 210], [150, 166, 112], [62, 54, 40]],
        band: [255, 236, 240, 0.12],
        speckLight: [252, 210, 224, 0.7],
        speckDark: [60, 44, 34, 0.45],
        petal: 1,
        trees: [
            [[58, 38, 44], [92, 64, 70], [238, 150, 178], [252, 214, 228], [36, 22, 26]],
            [[64, 42, 48], [98, 70, 76], [250, 206, 220], [255, 242, 246], [40, 26, 30]],
            [[44, 40, 40], [72, 66, 64], [34, 62, 52], [52, 90, 72], [30, 26, 26]]
        ]
    })
};

// Night version of a day palette. Mostly derived: darker, less saturated, cool
// tint. The sky and horizon are hand tuned, and tree trunks are pushed away
// from the ground tone so near trunks stay visible.
const COOL = [0.8, 0.92, 1.22];

function dimColour(v, slot, k, desat, floor) {
    const o = slot * 3;
    const g = v[o] * 0.3 + v[o + 1] * 0.59 + v[o + 2] * 0.11;
    const out = [0, 0, 0];
    for (let j = 0; j < 3; j++) {
        const c = (v[o + j] + (g - v[o + j]) * desat) * k * COOL[j];
        out[j] = Math.max(floor || 0, Math.min(255, c));
    }
    return out;
}

function lum(c) {
    return c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
}

// Move colour c away from the reference tone until their brightness differs by minD.
function separate(c, ref, minD) {
    const d = lum(c) - lum(ref);
    if (Math.abs(d) >= minD) return c;
    const shift = (d >= 0 ? 1 : -1) * (minD - Math.abs(d));
    return [c[0] + shift, c[1] + shift, c[2] + shift].map(x => Math.max(0, Math.min(255, x)));
}

function mixC(a, b, f) {
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

function maxC(a, b) {
    return [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])];
}

function scaleC(c, k) {
    return [c[0] * k, c[1] * k, c[2] * k];
}

function nightOf(day) {
    const v = new Float64Array(VEC_LEN);
    const put = (slot, c) => { v[slot * 3] = c[0]; v[slot * 3 + 1] = c[1]; v[slot * 3 + 2] = c[2]; };
    const skyLow = mixC([62, 76, 108], dimColour(day, S_SKY_LOW, 0.4, 0.5), 0.2);
    const haze = skyLow;     // lighter than the trees, so silhouettes separate
    put(S_SKY_TOP, [9, 13, 32]);
    put(S_SKY_MID, [17, 25, 54]);
    put(S_SKY_LOW, skyLow);
    put(S_HAZE, haze);
    put(S_HILL_FAR, scaleC(haze, 0.8));
    put(S_HILL_NEAR, scaleC(haze, 0.58));
    // Floors keep the ground a dark blue grey rather than black.
    const gMid = maxC(dimColour(day, S_GROUND_MID, 0.45, 0.45), [30, 38, 54]);
    const gNear = maxC(dimColour(day, S_GROUND_NEAR, 0.5, 0.4), [18, 22, 34]);
    put(S_GROUND_FAR, scaleC(haze, 0.9));
    put(S_GROUND_MID, gMid);
    put(S_GROUND_NEAR, gNear);
    put(S_BAND, dimColour(day, S_BAND, 0.5, 0.3));
    put(S_SPECK_LIGHT, dimColour(day, S_SPECK_LIGHT, 0.5, 0.3));
    put(S_SPECK_DARK, dimColour(day, S_SPECK_DARK, 0.3, 0.3));
    for (let t = 0; t < 3; t++) {
        const b = S_TREE + t * 5;
        // Trunks never go darker than a cool grey, so dark bark still shows on the ground.
        const trunk = separate(separate(maxC(dimColour(day, b, 0.52, 0.4), [46, 48, 66]), gNear, 34), gMid, 30);
        let light = separate(maxC(dimColour(day, b + 1, 0.7, 0.3), [78, 82, 108]), gMid, 42);
        if (lum(light) < lum(trunk) + 10) light = mixC(trunk, [150, 160, 190], 0.4);
        put(b, trunk);
        put(b + 1, light);
        put(b + 2, dimColour(day, b + 2, 0.45, 0.4, 6));
        put(b + 3, dimColour(day, b + 3, 0.58, 0.3, 10));
        put(b + 4, dimColour(day, b + 4, 0.45, 0.4, 4));
    }
    v[N_BAND_A] = day[N_BAND_A] * 0.6;
    v[N_LIGHT_A] = day[N_LIGHT_A] * 0.7;
    v[N_DARK_A] = day[N_DARK_A] * 0.8;
    v[N_SNOW] = day[N_SNOW] * 0.85;
    v[N_PETAL] = day[N_PETAL] * 0.85;
    v[N_NIGHT] = 1;
    return v;
}

// Hand tuned night overrides, applied after the derivation (slot, colour).
const NIGHT_TUNE = {
    winter: [[S_GROUND_FAR, [74, 88, 118]], [S_GROUND_MID, [58, 72, 100]], [S_GROUND_NEAR, [34, 44, 66]]]
};

const HAZE_LEVELS = 16;
const MAX_HAZE = 0.85;

let paletteId = 0;

function rgb(v, slot) {
    const o = slot * 3;
    return 'rgb(' + Math.round(v[o]) + ',' + Math.round(v[o + 1]) + ',' + Math.round(v[o + 2]) + ')';
}

function rgba(v, slot, a) {
    const o = slot * 3;
    return 'rgba(' + Math.round(v[o]) + ',' + Math.round(v[o + 1]) + ',' + Math.round(v[o + 2]) + ',' + (Math.round(a * 1000) / 1000) + ')';
}

// A compiled palette: the vector plus the colour strings the draw code uses.
// The haze tables (a tree's colours faded towards the haze, per haze level) are
// filled on first use and cleared whenever the vector changes.
function compile(v, into) {
    const c = into || { v: v, hz: new Array(3 * HAZE_LEVELS).fill(null) };
    c.id = ++paletteId;
    c.skyTop = rgb(v, S_SKY_TOP);
    c.skyMid = rgb(v, S_SKY_MID);
    c.skyLow = rgb(v, S_SKY_LOW);
    c.hillFar = rgb(v, S_HILL_FAR);
    c.hillNear = rgb(v, S_HILL_NEAR);
    c.groundFar = rgb(v, S_GROUND_FAR);
    c.groundMid = rgb(v, S_GROUND_MID);
    c.groundNear = rgb(v, S_GROUND_NEAR);
    c.band = rgba(v, S_BAND, v[N_BAND_A]);
    c.speckLight = rgba(v, S_SPECK_LIGHT, v[N_LIGHT_A]);
    c.speckDark = rgba(v, S_SPECK_DARK, v[N_DARK_A]);
    c.snow = v[N_SNOW];
    c.petal = v[N_PETAL];
    c.night = v[N_NIGHT];
    return c;
}

// Built once per theme and time of day, on first use.
const compiled = {};
function paletteFor(name, night) {
    const key = name + (night ? '|n' : '|d');
    let c = compiled[key];
    if (c) return c;
    let v = DAY[name];
    if (night) {
        v = nightOf(v);
        const tune = NIGHT_TUNE[name];
        if (tune) {
            for (let i = 0; i < tune.length; i++) {
                const o = tune[i][0] * 3;
                v[o] = tune[i][1][0];
                v[o + 1] = tune[i][1][1];
                v[o + 2] = tune[i][1][2];
            }
        }
    }
    c = compile(v);
    compiled[key] = c;
    return c;
}

// Build every palette up front so no frame pays for it.
const THEME_NAMES = Object.keys(DAY);
for (let i = 0; i < THEME_NAMES.length; i++) {
    paletteFor(THEME_NAMES[i], false);
    paletteFor(THEME_NAMES[i], true);
}

// Current palette, blend state.
const blend = {
    goal: null,          // compiled palette the scene is heading for
    goalName: '',
    goalNight: false,
    active: false,
    start: 0,
    from: new Float64Array(VEC_LEN),
    scratch: compile(new Float64Array(VEC_LEN)),
    epoch: 0             // bumps on a hard switch, so every tree takes the new shape
};
let cur = paletteFor('spring', false);

function smooth(u) {
    return u * u * (3 - 2 * u);
}

// Pick the palette for this frame. A theme change in a live run cross-fades over
// CONFIG.themeBlendTime on the render clock. Anything else switches at once.
function resolvePalette(state) {
    const name = state.theme && DAY[state.theme] ? state.theme : 'spring';
    const night = !!state.night;
    const now = animTime();
    if (!blend.goal) {
        blend.goal = paletteFor(name, night);
        blend.goalName = name;
        blend.goalNight = night;
        cur = blend.goal;
    } else if (name !== blend.goalName || night !== blend.goalNight) {
        const live = state.mode === 'riding' || state.mode === 'paused';
        if (live && night === blend.goalNight) {
            blend.from.set(cur.v);
            blend.active = true;
            blend.start = now;
        } else {
            blend.active = false;
            blend.epoch++;
        }
        blend.goal = paletteFor(name, night);
        blend.goalName = name;
        blend.goalNight = night;
        if (!blend.active) cur = blend.goal;
    }
    if (blend.active) {
        const T = CONFIG.themeBlendTime > 0 ? CONFIG.themeBlendTime : 1.5;
        const u = (now - blend.start) / T;
        if (u >= 1) {
            blend.active = false;
            cur = blend.goal;
        } else {
            const k = smooth(Math.max(0, u));
            const to = blend.goal.v;
            const out = blend.scratch.v;
            for (let i = 0; i < VEC_LEN; i++) out[i] = blend.from[i] + (to[i] - blend.from[i]) * k;
            blend.scratch.hz.fill(null);
            compile(out, blend.scratch);
            cur = blend.scratch;
        }
    }
    return cur;
}

// ---------------------------------------------------------------------------
// Tree shapes. Units are metres, scaled to pixels. Three per theme, picked by
// tree.variant. The drawn trunk width at the ground is always
// 2 * CONFIG.trunkRadius * scale (the one old exception is the spring birch,
// which keeps its 0.7 factor so spring looks as before).
// ---------------------------------------------------------------------------

const TIERS_PINE = [[2.5, 4.2, 2.6], [5.0, 4.0, 2.0], [7.6, 4.2, 1.4]];
const TIERS_SPRUCE = [[1.8, 3.4, 2.1], [3.4, 3.4, 1.85], [5.0, 3.3, 1.6], [6.6, 3.1, 1.25], [8.2, 3.0, 0.85]];
const TIERS_REDWOOD = [[10, 5.2, 2.3], [13.4, 5, 2.0], [16.8, 4.6, 1.6], [20, 4, 1.0]];

const SHAPE = {
    // kind 'cone': stacked triangles. snow: highlight covers the top of each tier.
    pine: { h: 10, tw: 1, crown: 2.6, low: 2.5, kind: 'cone', tiers: TIERS_PINE },
    snowPine: { h: 10, tw: 1, crown: 2.6, low: 2.5, kind: 'cone', tiers: TIERS_PINE, snow: true },
    spruce: { h: 11, tw: 1, crown: 2.1, low: 1.8, kind: 'cone', tiers: TIERS_SPRUCE },
    // kind 'blobs': overlapping circles or ellipses [dx, y, rx, ry], then highlights.
    broad: {
        h: 7.5, tw: 1, crown: 4.2, low: 3.6, kind: 'blobs',
        main: [[0, 7.6, 3.4, 3.4], [-1.6, 6.3, 2.6, 2.6], [1.8, 6.4, 2.4, 2.4]],
        hi: [[-0.9, 8.4, 1.9, 1.9]]
    },
    birch: {
        h: 9, tw: 0.7, crown: 2.6, low: 5.6, kind: 'blobs', marks: true,
        main: [[0, 8.4, 1.9, 2.6], [-1.0, 6.6, 1.3, 1.5]],
        hi: [[0.5, 9.0, 1.0, 1.5]]
    },
    blossom: {
        h: 8.4, tw: 1, crown: 4.2, low: 4.6, kind: 'blobs',
        main: [[0, 8.6, 3.2, 3.2], [-2.0, 7.2, 2.4, 2.4], [2.1, 7.4, 2.3, 2.3], [0, 6.2, 2.2, 2.2]],
        hi: [[-1.0, 9.4, 1.6, 1.6], [1.8, 8.3, 1.1, 1.1]]
    },
    blossomWide: {
        h: 7.6, tw: 1, crown: 5, low: 4.8, kind: 'blobs',
        main: [[0, 8.0, 4.6, 2.0], [-2.4, 7.0, 2.4, 1.5], [2.5, 7.1, 2.3, 1.4]],
        hi: [[-1.0, 8.8, 2.2, 0.9], [2.2, 7.7, 1.2, 0.6]]
    },
    scots: {
        h: 14, tw: 1, crown: 3.1, low: 10.4, kind: 'blobs',
        main: [[0, 12.6, 3.0, 1.1], [-1.7, 11.4, 1.8, 0.9], [1.8, 11.7, 1.9, 0.9]],
        hi: [[0, 13.1, 1.6, 0.5]]
    },
    // Redwoods: very tall, foliage only high up, bark lines and flat root flares.
    redwoodTall: {
        h: 27, tw: 1, crown: 2.1, low: 14.4, kind: 'blobs', bark: true,
        main: [[0, 22.6, 1.9, 3.4], [-0.6, 18.8, 1.6, 2.4], [0.7, 16.4, 1.3, 1.8]],
        hi: [[0.4, 23.6, 0.9, 1.8]]
    },
    redwoodBroad: {
        h: 22, tw: 1, crown: 5.6, low: 14.5, kind: 'blobs', bark: true,
        main: [[0, 18.6, 3.4, 2.4], [-2.2, 16.5, 2.4, 1.8], [2.2, 16.7, 2.3, 1.7]],
        hi: [[-0.8, 19.7, 1.8, 1.1]]
    },
    redwoodCone: { h: 25, tw: 1, crown: 2.3, low: 10, kind: 'cone', tiers: TIERS_REDWOOD, bark: true },
    // kind 'twigs': bare branches [x0, y0, x1, y1] from the trunk, snow dots at the tips.
    bare: {
        h: 8, tw: 1, crown: 3, low: 4.8, kind: 'twigs',
        twigs: [[0, 5, -2.3, 8.4], [0, 5.6, 2.1, 8.8], [0, 6.8, -0.6, 9.8], [-1.3, 7.1, -2.9, 7.7], [1.3, 7.4, 2.7, 8.6]],
        tips: [[-2.3, 8.4], [2.1, 8.8], [-0.6, 9.8]]
    },
    bareBirch: {
        h: 9, tw: 0.7, crown: 2.4, low: 5.4, kind: 'twigs', marks: true,
        twigs: [[0, 6, -1.7, 8.8], [0, 6.8, 1.6, 9.2], [0, 7.8, 0.2, 10.4]],
        tips: [[-1.7, 8.8], [1.6, 9.2]]
    }
};

const SHAPE_SETS = {
    spring: [SHAPE.pine, SHAPE.broad, SHAPE.birch],
    autumn: [SHAPE.pine, SHAPE.broad, SHAPE.birch],
    winter: [SHAPE.snowPine, SHAPE.bare, SHAPE.bareBirch],
    redwood: [SHAPE.redwoodTall, SHAPE.redwoodBroad, SHAPE.redwoodCone],
    pine: [SHAPE.spruce, SHAPE.pine, SHAPE.scots],
    cherry: [SHAPE.blossom, SHAPE.blossomWide, SHAPE.pine]
};

// ---------------------------------------------------------------------------

const VIGNETTE_TIME = 0.3;       // crash: dark red edge vignette fades once over this long
const VIGNETTE_PEAK = 0.65;      // its alpha at the screen edge at the start
const BADGE_TIME = 0.4;          // reduce motion: a static event badge fades over this long
const SHAKE_TIME = 0.45;
const BOUNCE_TIME = 0.3;
const CHIP_COUNT = 9;
const COLLECT_TIME = 0.3;
const RESPAWN_TIME = 0.6;
const CATCH_TIME = 1.2;
const CATCH_PAW_TIME = 0.5;
const SMASH_TIME = 0.5;
const SMASH_ZOOM = 0.07;         // scene zoom at the peak of the forward jolt
const HAZARD_HAZE = 0.4;         // far haze for hazards, lighter than trees so they read early
const FOX_HEIGHT = 1.7;          // sprite height in sprite units (ear tips included)
const FOX_MAX_SCREEN = 0.45;     // largest on-screen fox height as a fraction of view.h
const CUE = '#19e6ff';           // catchable cue colour, apart from forest, gold shield and orange fox
const CUE_EDGE = '#06303a';
const SHAPE_SWITCH_Z = 100;      // on a theme change, trees farther than this change shape at once

let skyGradient = null;
let skyKey = '';
let groundGradient = null;
let groundKey = '';
const order = [];

// Per tree shape set. A tree keeps the shape set it was first drawn with until it
// is recycled to the far end, so near trees never change shape under the rider.
const treeLook = new WeakMap();

// Ground specks: fixed pseudo random layout, rebuilt identically on load.
const SPECK_COUNT = 56;
const SPECK_SPAN = 26;
const SPECK_DEPTH = 70;
const specks = [];
for (let i = 0; i < SPECK_COUNT; i++) {
    const a = Math.sin(i * 12.9898 + 1.3) * 43758.5453;
    const b = Math.sin(i * 78.233 + 4.1) * 24634.6345;
    specks.push({
        x: (a - Math.floor(a)) * SPECK_SPAN,
        z: (b - Math.floor(b)) * SPECK_DEPTH,
        light: i % 3 === 0
    });
}

// Stars: fixed positions as fractions of a box a little larger than the sky.
const STAR_COUNT = 70;
const stars = [];
for (let i = 0; i < STAR_COUNT; i++) {
    const a = Math.sin(i * 9.1 + 0.7) * 31415.9265;
    const b = Math.sin(i * 41.7 + 2.9) * 27182.8183;
    stars.push({ x: a - Math.floor(a), y: b - Math.floor(b), big: i % 6 === 0 });
}

// Drifting snow and petals: fixed seeds, positions come from the render clock.
const PARTICLE_COUNT = 40;
const flakes = [];
for (let i = 0; i < PARTICLE_COUNT; i++) {
    const a = Math.sin(i * 17.3 + 0.4) * 9631.7;
    const b = Math.sin(i * 53.9 + 3.3) * 7919.3;
    const c = Math.sin(i * 29.1 + 1.9) * 5557.1;
    flakes.push({ x: a - Math.floor(a), y: b - Math.floor(b), r: c - Math.floor(c), ph: i * 1.7 });
}

// Tree colours (trunk, trunk light, foliage, highlight, mark) faded towards the haze.
function mixColours(variant, level) {
    const idx = variant * HAZE_LEVELS + level;
    let set = cur.hz[idx];
    if (set) return set;
    const v = cur.v;
    const f = (level / (HAZE_LEVELS - 1)) * MAX_HAZE;
    const h = S_HAZE * 3;
    set = [];
    for (let k = 0; k < 5; k++) {
        const o = (S_TREE + variant * 5 + k) * 3;
        const r = Math.round(v[o] + (v[h] - v[o]) * f);
        const g = Math.round(v[o + 1] + (v[h + 1] - v[o + 1]) * f);
        const b = Math.round(v[o + 2] + (v[h + 2] - v[o + 2]) * f);
        set.push('rgb(' + r + ',' + g + ',' + b + ')');
    }
    cur.hz[idx] = set;
    return set;
}

function drawSky(ctx, view, reach) {
    const key = view.horizonY + '|' + reach + '|' + cur.id;
    if (key !== skyKey) {
        const g = ctx.createLinearGradient(0, view.horizonY - reach, 0, view.horizonY);
        g.addColorStop(0, cur.skyTop);
        g.addColorStop(0.6, cur.skyMid);
        g.addColorStop(1, cur.skyLow);
        skyGradient = g;
        skyKey = key;
    }
    ctx.fillStyle = skyGradient;
    ctx.fillRect(view.w / 2 - reach, view.horizonY - reach, reach * 2, reach);
    if (cur.night > 0.01) drawNightSky(ctx, view, cur.night);
}

// Stars and moon, flat shapes. Fixed in the sky box, they roll with the scene.
function drawNightSky(ctx, view, amount) {
    const w = view.w;
    const hy = view.horizonY;
    const unit = Math.min(w, view.h);
    const px = Math.max(1, unit / 330);
    ctx.globalAlpha = amount;
    ctx.fillStyle = '#dfe6ff';
    ctx.beginPath();
    for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const x = w * (s.x * 1.5 - 0.25);
        const y = hy * (s.y * 1.2 - 0.2);
        if (y > hy * 0.97) continue;
        const size = s.big ? px * 2.2 : px * 1.3;
        ctx.rect(x, y, size, size);
    }
    ctx.fill();

    const mr = Math.max(8, unit * 0.055);
    const mx = w * 0.74;
    const my = Math.max(mr * 1.6, hy * 0.3);
    ctx.fillStyle = 'rgba(190,205,255,0.1)';
    ctx.beginPath();
    ctx.arc(mx, my, mr * 2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#f1efdc';
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#d6d6c4';
    ctx.beginPath();
    ctx.arc(mx - mr * 0.3, my - mr * 0.2, mr * 0.22, 0, TAU);
    ctx.moveTo(mx + mr * 0.4 + mr * 0.15, my + mr * 0.3);
    ctx.arc(mx + mr * 0.4, my + mr * 0.3, mr * 0.15, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
}

function hillHeight(x, seed, amp) {
    return amp * (0.55 + 0.25 * Math.sin(x * 0.011 + seed) + 0.15 * Math.sin(x * 0.027 + seed * 2.3) + 0.05 * Math.sin(x * 0.07 + seed * 5.1));
}

function drawTreeline(ctx, state, view, reach) {
    const hy = view.horizonY;
    const unit = Math.min(view.w, view.h);
    const left = view.w / 2 - reach;
    const right = view.w / 2 + reach;
    const step = Math.max(6, unit / 40);

    // Far layer shifts less, near layer shifts more.
    const layers = [
        { colour: cur.hillFar, amp: unit * 0.09, par: 2.2, seed: 1.7, jag: 0.0 },
        { colour: cur.hillNear, amp: unit * 0.065, par: 4.4, seed: 4.2, jag: 1.0 }
    ];
    for (let l = 0; l < layers.length; l++) {
        const L = layers[l];
        const shift = -state.player.x * L.par * (unit / 390);
        ctx.fillStyle = L.colour;
        ctx.beginPath();
        ctx.moveTo(left, hy + 2);
        for (let x = left; x <= right + step; x += step) {
            const sx = x - shift;
            let h = hillHeight(sx, L.seed, L.amp);
            if (L.jag) {
                // Small spiky pine tops on the nearer layer.
                const k = Math.floor(sx / step);
                h += ((Math.sin(k * 5.17) * 0.5 + 0.5) * 0.5 + (k % 2 ? 0.35 : 0)) * L.amp * 0.45;
            }
            ctx.lineTo(x, hy - h);
        }
        ctx.lineTo(right + step, hy + 2);
        ctx.closePath();
        ctx.fill();
    }
}

function drawGround(ctx, state, view, reach) {
    const hy = view.horizonY;
    const span = view.h - hy;
    const key = hy + '|' + span + '|' + reach + '|' + cur.id;
    if (key !== groundKey) {
        const g = ctx.createLinearGradient(0, hy, 0, hy + Math.max(span, 1));
        g.addColorStop(0, cur.groundFar);
        g.addColorStop(0.22, cur.groundMid);
        g.addColorStop(1, cur.groundNear);
        groundGradient = g;
        groundKey = key;
    }
    ctx.fillStyle = groundGradient;
    ctx.fillRect(view.w / 2 - reach, hy, reach * 2, reach);

    const left = view.w / 2 - reach;
    const width = reach * 2;
    const camH = CONFIG.cameraHeight + (state.player.y || 0);
    const focal = view.focal;
    const dist = state.distance;

    // Perspective bands: alternate world stripes flow towards the camera.
    const sp = 4;
    const maxZ = 90;
    const firstIdx = Math.floor(dist / sp);
    ctx.fillStyle = cur.band;
    for (let i = firstIdx; ; i++) {
        const z0 = i * sp - dist;
        if (z0 > maxZ) break;
        if ((i & 1) === 0) continue;
        const za = Math.max(z0, 0.35);
        const zb = z0 + sp;
        if (zb <= 0.35) continue;
        const ya = hy + camH * focal / za;
        const yb = hy + camH * focal / zb;
        if (ya - yb < 0.4) continue;
        ctx.fillRect(left, yb, width, ya - yb);
    }

    // Specks of leaf litter, needles, snow crust or petals.
    const px = state.player.x;
    for (let i = 0; i < specks.length; i++) {
        const s = specks[i];
        let z = (s.z - dist) % SPECK_DEPTH;
        if (z < 0) z += SPECK_DEPTH;
        z += 0.8;
        let rel = (s.x - px) % SPECK_SPAN;
        if (rel < 0) rel += SPECK_SPAN;
        rel -= SPECK_SPAN / 2;
        const scale = focal / z;
        const sx = view.w / 2 + rel * scale;
        const sy = hy + camH * scale;
        const size = Math.max(1, 0.1 * scale);
        ctx.fillStyle = s.light ? cur.speckLight : cur.speckDark;
        ctx.fillRect(sx - size, sy, size * 2.2, Math.max(1, size * 0.5));
    }
}

// Slow snow and drifting petals, screen space, positions from the render clock
// so a pause holds them still. One path per kind, at most PARTICLE_COUNT dots.
function drawParticles(ctx, view) {
    const snow = cur.snow;
    const petal = cur.petal;
    if (snow < 0.02 && petal < 0.02) return;
    const w = view.w;
    const h = view.h;
    const unit = Math.min(w, h) / 390;
    const t = animTime();
    if (snow >= 0.02) {
        ctx.globalAlpha = Math.min(1, snow) * 0.9;
        ctx.fillStyle = '#f4f8ff';
        ctx.beginPath();
        for (let i = 0; i < flakes.length; i++) {
            const f = flakes[i];
            const fall = 0.035 + f.r * 0.045;
            const y = ((f.y + t * fall) % 1) * (h + 12) - 6;
            const x = (((f.x + t * 0.004 + Math.sin(t * 0.55 + f.ph) * 0.02) % 1) + 1) % 1 * w;
            const r = (1.1 + f.r * 1.9) * unit;
            ctx.moveTo(x + r, y);
            ctx.arc(x, y, r, 0, TAU);
        }
        ctx.fill();
    }
    if (petal >= 0.02) {
        ctx.globalAlpha = Math.min(1, petal) * 0.85;
        ctx.fillStyle = '#fbc9da';
        ctx.beginPath();
        for (let i = 0; i < flakes.length; i++) {
            const f = flakes[i];
            const fall = 0.03 + f.r * 0.03;
            const y = ((f.y + t * fall) % 1) * (h + 12) - 6;
            const x = (((f.x + t * (0.012 + f.r * 0.01) + Math.sin(t * 0.8 + f.ph) * 0.025) % 1) + 1) % 1 * w;
            const r = (1.5 + f.r * 1.8) * unit;
            ctx.moveTo(x + r, y);
            ctx.ellipse(x, y, r, r * 0.55, t * 0.7 + f.ph, 0, TAU);
        }
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function addBlob(ctx, sx, baseY, scale, b) {
    const x = sx + b[0] * scale;
    const y = baseY - b[1] * scale;
    ctx.moveTo(x + b[2] * scale, y);
    if (b[2] === b[3]) ctx.arc(x, y, b[2] * scale, 0, TAU);
    else ctx.ellipse(x, y, b[2] * scale, b[3] * scale, 0, 0, TAU);
}

function drawTree(ctx, tree, view, margin, forceCurrent) {
    const z = tree.z;
    const scale = view.focal / z;
    const sx = view.w / 2 + (tree.x - drawTree.px) * scale;
    const baseY = view.horizonY + drawTree.camH * scale;
    const variant = tree.variant % 3;

    // Shape set: a tree keeps the one it had until it is recycled far away.
    let set = SHAPE_SETS[blend.goalName] || SHAPE_SETS.spring;
    if (!forceCurrent) {
        let look = treeLook.get(tree);
        if (look === undefined) {
            look = { set: set, epoch: blend.epoch };
            treeLook.set(tree, look);
        } else if (look.epoch !== blend.epoch) {
            look.set = set;
            look.epoch = blend.epoch;
        } else if (look.set !== set && z > SHAPE_SWITCH_Z) {
            look.set = set;
        }
        set = look.set;
    }
    const shape = set[variant];

    const tw = 2 * CONFIG.trunkRadius * scale * shape.tw;
    const crownHalf = shape.crown * scale;
    if (sx + crownHalf < -margin || sx - crownHalf > view.w + margin) {
        // Trunk may still reach the edge only if inside the crown span, so skip.
        return;
    }

    // Haze and fade in.
    const spawn = CONFIG.spawnDistance;
    let f = z / spawn;
    if (f > 1) f = 1;
    const level = Math.round(Math.pow(f, 0.85) * (HAZE_LEVELS - 1));
    const col = mixColours(variant, level);
    const fadeStart = spawn * 0.85;
    let alpha = 1;
    if (z > fadeStart) {
        alpha = (spawn - z) / (spawn - fadeStart);
        if (alpha <= 0) return;
        if (alpha > 1) alpha = 1;
    }
    if (alpha < 1) ctx.globalAlpha = alpha;

    const topY = baseY - shape.h * scale;

    // Ground contact shadow.
    if (baseY < view.h * 3) {
        ctx.fillStyle = 'rgba(20,18,8,0.28)';
        ctx.beginPath();
        ctx.ellipse(sx, baseY, tw * 1.5 + 1, tw * 0.3 + 0.5, 0, 0, TAU);
        ctx.fill();
    }

    // Trunk.
    ctx.fillStyle = col[0];
    ctx.fillRect(sx - tw / 2, topY, tw, baseY - topY);
    if (tw > 3) {
        ctx.fillStyle = col[1];
        ctx.fillRect(sx - tw / 2, topY, tw * 0.32, baseY - topY);
    }
    if (shape.marks && tw > 4) {
        // Dark bark marks on the birch, positions fixed per tree.
        ctx.fillStyle = col[4];
        const seed = Math.abs(Math.sin(tree.x * 7.31 + 2.1));
        for (let m = 0; m < 5; m++) {
            const t = 0.08 + ((m * 0.19 + seed * 0.3) % 0.85);
            const my = baseY - t * (baseY - topY);
            const mw = tw * (0.35 + 0.4 * ((m * 0.37 + seed) % 1));
            const mx = sx - tw / 2 + ((m * 0.43 + seed) % 1) * (tw - mw);
            ctx.fillRect(mx, my, mw, Math.max(1, tw * 0.1));
        }
    }
    if (shape.bark && tw > 3) {
        // Redwood: long dark bark furrows and flat root flares. The flares add
        // only a few pixels, so the base stays about as wide as the trunk.
        const seed = Math.abs(Math.sin(tree.x * 5.17 + 1.3));
        const lw = Math.max(1, tw * 0.07);
        ctx.fillStyle = col[4];
        for (let m = 0; m < 4; m++) {
            const fx = 0.18 + ((m * 0.27 + seed * 0.6) % 0.7);
            ctx.fillRect(sx - tw / 2 + fx * tw, topY, lw, baseY - topY);
        }
        ctx.fillStyle = col[1];
        ctx.fillRect(sx - tw / 2 + tw * (0.12 + seed * 0.1), topY, lw, baseY - topY);
        const e = Math.min(3, tw * 0.1);
        const rh = Math.min(3.2 * scale, baseY - topY);
        ctx.fillStyle = col[0];
        ctx.beginPath();
        ctx.moveTo(sx - tw / 2 - e, baseY);
        ctx.lineTo(sx - tw / 2, baseY - rh);
        ctx.lineTo(sx - tw / 2, baseY);
        ctx.moveTo(sx + tw / 2 + e, baseY);
        ctx.lineTo(sx + tw / 2, baseY - rh);
        ctx.lineTo(sx + tw / 2, baseY);
        ctx.fill();
    }

    // Foliage. Skipped when entirely above the screen.
    if (baseY - shape.low * scale > -4) {
        const kind = shape.kind;
        if (kind === 'cone') {
            const tiers = shape.tiers;
            ctx.fillStyle = col[2];
            ctx.beginPath();
            for (let t = 0; t < tiers.length; t++) {
                const b = baseY - tiers[t][0] * scale;
                const a = baseY - (tiers[t][0] + tiers[t][1]) * scale;
                const hw = tiers[t][2] * scale;
                ctx.moveTo(sx - hw, b);
                ctx.lineTo(sx, a);
                ctx.lineTo(sx + hw, b);
                ctx.closePath();
            }
            ctx.fill();
            if (crownHalf > 5) {
                ctx.fillStyle = col[3];
                ctx.beginPath();
                for (let t = 0; t < tiers.length; t++) {
                    const b = baseY - tiers[t][0] * scale;
                    const a = baseY - (tiers[t][0] + tiers[t][1]) * scale;
                    const hw = tiers[t][2] * scale;
                    if (shape.snow) {
                        // Snow cap: the upper part of the tier, a little narrower.
                        const m = b + (a - b) * 0.62;
                        ctx.moveTo(sx - hw * 0.38, m);
                        ctx.lineTo(sx, a);
                        ctx.lineTo(sx + hw * 0.38, m);
                        ctx.lineTo(sx + hw * 0.1, m + (b - m) * 0.2);
                        ctx.lineTo(sx - hw * 0.15, m + (b - m) * 0.1);
                    } else {
                        ctx.moveTo(sx - hw, b);
                        ctx.lineTo(sx, a);
                        ctx.lineTo(sx - hw * 0.2, b);
                    }
                    ctx.closePath();
                }
                ctx.fill();
            }
        } else if (kind === 'blobs') {
            ctx.fillStyle = col[2];
            ctx.beginPath();
            for (let i = 0; i < shape.main.length; i++) addBlob(ctx, sx, baseY, scale, shape.main[i]);
            ctx.fill();
            if (crownHalf > 5) {
                ctx.fillStyle = col[3];
                ctx.beginPath();
                for (let i = 0; i < shape.hi.length; i++) addBlob(ctx, sx, baseY, scale, shape.hi[i]);
                ctx.fill();
            }
        } else {
            // Bare branches with snow on the tips.
            const tws = shape.twigs;
            ctx.strokeStyle = col[2];
            ctx.lineWidth = Math.max(1, scale * 0.22);
            ctx.lineCap = 'round';
            ctx.beginPath();
            for (let i = 0; i < tws.length; i++) {
                ctx.moveTo(sx + tws[i][0] * scale, baseY - tws[i][1] * scale);
                ctx.lineTo(sx + tws[i][2] * scale, baseY - tws[i][3] * scale);
            }
            ctx.stroke();
            if (crownHalf > 5) {
                ctx.fillStyle = col[3];
                ctx.beginPath();
                for (let i = 0; i < shape.tips.length; i++) {
                    const x = sx + shape.tips[i][0] * scale;
                    const y = baseY - shape.tips[i][1] * scale;
                    ctx.moveTo(x + scale * 0.5, y);
                    ctx.arc(x, y, scale * 0.5, 0, TAU);
                }
                ctx.fill();
            }
        }
    }
    if (alpha < 1) ctx.globalAlpha = 1;
}
drawTree.px = 0;
drawTree.camH = CONFIG.cameraHeight;

export function drawScene(ctx, state, view) {
    updateAnim(state);
    resolvePalette(state);
    const w = view.w;
    const h = view.h;
    const hy = view.horizonY;
    const reach = Math.hypot(w, h) * 1.1;

    const crashed = state.mode === 'crashed';
    const ct = crashed ? state.time - state.crashTime : -1;
    const unit = Math.min(w, h);
    // Reduce motion: no shake, jolt, zoom, roll or drifting particles.
    const calm = !!state.reduceMotion;

    ctx.save();

    // Crash shake.
    if (!calm && crashed && ct >= 0 && ct < SHAKE_TIME) {
        const amp = (1 - ct / SHAKE_TIME) * unit * 0.018;
        ctx.translate(Math.sin(ct * 95) * amp, Math.cos(ct * 73) * amp);
    }

    // Bounce jolt: a short sideways kick towards bounceDir that settles fast.
    const bt = bounceAge(state);
    const jolt = calm ? -1 : bt;
    if (jolt >= 0) {
        const k = bounceKick(bt);
        ctx.translate(state.bounceDir * unit * 0.07 * k, 0);
    }

    // Smash: a short forward jolt, the scene pushes towards the camera and settles.
    const live = state.mode === 'riding' || state.mode === 'paused';
    const sma = live ? effectAge('smash', state.smashTime, state) : -1;
    if (!calm && sma >= 0 && sma < SMASH_TIME) {
        const z = 1 + SMASH_ZOOM * smashJolt(sma);
        ctx.translate(w / 2, hy);
        ctx.scale(z, z);
        ctx.translate(-w / 2, -hy);
    }

    // Lean: roll the world about the horizon centre.
    ctx.translate(w / 2, hy);
    if (!calm) ctx.rotate(-state.player.steer * CONFIG.maxLean + (bt >= 0 ? state.bounceDir * 0.035 * bounceKick(bt) : 0));
    ctx.translate(-w / 2, -hy);

    drawSky(ctx, view, reach);
    drawTreeline(ctx, state, view, reach);
    drawGround(ctx, state, view, reach);

    // Collect trees, ramps and the fox into one reused array, sort far to near.
    order.length = 0;
    const hazards = state.hazards;
    const trees = state.trees;
    for (let i = 0; i < trees.length; i++) {
        // A bear or falling tree draws its own trunk, so its tree is left out here.
        if (trees[i].z > CONFIG.nearPlane && !(hazards && hazardTree(trees[i], hazards))) order.push(trees[i]);
    }
    if (hazards) {
        for (let i = 0; i < hazards.length; i++) {
            if (hazards[i].z > CONFIG.nearPlane) order.push(hazards[i]);
        }
    }
    const ramps = state.ramps;
    if (ramps) {
        for (let i = 0; i < ramps.length; i++) {
            if (ramps[i].z > CONFIG.nearPlane) order.push(ramps[i]);
        }
    }
    const pickups = state.pickups;
    if (pickups) {
        for (let i = 0; i < pickups.length; i++) {
            if (pickups[i].z > CONFIG.nearPlane) order.push(pickups[i]);
        }
    }
    const fox = state.fox;
    if (fox && fox.z > CONFIG.nearPlane) order.push(fox);
    order.sort(byDepthDesc);

    drawTree.px = state.player.x;
    drawTree.camH = CONFIG.cameraHeight + (state.player.y || 0);
    const margin = Math.max(w, h) * 0.2;
    for (let i = 0; i < order.length; i++) {
        const o = order[i];
        if (o.variant !== undefined) {
            drawTree(ctx, o, view, margin);
        } else if (o === fox) {
            drawFoxAt(ctx, fox, state, view);
        } else if (o.type === 'log' || o.type === 'fall' || o.type === 'bear') {
            drawHazardAt(ctx, o, state, view, margin);
        } else if (o.type !== undefined) {
            drawPickupAt(ctx, o, state, view);
        } else {
            drawRampAt(ctx, o, state, view);
        }
    }
    order.length = 0;

    if (fox && fox.z > CONFIG.nearPlane && catchable(state)) drawCueArrow(ctx, fox, state, view);

    if (!calm && state.player.boost > 0 && (state.mode === 'riding' || state.mode === 'paused')) drawBoostLines(ctx, state, view);

    ctx.restore();

    if (!calm) drawParticles(ctx, view);

    if (calm) {
        // Event badges: still, in the place of each burst, fading over BADGE_TIME.
        if (state.mode === 'riding' && state.bounceTime && state.bounceDir) {
            const xa = effectAge('bounce', state.bounceTime, state);
            if (xa >= 0 && xa < BADGE_TIME) drawBadge(ctx, 'star', Math.max(unit * 0.11, Math.min(w - unit * 0.11, w / 2 - state.bounceDir * w * 0.4)), view.horizonY + (view.h - view.horizonY) * 0.3, unit * 0.1, xa);
        }
        if (live) {
            if (sma >= 0 && sma < BADGE_TIME) drawBadge(ctx, 'smash', w / 2, h * 0.7, unit * 0.11, sma);
            const pa = effectAge('pickup', state.pickupTime, state);
            if (pa >= 0 && pa < BADGE_TIME) drawBadge(ctx, 'pickup', w / 2, h - unit * 0.44, unit * 0.09, pa, BURST[state.pickupType] || BURST.berry);
            const sa = effectAge('snake', state.snakeTime, state);
            if (sa >= 0 && sa < BADGE_TIME) {
                const target = foxScreen(state, view);
                drawBadge(ctx, 'snake', target.x, target.y, unit * 0.08, sa);
            }
            const ra = effectAge('respawn', state.respawnTime, state);
            if (ra >= 0 && ra < BADGE_TIME) drawBadge(ctx, 'acorn', w / 2, h * 0.5, unit * 0.13, ra);
            const ka = effectAge('catch', state.catchTime, state);
            if (ka >= 0 && ka < BADGE_TIME) drawBadge(ctx, 'paw', w / 2, h * 0.5, unit * 0.15, ka);
        }
    } else if (bt >= 0) {
        drawBounceBurst(ctx, state, view, bt);
    }

    if (live) {
        if (!calm) {
            if (sma >= 0 && sma < SMASH_TIME) drawSmash(ctx, view, sma, SMASH_TIME);
            const pa = effectAge('pickup', state.pickupTime, state);
            if (pa >= 0 && pa < COLLECT_TIME) drawCollectBurst(ctx, state, view, pa);
            const sa = effectAge('snake', state.snakeTime, state);
            if (sa >= 0 && sa < CONFIG.snakeFlightTime) drawSnakeFlight(ctx, state, view, sa / CONFIG.snakeFlightTime);
            const ra = effectAge('respawn', state.respawnTime, state);
            if (ra >= 0 && ra < RESPAWN_TIME) drawRespawnBurst(ctx, view, ra);
            const ka = effectAge('catch', state.catchTime, state);
            if (ka >= 0 && ka < CATCH_TIME) drawCatchCelebration(ctx, view, ka);
        }
        const ba = effectAge('bird', state.birdTime, state);
        if (ba >= 0 && ba < CONFIG.birdBlockTime + BIRD_FEATHER_TIME) drawBird(ctx, view, ba, state.birdDir, CONFIG.birdBlockTime, calm);
    }

    // Crash: a dark red vignette at the screen edges, once. No full screen flash.
    if (crashed && ct >= 0 && ct < VIGNETTE_TIME) drawCrashVignette(ctx, view, 1 - ct / VIGNETTE_TIME);
}

// Dark red edge vignette. Strips of 7 percent of the short side along each edge, about
// a fifth of the screen at most, fading from VIGNETTE_PEAK at the edge to nothing.
// Gradients are cached and rebuilt only when the view size changes.
let vigKey = '';
let vigL = null;
let vigR = null;
let vigT = null;
let vigB = null;

function drawCrashVignette(ctx, view, k) {
    const w = view.w;
    const h = view.h;
    const bw = Math.min(w, h) * 0.07;
    const key = w + '|' + h;
    if (key !== vigKey) {
        const edge = 'rgba(96,0,0,' + VIGNETTE_PEAK + ')';
        const none = 'rgba(96,0,0,0)';
        vigL = ctx.createLinearGradient(0, 0, bw, 0);
        vigR = ctx.createLinearGradient(w, 0, w - bw, 0);
        vigT = ctx.createLinearGradient(0, 0, 0, bw);
        vigB = ctx.createLinearGradient(0, h, 0, h - bw);
        const all = [vigL, vigR, vigT, vigB];
        for (let i = 0; i < all.length; i++) {
            all[i].addColorStop(0, edge);
            all[i].addColorStop(1, none);
        }
        vigKey = key;
    }
    ctx.globalAlpha = Math.max(0, Math.min(1, k));
    ctx.fillStyle = vigL;
    ctx.fillRect(0, 0, bw, h);
    ctx.fillStyle = vigR;
    ctx.fillRect(w - bw, 0, bw, h);
    ctx.fillStyle = vigT;
    ctx.fillRect(0, 0, w, bw);
    ctx.fillStyle = vigB;
    ctx.fillRect(0, h - bw, w, bw);
    ctx.globalAlpha = 1;
}

// Reduce motion event badge: a dark disc, a pale ring and a small glyph, drawn
// still at x, y and faded out by t (seconds, of BADGE_TIME). Nothing moves.
function drawBadge(ctx, kind, x, y, r, t, cols) {
    const a = Math.max(0, 1 - t / BADGE_TIME);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(x, y);
    ctx.lineJoin = 'round';
    ctx.fillStyle = 'rgba(30,20,14,0.7)';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.14);
    ctx.strokeStyle = '#fff6dc';
    ctx.stroke();
    ctx.lineWidth = Math.max(1.5, r * 0.07);
    ctx.strokeStyle = 'rgba(28,18,10,0.9)';
    if (kind === 'star') {
        ctx.fillStyle = '#ffecaa';
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const ang = i * Math.PI / 4 + 0.4;
            const rr = i % 2 ? r * 0.3 : r * 0.7;
            if (i === 0) ctx.moveTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
            else ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    } else if (kind === 'pickup') {
        const c = cols || BURST.berry;
        ctx.fillStyle = c[0];
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.5, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = c[1];
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.34);
        ctx.lineTo(r * 0.26, 0);
        ctx.lineTo(0, r * 0.34);
        ctx.lineTo(-r * 0.26, 0);
        ctx.closePath();
        ctx.fill();
    } else if (kind === 'smash') {
        // Two crossed splinters.
        ctx.fillStyle = '#ecd2a0';
        for (let i = 0; i < 2; i++) {
            ctx.save();
            ctx.rotate(i ? -0.75 : 0.75);
            ctx.beginPath();
            ctx.rect(-r * 0.62, -r * 0.1, r * 1.24, r * 0.2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }
    } else if (kind === 'acorn') {
        ctx.fillStyle = '#e2aa5a';
        ctx.beginPath();
        ctx.arc(0, r * 0.08, r * 0.42, 0, Math.PI);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#5c3418';
        ctx.beginPath();
        ctx.arc(0, r * 0.08, r * 0.46, Math.PI, TAU);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    } else if (kind === 'snake') {
        ctx.strokeStyle = 'rgba(20,60,20,0.9)';
        ctx.fillStyle = '#46d638';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.45, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.2, 0, TAU);
        ctx.stroke();
    } else {
        // Paw stamp.
        ctx.rotate(-0.3);
        ctx.translate(0, r * 0.05);
        pawPrint(ctx, r * 0.62);
        ctx.fillStyle = '#fffdf2';
        ctx.fill();
        ctx.stroke();
    }
    ctx.restore();
}

// Jolt strength 0 to 1 to 0: quick push in, slower settle.
function smashJolt(t) {
    return t < 0.05 ? t / 0.05 : Math.exp(-(t - 0.05) * 10);
}

// True when a tree is the trunk of a bear or falling tree hazard.
function hazardTree(tree, hazards) {
    for (let i = 0; i < hazards.length; i++) {
        const hz = hazards[i];
        if (hz.type !== 'log' && Math.abs(hz.x - tree.x) < 0.05 && Math.abs(hz.z - tree.z) < 0.5) return true;
    }
    return false;
}

// Seconds since a falling tree hit the ground, -1 if it was not seen falling.
// Keyed by the hazard object, on the render clock so a pause holds it still.
const fallTrack = new WeakMap();
function fallDust(hz) {
    const now = animTime();
    let tr = fallTrack.get(hz);
    if (!tr) {
        tr = { last: hz.progress, impact: -1 };
        fallTrack.set(hz, tr);
    } else if (tr.last < 1 && hz.progress >= 1) {
        tr.impact = now;
    }
    tr.last = hz.progress;
    return tr.impact >= 0 ? now - tr.impact : -1;
}

const bearTree = { x: 0, z: 0, variant: 0 };

function drawHazardAt(ctx, hz, state, view, margin) {
    const dust = hz.type === 'fall' ? fallDust(hz) : -1;
    const scale = view.focal / hz.z;
    const sx = view.w / 2 + (hz.x - state.player.x) * scale;
    const baseY = view.horizonY + drawTree.camH * scale;
    const spawn = CONFIG.spawnDistance;
    const haze = Math.pow(Math.min(1, hz.z / spawn), 0.85) * HAZARD_HAZE;
    let alpha = 1;
    const fadeStart = spawn * 0.85;
    if (hz.z > fadeStart) alpha = Math.max(0, (spawn - hz.z) / (spawn - fadeStart));
    if (alpha <= 0) return;
    const dir = hz.dir < 0 ? -1 : 1;
    if (hz.type === 'log') {
        const half = CONFIG.logLength * scale / 2;
        if (sx + half < -margin || sx - half > view.w + margin) return;
        if (alpha < 1) ctx.globalAlpha = alpha;
        drawLog(ctx, sx, baseY, scale, haze, !!hz.broken);
    } else if (hz.type === 'fall') {
        const reach = (CONFIG.fallLength + 2) * scale;
        if (sx + reach < -margin || sx - reach > view.w + margin) return;
        if (alpha < 1) ctx.globalAlpha = alpha;
        drawFallingTree(ctx, sx, baseY, scale, dir, hz.progress || 0, haze, dust, !!state.reduceMotion);
    } else {
        if (Math.abs(sx - view.w / 2) > view.w / 2 + 4.5 * scale + margin) return;
        if (alpha < 1) ctx.globalAlpha = alpha;
        drawBear(ctx, sx, baseY, scale, dir, hz.progress || 0, haze);
        ctx.globalAlpha = 1;
        // Its tree is drawn straight after, so the trunk overlaps the bear. Never a
        // birch: the trunk edge the bear reaches past is CONFIG.trunkRadius.
        let variant = Math.abs(Math.floor(hz.x * 7.3 + hz.z * 0.1)) % 2;
        for (let i = 0; i < state.trees.length; i++) {
            const t = state.trees[i];
            if (Math.abs(hz.x - t.x) < 0.05 && Math.abs(hz.z - t.z) < 0.5) {
                if (t.variant !== 2) variant = t.variant;
                break;
            }
        }
        bearTree.x = hz.x;
        bearTree.z = hz.z;
        bearTree.variant = variant;
        drawTree(ctx, bearTree, view, margin, true);
    }
    if (alpha < 1) ctx.globalAlpha = 1;
}

// Seconds since the last bounce while it is still playing, else -1.
// Tolerates missing fields (no bounce).
function bounceAge(state) {
    if (state.mode !== 'riding' || !state.bounceTime || !state.bounceDir) return -1;
    const t = state.time - state.bounceTime;
    return t >= 0 && t < BOUNCE_TIME ? t : -1;
}

// Kick strength 1 to 0: sharp attack, quick settle.
function bounceKick(t) {
    const u = 1 - t / BOUNCE_TIME;
    return u * u * Math.cos(t * 9);
}

// Star flash and bark chips at the side the trunk was on (opposite to bounceDir).
function drawBounceBurst(ctx, state, view, t) {
    const unit = Math.min(view.w, view.h);
    const side = -state.bounceDir;
    const ox = view.w / 2 + side * view.w * 0.4;
    const oy = view.horizonY + (view.h - view.horizonY) * 0.3;
    const u = t / BOUNCE_TIME;
    const alpha = Math.max(0, 1 - u * u);

    // Star flash for the first part of the burst.
    if (t < 0.12) {
        const r = unit * (0.05 + 0.1 * (t / 0.12));
        ctx.fillStyle = 'rgba(255,236,170,' + (0.9 * (1 - t / 0.12)).toFixed(3) + ')';
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const a = i * Math.PI / 4 + 0.4;
            const rr = i % 2 ? r * 0.4 : r;
            const px = ox + Math.cos(a) * rr;
            const py = oy + Math.sin(a) * rr;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
    }

    // Bark chips fly out, mostly away from the edge, and fall.
    const chip = unit * 0.016;
    for (let i = 0; i < CHIP_COUNT; i++) {
        const a = -1.9 + (i / (CHIP_COUNT - 1)) * 3.8 + (i % 2) * 0.2;
        const speed = unit * (0.35 + 0.25 * ((i * 0.37) % 1));
        const px = ox - side * Math.abs(Math.cos(a)) * speed * t;
        const py = oy + Math.sin(a) * speed * t + unit * 1.2 * t * t;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = i % 3 === 0 ? '#c8a273' : i % 3 === 1 ? '#6a4a30' : '#8f6a46';
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(i * 1.3 + t * 12);
        ctx.fillRect(-chip, -chip * 0.5, chip * 2, chip);
        ctx.restore();
    }
    ctx.globalAlpha = 1;
}

// Catch celebration at the centre of the view: a quick bright ring, a paw
// stamp for the first CATCH_PAW_TIME, and multicoloured confetti and stars.
const CONFETTI = ['#19e6ff', '#ff3fa4', '#ffe23a', '#7dff4a', '#ffffff', '#a66bff'];

function pawPrint(ctx, r) {
    ctx.beginPath();
    ctx.ellipse(0, r * 0.35, r * 0.62, r * 0.5, 0, 0, 6.2832);
    for (let i = 0; i < 4; i++) {
        const a = (-0.5 + i / 3) * 1.5 - 1.5708;
        const tx = Math.cos(a) * r * 0.98;
        const ty = Math.sin(a) * r * 0.98 - r * 0.08;
        ctx.moveTo(tx + r * 0.22, ty);
        ctx.ellipse(tx, ty, r * 0.22, r * 0.28, a + 1.5708, 0, 6.2832);
    }
}

function drawCatchCelebration(ctx, view, t) {
    const unit = Math.min(view.w, view.h);
    const cx = view.w / 2;
    const cy = view.h * 0.5;
    const lw = Math.max(1, unit * 0.004);

    // Paw stamp: pops in with an overshoot, then fades.
    if (t < CATCH_PAW_TIME) {
        const u = t / CATCH_PAW_TIME;
        const pop = u < 0.2 ? 0.4 + 0.9 * (u / 0.2) : 1.3 - 0.3 * Math.min(1, (u - 0.2) / 0.2);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-0.3);
        ctx.globalAlpha = u < 0.6 ? 1 : Math.max(0, 1 - (u - 0.6) / 0.4);
        pawPrint(ctx, unit * 0.12 * pop);
        ctx.fillStyle = '#fffdf2';
        ctx.strokeStyle = '#1c1c24';
        ctx.lineWidth = Math.max(2, unit * 0.012);
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.fill();
        ctx.restore();
    }

    // Quick bright ring: cyan outside, white inside.
    if (t < 0.4) {
        const u = t / 0.4;
        const e = 1 - (1 - u) * (1 - u) * (1 - u);
        const r = unit * (0.08 + 0.5 * e);
        ctx.globalAlpha = 1 - u * u;
        ctx.lineWidth = Math.max(3, unit * 0.04 * (1 - u));
        ctx.strokeStyle = CUE;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 6.2832);
        ctx.stroke();
        ctx.lineWidth = Math.max(2, unit * 0.015 * (1 - u));
        ctx.strokeStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.93, 0, 6.2832);
        ctx.stroke();
    }

    // Confetti and stars: fly out with drag, then fall, fade at the end.
    const fade = t > CATCH_TIME - 0.3 ? Math.max(0, (CATCH_TIME - t) / 0.3) : 1;
    const drag = 1 - Math.exp(-t * 3.2);
    for (let i = 0; i < 34; i++) {
        const a = i * 2.39996 + 0.5;
        const sp = unit * (0.55 + 0.6 * ((i * 0.618) % 1));
        const px = cx + Math.cos(a) * sp * drag / 3.2 * 1.6;
        const py = cy + Math.sin(a) * sp * drag / 3.2 * 1.6 - unit * 0.1 * drag + unit * 0.5 * t * t;
        const r = unit * (0.014 + 0.008 * (i % 3));
        ctx.globalAlpha = fade;
        ctx.fillStyle = CONFETTI[i % CONFETTI.length];
        ctx.strokeStyle = 'rgba(20,16,30,0.75)';
        ctx.lineWidth = lw;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(i * 1.7 + t * (i % 2 ? 8 : -8));
        ctx.beginPath();
        if (i % 4 === 0) {
            const R = r * 1.7;
            for (let k = 0; k < 10; k++) {
                const rr = k % 2 ? R * 0.45 : R;
                const aa = k * Math.PI / 5 - 1.5708;
                if (k === 0) ctx.moveTo(Math.cos(aa) * rr, Math.sin(aa) * rr);
                else ctx.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr);
            }
            ctx.closePath();
        } else {
            // Flutter: the strip width flips as it spins.
            const fh = r * Math.max(0.3, Math.abs(Math.cos(t * 8 + i)));
            ctx.rect(-r, -fh / 2, r * 2, fh);
        }
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
    ctx.globalAlpha = 1;
}

function byDepthDesc(a, b) {
    return b.z - a.z;
}

function drawRampAt(ctx, ramp, state, view) {
    const scale = view.focal / ramp.z;
    const sx = view.w / 2 + (ramp.x - state.player.x) * scale;
    const baseY = view.horizonY + drawTree.camH * scale;
    if (Math.abs(sx - view.w / 2) > view.w + CONFIG.rampHalfWidth * scale) return;
    const f = Math.min(1, ramp.z / CONFIG.spawnDistance);
    let haze = Math.pow(f, 0.85) * 0.6;
    let alpha = 1;
    const fadeStart = CONFIG.spawnDistance * 0.85;
    if (ramp.z > fadeStart) alpha = Math.max(0, (CONFIG.spawnDistance - ramp.z) / (CONFIG.spawnDistance - fadeStart));
    if (alpha <= 0) return;
    if (alpha < 1) ctx.globalAlpha = alpha;
    drawRamp(ctx, sx, baseY, scale, haze);
    if (alpha < 1) ctx.globalAlpha = 1;
}

function drawPickupAt(ctx, p, state, view) {
    const scale = view.focal / p.z;
    const sx = view.w / 2 + (p.x - state.player.x) * scale;
    const baseY = view.horizonY + drawTree.camH * scale;
    if (Math.abs(sx - view.w / 2) > view.w + scale) return;
    const spawn = CONFIG.spawnDistance;
    const haze = Math.pow(Math.min(1, p.z / spawn), 0.85) * 0.4;
    let alpha = 1;
    const fadeStart = spawn * 0.85;
    if (p.z > fadeStart) alpha = Math.max(0, (spawn - p.z) / (spawn - fadeStart));
    if (alpha <= 0) return;
    if (alpha < 1) ctx.globalAlpha = alpha;
    drawPickup(ctx, p.type, sx, baseY, scale, haze, animTime(), p.x, false, !!state.reduceMotion);
    if (alpha < 1) ctx.globalAlpha = 1;
}

// Burst colours per pickup type: main, accent.
const BURST = {
    berry: ['#a3205e', '#e86aa6'],
    mushroom: ['#e22a22', '#fffaf0'],
    snake: ['#46d638', '#d6f46e'],
    acorn: ['#e2aa5a', '#5c3418']
};

// Small burst rising from the bottom centre, where the pickup went under the bike.
function drawCollectBurst(ctx, state, view, t) {
    const cols = BURST[state.pickupType] || BURST.berry;
    const unit = Math.min(view.w, view.h);
    const u = t / COLLECT_TIME;
    const ox = view.w / 2;
    const oy = view.h - unit * 0.26;
    const e = 1 - (1 - u) * (1 - u);
    ctx.globalAlpha = Math.max(0, 1 - u * u);
    for (let i = 0; i < 9; i++) {
        const side = (i / 8) * 2 - 1;
        const px = ox + side * unit * 0.2 * e;
        const py = oy - unit * (0.1 + 0.22 * ((i * 0.37) % 1)) * e + unit * 0.06 * u * u;
        const r = unit * (0.024 + 0.014 * (i % 3)) * (1 - 0.4 * u);
        ctx.fillStyle = i % 3 === 2 ? cols[1] : cols[0];
        ctx.strokeStyle = 'rgba(30,18,10,0.7)';
        ctx.lineWidth = Math.max(1, unit * 0.004);
        ctx.beginPath();
        if (i % 2) {
            ctx.arc(px, py, r, 0, 6.2832);
        } else {
            ctx.moveTo(px, py - r * 1.3);
            ctx.lineTo(px + r, py);
            ctx.lineTo(px, py + r * 1.3);
            ctx.lineTo(px - r, py);
            ctx.closePath();
        }
        ctx.fill();
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
}

// Screen position of the fox, with the scene roll applied. Off screen it is
// clamped to the edge on the fox's side.
function foxScreen(state, view) {
    const fox = state.fox;
    const w = view.w;
    const hy = view.horizonY;
    let x = w / 2;
    let y = hy + view.h * 0.05;
    let sc = 10;
    if (fox && fox.z > 0.01) {
        const scale = view.focal / fox.z;
        x = w / 2 + (fox.x - state.player.x) * scale;
        const camH = CONFIG.cameraHeight + (state.player.y || 0);
        sc = foxPixels(scale, view);
        y = hy + camH * scale - sc * 0.8;
        const roll = state.reduceMotion ? 0 : -state.player.steer * CONFIG.maxLean;
        const dx = x - w / 2;
        const dy = y - hy;
        x = w / 2 + dx * Math.cos(roll) - dy * Math.sin(roll);
        y = hy + dx * Math.sin(roll) + dy * Math.cos(roll);
        if (x < 0) x = 0;
        else if (x > w) x = w;
        y = Math.max(0, Math.min(view.h, y));
    } else if (fox) {
        x = fox.x < state.player.x ? 0 : w;
    }
    return { x: x, y: y, sc: sc };
}

// Green snake spinning from the bottom centre to the fox, shrinking as it goes.
function drawSnakeFlight(ctx, state, view, u) {
    const unit = Math.min(view.w, view.h);
    const target = foxScreen(state, view);
    const x0 = view.w / 2;
    const y0 = view.h - unit * 0.26;
    const e = u * u * (3 - 2 * u);
    const x = x0 + (target.x - x0) * e;
    const y = y0 + (target.y - y0) * e - Math.sin(u * Math.PI) * unit * 0.14;
    const sc = unit * 0.42 + (target.sc * 0.9 - unit * 0.42) * Math.pow(u, 0.6);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(u * Math.PI * 6);
    drawPickup(ctx, 'snake', 0, sc * 0.3, sc / 1.3, 0, animTime(), 0, true);
    ctx.restore();
}

// Acorn burst at the screen centre: a ring and shell fragments flying out.
function drawRespawnBurst(ctx, view, t) {
    const unit = Math.min(view.w, view.h);
    const u = t / RESPAWN_TIME;
    const cx = view.w / 2;
    const cy = view.h * 0.5;
    const e = 1 - (1 - u) * (1 - u);
    ctx.globalAlpha = Math.max(0, 1 - u * u);
    ctx.fillStyle = 'rgba(226,170,90,0.35)';
    ctx.beginPath();
    ctx.arc(cx, cy, unit * 0.2 * e, 0, 6.2832);
    ctx.fill();
    ctx.strokeStyle = '#e2aa5a';
    ctx.lineWidth = Math.max(3, unit * 0.025 * (1 - u));
    ctx.beginPath();
    ctx.arc(cx, cy, unit * (0.06 + 0.3 * e), 0, 6.2832);
    ctx.stroke();
    const n = 8;
    for (let i = 0; i < n; i++) {
        const a = (i / n) * 6.2832 + 0.3;
        const dist = unit * (0.12 + 0.3 * ((i * 0.43) % 1)) * e + unit * 0.2 * e;
        const px = cx + Math.cos(a) * dist;
        const py = cy + Math.sin(a) * dist + unit * 0.25 * u * u;
        const r = unit * (0.03 + 0.012 * (i % 3));
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(i * 1.1 + t * (i % 2 ? 9 : -9));
        // Shell fragment: a dark cap half and a tan wedge.
        ctx.fillStyle = i % 2 ? '#5c3418' : '#e2aa5a';
        ctx.beginPath();
        if (i % 2) {
            ctx.arc(0, 0, r, Math.PI, 6.2832);
        } else {
            ctx.moveTo(-r, r * 0.6);
            ctx.lineTo(0, -r);
            ctx.lineTo(r, r * 0.6);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(40,24,10,0.8)';
        ctx.lineWidth = Math.max(1, unit * 0.004);
        ctx.stroke();
        ctx.restore();
    }
    ctx.globalAlpha = 1;
}

// Fox size in pixels per metre: foxSize scaling with a pixel floor, capped so
// the fox is never taller than FOX_MAX_SCREEN of the view.
function foxPixels(scale, view) {
    const sc = Math.max(scale * CONFIG.foxSize, 10);
    return Math.min(sc, view.h * FOX_MAX_SCREEN / FOX_HEIGHT);
}

// True while the fox is the catch target.
function catchable(state) {
    return (state.mode === 'riding' || state.mode === 'paused') && state.level === CONFIG.maxLevel;
}

// Fox fade with distance, 0 to 1.
function foxAlpha(fox) {
    const max = CONFIG.foxMaxDistance;
    return fox.z > max ? Math.max(0, 1 - (fox.z - max) / (max * 0.15)) : 1;
}

// Ground ring under the fox: a steady ring plus a ring that grows and fades.
function drawCueRing(ctx, sx, baseY, sc, t, calm) {
    const rx = Math.max(sc * 0.62, 9);
    const ry = rx * 0.3;
    const lw = Math.max(2, Math.min(5, sc * 0.035));
    const u = (t * 1.4) % 1;
    // Dark outline either side of the cyan, so the ring reads by lightness in any theme.
    ctx.lineWidth = lw + 4;
    ctx.strokeStyle = CUE_EDGE;
    ctx.beginPath();
    ctx.ellipse(sx, baseY, rx, ry, 0, 0, 6.2832);
    ctx.stroke();
    ctx.lineWidth = lw;
    ctx.strokeStyle = CUE;
    ctx.stroke();
    if (calm) return;
    const g = 1 + 0.7 * u;
    const a = ctx.globalAlpha;
    ctx.globalAlpha = a * (1 - u) * 0.9;
    ctx.lineWidth = lw + 3;
    ctx.strokeStyle = CUE_EDGE;
    ctx.beginPath();
    ctx.ellipse(sx, baseY, rx * g, ry * g, 0, 0, 6.2832);
    ctx.stroke();
    ctx.lineWidth = lw;
    ctx.strokeStyle = CUE;
    ctx.stroke();
    ctx.globalAlpha = a;
}

// Bobbing arrow above the fox, drawn over the trees so a trunk cannot hide it.
function drawCueArrow(ctx, fox, state, view) {
    const scale = view.focal / fox.z;
    const fx = view.w / 2 + (fox.x - state.player.x) * scale;
    if (Math.abs(fx - view.w / 2) > view.w * 0.8) return;
    const baseY = view.horizonY + drawTree.camH * scale;
    const sc = foxPixels(scale, view);
    const unit = Math.min(view.w, view.h);
    let size = Math.max(unit * 0.03, Math.min(unit * 0.06, sc * 0.2));
    // Needs room above the fox, clear of the HUD at the top. Close up there is
    // none, and the ground ring carries the cue alone.
    const room = baseY - sc * FOX_HEIGHT - 52;
    size = Math.min(size, room / 2.6);
    if (size < unit * 0.025) return;
    // Stays on screen when the fox is just off the edge.
    const sx = Math.max(size, Math.min(view.w - size, fx));
    const bob = state.reduceMotion ? 0 : Math.sin(animTime() * 6) * size * 0.35;
    const tip = baseY - sc * FOX_HEIGHT - size * 0.5 + bob;
    const a = foxAlpha(fox);
    if (a <= 0) return;
    ctx.globalAlpha = a;
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, size * 0.3);
    ctx.strokeStyle = CUE_EDGE;
    ctx.fillStyle = CUE;
    ctx.beginPath();
    ctx.moveTo(sx, tip);
    ctx.lineTo(sx + size * 0.9, tip - size * 1.1);
    ctx.lineTo(sx + size * 0.32, tip - size * 1.1);
    ctx.lineTo(sx + size * 0.32, tip - size * 2);
    ctx.lineTo(sx - size * 0.32, tip - size * 2);
    ctx.lineTo(sx - size * 0.32, tip - size * 1.1);
    ctx.lineTo(sx - size * 0.9, tip - size * 1.1);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.globalAlpha = 1;
}

function drawFoxAt(ctx, fox, state, view) {
    const scale = view.focal / fox.z;
    const sx = view.w / 2 + (fox.x - state.player.x) * scale;
    const baseY = view.horizonY + drawTree.camH * scale;
    // Oversized and with a minimum on-screen size (about 17 px tall) so it
    // stays spottable, and a cap on its height so it never blocks the trail.
    // Feet stay on the ground line.
    const sc = foxPixels(scale, view);
    if (Math.abs(sx - view.w / 2) > view.w * 0.8 + sc) return;
    const haze = 0;
    const alpha = foxAlpha(fox);
    if (alpha <= 0) return;
    if (alpha < 1) ctx.globalAlpha = alpha;
    if (catchable(state)) drawCueRing(ctx, sx, baseY, sc, animTime(), !!state.reduceMotion);
    drawFox(ctx, sx, baseY, sc, fox.lean || 0, animTime(), haze, foxPose);
    if (alpha < 1) ctx.globalAlpha = 1;
}

// Cheap speed lines from the edges towards the horizon while boosting.
function drawBoostLines(ctx, state, view) {
    const w = view.w;
    const hy = view.horizonY;
    const k = Math.min(1, state.player.boost / 0.5);
    ctx.strokeStyle = 'rgba(255,255,235,' + (0.28 * k).toFixed(3) + ')';
    ctx.lineWidth = Math.max(1, Math.min(w, view.h) * 0.004);
    ctx.beginPath();
    for (let i = 0; i < 14; i++) {
        const ph = ((state.distance * 0.06 + i * 0.137) % 1);
        const side = i % 2 ? 1 : -1;
        const ang = (0.3 + ((i * 0.61) % 1) * 0.55) * side;
        const r0 = 0.25 + ph * 0.9;
        const r1 = r0 + 0.12 + ph * 0.2;
        const ox = w / 2;
        const oy = hy + 4;
        const dx = Math.sin(ang);
        const dy = Math.cos(ang) * 0.9;
        const reach = Math.max(w, view.h);
        ctx.moveTo(ox + dx * reach * r0, oy + dy * reach * r0);
        ctx.lineTo(ox + dx * reach * r1, oy + dy * reach * r1);
    }
    ctx.stroke();
}
