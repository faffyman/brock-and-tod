// Brock & Tod sound. Everything is synthesised with the Web Audio API:
// no audio files, no network, no <audio> elements.
//
// Public interface (see tasks/todo.md, "Pass 4: sound"):
//   createAudio() -> { unlock(), setSettings(settings), update(state) }
//
// Graph: music/effects voices -> music bus / effects bus -> master gain
//        -> compressor -> destination.

import { CONFIG } from './config.js';

// ---- Tuning ---------------------------------------------------------------

const LOOKAHEAD = 0.2;        // seconds of music scheduled ahead of currentTime
const BASE_BPM = 108;
const SEMIS = [0, 2, 4, 7, 9];            // major pentatonic
const C4 = 261.63;
const BAR_STEPS = 8;                      // eighth notes per 4/4 bar
const LOOP_BARS = 16;
const LOOP_STEPS = BAR_STEPS * LOOP_BARS;

// Peak gains on the effects bus. The crash is the loudest, the rest sit within about 2x.
const LV = {
    pant: 0.06,
    jump: 0.15,
    land: 0.19,
    boost: 0.22,
    chime: 0.14,
    tick: 0.11,
    crash: 0.5,
    lost: 0.17,
    start: 0.09,
    bounce: 0.16,
    warn: 0.07,
    yip: 0.1,
    berry: 0.05,      // quietest effect in the game
    mushroom: 0.14,
    snake: 0.13,
    acorn: 0.105,
    respawn: 0.26,    // louder than the bounce, well under the crash
    yelp: 0.09,
    top: 0.17,        // top-level cue, a little above the level-up chime
    catch: 0.17,      // catch fanfare (many layered voices): measured peak about 2x the chime, well under the crash
    creak: 0.33,      // falling tree warning: band-passed saw, measured about the chime peak (scaled down a little with distance)
    thud: 0.22,       // tree hits the ground, a warning too
    growl: 0.14,      // bear growl, level with the chime
    roar: 0.2,        // bear roar after a bear crash
    bird: 0.25,       // flaps and squawk are quiet bursts: measured peak a little under the chime
    smash: 0.14       // measured peak about the landing
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;
const num = (v, d) => (typeof v === 'number' && !isNaN(v) ? v : d);

// Small seeded random generator so the base motif is the same every run.
function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Scale index 0..9 (C4 to A5) to Hz.
function scaleFreq(idx) {
    const oct = Math.floor(idx / 5);
    return C4 * Math.pow(2, (12 * oct + SEMIS[idx % 5]) / 12);
}

// A phrase is an array of steps, each a scale index or -1 for a rest.
function makePhrase(rand, steps, startPos) {
    const out = [];
    let pos = startPos;
    const moves = [-2, -1, -1, 0, 1, 1, 2];
    for (let s = 0; s < steps; s++) {
        const p = s % 4 === 0 ? 0.85 : s % 2 === 0 ? 0.55 : 0.22;
        if (rand() < p) {
            pos = clamp(pos + moves[Math.floor(rand() * moves.length)], 1, 9);
            out.push(pos);
        } else {
            out.push(-1);
        }
    }
    return out;
}

// Build the 16 bar loop: A, A with a new ending, B, A with another ending.
// Called again on every wrap so the loop point is hard to spot.
const MOTIF = makePhrase(mulberry32(7), 32, 4);
function buildLoop(loopCount) {
    const rand = mulberry32(1000 + loopCount * 31);
    const withNewEnd = () => MOTIF.slice(0, 16).concat(makePhrase(rand, 16, 5));
    const b = makePhrase(rand, 32, 6);
    return [].concat(MOTIF, withNewEnd(), b, withNewEnd());
}

// Bass roots in semitones from C3, one per bar, four bar progressions.
const PROG_A = [0, -3, 5, 7];
const PROG_B = [5, 7, -3, 0];
function bassSemis(bar) {
    const prog = bar >= 8 && bar < 12 ? PROG_B : PROG_A;
    return prog[bar % 4];
}

// ---- Module ---------------------------------------------------------------

export function createAudio() {
    const Ctor = (typeof globalThis !== 'undefined')
        ? (globalThis.AudioContext || globalThis.webkitAudioContext)
        : undefined;

    let settings = Object.assign({}, CONFIG.defaultSettings);
    let ctx = null;
    let failed = false;
    let master = null;
    let fxBus = null;
    let musicBus = null;
    let musicFilter = null;
    let noiseBuf = null;
    let visHooked = false;

    // Gain targets last applied, so we only ramp on change.
    let appliedMaster = -1;
    let appliedMusic = -1;
    let appliedFx = -1;

    // Previous-frame values for event detection.
    let prevValid = false;
    let prev = {
        mode: 'ready', y: 0, landTime: 0, chargeTime: 0, level: 1,
        bounceTime: -Infinity, shield: 0, phase: 'cruise',
        pickupTime: -Infinity, mushroom: 0, straight: 0, respawnTime: -Infinity,
        catchTime: -Infinity, smashTime: -Infinity, birdTime: -Infinity
    };
    // Per-hazard progress memory. Hazards have no ids and the array shifts, so key by object.
    let hazMem = new WeakMap();
    let berryAt = -Infinity;   // currentTime of the last berry plip
    let berryStep = 0;         // how many berries in the current quick run

    // Music scheduler.
    let musicRunning = false;
    let musicNext = 0;
    let musicStep = 0;
    let loopCount = 0;
    let loop = null;

    // Looping effects.
    let pantNext = 0;
    let pantFlip = false;
    let pantGain = null;
    let tickNext = 0;
    let wasFoxHidden = false;

    // ---- Helpers -----------------------------------------------------

    function safeDisconnect(nodes) {
        for (let i = 0; i < nodes.length; i++) {
            try { nodes[i].disconnect(); } catch (e) { /* already gone */ }
        }
    }

    // One oscillator voice. Cleans itself up when it ends. Returns its gain node.
    function tone(t, type, f0, f1, dur, peak, dest, attack) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(f0, t);
        if (f1 && f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
        const a = attack || 0.006;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(peak, t + a);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(g);
        g.connect(dest);
        osc.onended = () => safeDisconnect([osc, g]);
        osc.start(t);
        osc.stop(t + dur + 0.02);
        return g;
    }

    // One filtered noise voice using the shared buffer. Returns its gain node.
    function noise(t, dur, filterType, f0, f1, q, peak, attack, dest) {
        const src = ctx.createBufferSource();
        const f = ctx.createBiquadFilter();
        const g = ctx.createGain();
        src.buffer = noiseBuf;
        f.type = filterType;
        f.Q.value = q;
        f.frequency.setValueAtTime(f0, t);
        if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
        const a = Math.min(attack, dur * 0.8);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(peak, t + a);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f);
        f.connect(g);
        g.connect(dest);
        src.onended = () => safeDisconnect([src, f, g]);
        const maxOffset = Math.max(0, noiseBuf.duration - dur - 0.05);
        src.start(t, Math.random() * maxOffset, dur + 0.02);
        return g;
    }

    // One oscillator voice through a filter with a slow amplitude wobble (creaks, growls, squawks).
    // The envelope rises over `attack` then falls to silence at `dur`.
    function wobbleVoice(t, type, f0, f1, dur, peak, dest, attack, filtType, ff0, ff1, fq, lfoHz, depth) {
        const osc = ctx.createOscillator();
        const f = ctx.createBiquadFilter();
        const g = ctx.createGain();
        const w = ctx.createGain();
        const lfo = ctx.createOscillator();
        const lg = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(f0, t);
        if (f1 && f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
        f.type = filtType;
        f.Q.value = fq;
        f.frequency.setValueAtTime(ff0, t);
        if (ff1 && ff1 !== ff0) f.frequency.exponentialRampToValueAtTime(ff1, t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(peak, t + Math.min(attack, dur * 0.9));
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        w.gain.value = 1 - depth;
        lfo.type = 'sine';
        lfo.frequency.value = lfoHz;
        lg.gain.value = depth;
        lfo.connect(lg);
        lg.connect(w.gain);
        osc.connect(f);
        f.connect(g);
        g.connect(w);
        w.connect(dest);
        osc.onended = () => safeDisconnect([osc, f, g, w, lfo, lg]);
        osc.start(t);
        osc.stop(t + dur + 0.02);
        lfo.start(t);
        lfo.stop(t + dur + 0.02);
    }

    function buildNoise() {
        const len = Math.floor(ctx.sampleRate * 2);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        return buf;
    }

    // ---- Setup -------------------------------------------------------

    function build() {
        ctx = new Ctor();
        master = ctx.createGain();
        master.gain.value = 0;
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -10;
        comp.knee.value = 12;
        comp.ratio.value = 4;
        comp.attack.value = 0.004;
        comp.release.value = 0.2;
        fxBus = ctx.createGain();
        fxBus.gain.value = 0;
        musicBus = ctx.createGain();
        musicBus.gain.value = 0;
        musicFilter = ctx.createBiquadFilter();
        musicFilter.type = 'lowpass';
        musicFilter.frequency.value = 2800;
        musicFilter.Q.value = 0.5;
        musicFilter.connect(musicBus);
        fxBus.connect(master);
        musicBus.connect(master);
        master.connect(comp);
        comp.connect(ctx.destination);
        noiseBuf = buildNoise();
    }

    function hookVisibility() {
        if (visHooked || typeof document === 'undefined' || !document.addEventListener) return;
        visHooked = true;
        document.addEventListener('visibilitychange', () => {
            try {
                if (!ctx) return;
                if (document.hidden) {
                    prevValid = false;
                    musicRunning = false;
                    stopLoops();
                    const p = ctx.suspend();
                    if (p && p.catch) p.catch(() => {});
                } else {
                    const p = ctx.resume();
                    if (p && p.catch) p.catch(() => {});
                }
            } catch (e) { /* ignore */ }
        });
    }

    function applyGains(state) {
        const now = ctx.currentTime;
        const vol = CONFIG.volumeLevels[settings.volume];
        const m = typeof vol === 'number' ? vol : 1;
        const riding = !state || state.mode === 'riding';
        const mus = settings.music ? CONFIG.musicLevel * (riding ? 1 : CONFIG.musicMenuDuck) : 0;
        const fx = settings.effects ? 1 : 0;
        if (m !== appliedMaster) { master.gain.setTargetAtTime(m, now, 0.04); appliedMaster = m; }
        if (mus !== appliedMusic) { musicBus.gain.setTargetAtTime(mus, now, 0.15); appliedMusic = mus; }
        if (fx !== appliedFx) { fxBus.gain.setTargetAtTime(fx, now, 0.03); appliedFx = fx; }
    }

    // ---- Music -------------------------------------------------------

    function stepDuration(level) {
        let bpm = BASE_BPM + clamp((level || 1) - 1, 0, 9) * 1;
        // At the top level the fox can be caught: a little extra push.
        if (level === CONFIG.maxLevel) bpm += 6;
        return 60 / bpm / 2;
    }

    function scheduleMusicStep(t, step, sd) {
        const bar = Math.floor(step / BAR_STEPS);
        const inBar = step % BAR_STEPS;
        const n = loop[step];
        if (n >= 0) {
            tone(t, 'triangle', scaleFreq(n), 0, 0.42, 0.2, musicFilter, 0.005);
            // A faint octave sine gives a mallet-like glint.
            if (inBar % 2 === 0) tone(t, 'sine', scaleFreq(n) * 2, 0, 0.18, 0.04, musicFilter, 0.004);
        }
        if (inBar === 0 || inBar === 4) {
            const f = 130.81 * Math.pow(2, bassSemis(bar) / 12);
            tone(t, 'triangle', f, 0, sd * 3.2, 0.26, musicFilter, 0.01);
        }
    }

    function runMusic(state) {
        const want = settings.music;
        if (!want) { musicRunning = false; return; }
        const now = ctx.currentTime;
        if (!musicRunning) {
            musicRunning = true;
            musicNext = now + 0.08;
            musicStep = 0;
            loopCount = 0;
            loop = buildLoop(0);
        }
        // Fallen behind (tab was hidden, long frame): jump forward, no catch-up burst.
        if (musicNext < now - 0.05) musicNext = now + 0.05;
        const sd = stepDuration(state.level);
        let guard = 0;
        while (musicNext < now + LOOKAHEAD && guard++ < 8) {
            scheduleMusicStep(musicNext, musicStep, sd);
            musicNext += sd;
            musicStep++;
            if (musicStep >= LOOP_STEPS) {
                musicStep = 0;
                loopCount++;
                loop = buildLoop(loopCount);
            }
        }
    }

    // ---- Effects -----------------------------------------------------

    function puff(now, intensity) {
        // Exhale and inhale alternate: slightly different colour, inhale softer.
        pantFlip = !pantFlip;
        const f0 = pantFlip ? 1250 : 1750;
        const f1 = pantFlip ? 900 : 2100;
        const peak = LV.pant * (pantFlip ? 1 : 0.7) * (0.8 + 0.2 * intensity);
        const dur = 0.11 - 0.03 * intensity;
        pantGain = noise(now, dur, 'bandpass', f0, f1, 0.9, peak, 0.035, fxBus);
    }

    function stopPant() {
        pantNext = 0;
        if (pantGain && ctx) {
            try {
                const t = ctx.currentTime;
                pantGain.gain.cancelScheduledValues(t);
                pantGain.gain.setTargetAtTime(0, t, 0.01);
            } catch (e) { /* ignore */ }
        }
        pantGain = null;
    }

    function stopLoops() {
        stopPant();
        tickNext = 0;
        wasFoxHidden = false;
    }

    function jumpWhoosh(t) {
        noise(t, 0.4, 'bandpass', 400, 2200, 1.1, LV.jump, 0.12, fxBus);
    }

    function landing(t) {
        tone(t, 'sine', 190, 60, 0.16, LV.land, fxBus, 0.004);
        noise(t, 0.07, 'bandpass', 2400, 1800, 0.7, LV.land * 0.3, 0.005, fxBus);
    }

    function boostWhoosh(t) {
        noise(t, 0.8, 'bandpass', 300, 3000, 1.0, LV.boost, 0.25, fxBus);
        tone(t, 'triangle', 170, 520, 0.8, LV.boost * 0.5, fxBus, 0.2);
    }

    function levelChime(t) {
        const notes = [523.25, 659.25, 783.99];
        for (let i = 0; i < notes.length; i++) {
            const s = t + i * 0.09;
            tone(s, 'sine', notes[i], 0, 0.28, LV.chime, fxBus, 0.006);
            tone(s, 'triangle', notes[i] * 2, 0, 0.14, LV.chime * 0.25, fxBus, 0.004);
        }
    }

    function topLevelCue(t) {
        // The level-up figure, quicker, then a held top note with a fast repeated pulse under it.
        // Signals that the fox can now be caught.
        const notes = [523.25, 659.25, 783.99, 1046.5];
        for (let i = 0; i < notes.length; i++) {
            const s = t + i * 0.065;
            tone(s, 'sine', notes[i], 0, 0.26, LV.top, fxBus, 0.005);
            tone(s, 'triangle', notes[i] * 2, 0, 0.12, LV.top * 0.25, fxBus, 0.004);
        }
        const hold = t + 0.26;
        tone(hold, 'sine', 1046.5, 0, 0.55, LV.top * 0.8, fxBus, 0.01);
        tone(hold, 'triangle', 2093, 0, 0.3, LV.top * 0.2, fxBus, 0.006);
        for (let i = 0; i < 3; i++) {
            tone(hold + 0.07 + i * 0.07, 'sine', 1318.5, 0, 0.08, LV.top * 0.5, fxBus, 0.004);
        }
    }

    function catchFanfare(t) {
        // Bright rising arpeggio, then a held C major chord, with a soft noise sparkle on top.
        const arp = [523.25, 659.25, 783.99, 1046.5];
        for (let i = 0; i < arp.length; i++) {
            const s = t + i * 0.075;
            tone(s, 'triangle', arp[i], 0, 0.22, LV.catch * 0.7, fxBus, 0.005);
            tone(s, 'sine', arp[i] * 2, 0, 0.16, LV.catch * 0.3, fxBus, 0.004);
        }
        const hold = t + 0.3;
        const chord = [523.25, 659.25, 783.99, 1046.5];
        for (let i = 0; i < chord.length; i++) {
            tone(hold, 'triangle', chord[i], 0, 0.6, LV.catch * 0.4, fxBus, 0.01);
            tone(hold, 'sine', chord[i] * 2, 0, 0.45, LV.catch * 0.12, fxBus, 0.01);
        }
        tone(hold, 'sine', 261.63, 0, 0.6, LV.catch * 0.35, fxBus, 0.012);
        noise(t + 0.2, 0.7, 'highpass', 6500, 9000, 0.7, LV.catch * 0.2, 0.08, fxBus);
    }

    function foxTick(t, urgency) {
        tone(t, 'triangle', lerp(760, 1250, urgency), 0, 0.05, LV.tick * lerp(0.8, 1, urgency), fxBus, 0.004);
    }

    function crash(t) {
        // Low body with a quick downward drop, a woody knock on top and a noise burst.
        tone(t, 'sine', 260, 62, 0.5, LV.crash, fxBus, 0.004);
        tone(t, 'triangle', 150, 70, 0.3, LV.crash * 0.4, fxBus, 0.004);
        tone(t, 'sine', 430, 300, 0.09, LV.crash * 0.35, fxBus, 0.002);
        noise(t, 0.2, 'lowpass', 1400, 400, 0.7, LV.crash * 0.6, 0.004, fxBus);
    }

    function crashLog(t) {
        // Same crash, but hollow and lower: a deeper drop, a dull wooden thunk, a softer noise burst.
        tone(t, 'sine', 190, 46, 0.55, LV.crash, fxBus, 0.004);
        tone(t, 'triangle', 110, 55, 0.34, LV.crash * 0.4, fxBus, 0.004);
        tone(t, 'sine', 330, 170, 0.12, LV.crash * 0.35, fxBus, 0.002);
        noise(t, 0.2, 'lowpass', 800, 250, 0.7, LV.crash * 0.45, 0.004, fxBus);
    }

    function bearRoar(t) {
        // Short, rough, wobbling roar. Low-passed so phone speakers do not get a painful buzz.
        wobbleVoice(t, 'sawtooth', 150, 85, 0.6, LV.roar, fxBus, 0.08, 'lowpass', 900, 500, 1.2, 19, 0.45);
        wobbleVoice(t, 'square', 75, 50, 0.6, LV.roar * 0.5, fxBus, 0.08, 'lowpass', 400, 250, 0.7, 14, 0.4);
        noise(t, 0.55, 'bandpass', 700, 350, 1.0, LV.roar * 0.5, 0.06, fxBus);
    }

    function crashBear(t) {
        crash(t);
        bearRoar(t + 0.1);
    }

    function bearGrowl(t) {
        // About half a second, low, rattling. Cartoonish rather than scary.
        wobbleVoice(t, 'sawtooth', 120, 80, 0.5, LV.growl, fxBus, 0.12, 'lowpass', 800, 450, 1.0, 17, 0.5);
        wobbleVoice(t, 'sawtooth', 123, 82, 0.5, LV.growl * 0.5, fxBus, 0.12, 'lowpass', 700, 400, 1.0, 11, 0.4);
        noise(t, 0.45, 'bandpass', 600, 300, 1.2, LV.growl * 0.35, 0.1, fxBus);
    }

    // Tree warning loudness: full when close, a little less when far, never quiet.
    function distScale(h) {
        const far = Math.max(1, num(CONFIG.fallTriggerDistance, 75));
        return lerp(1, 0.65, clamp(Math.abs(num(h && h.z, 0)) / far, 0, 1));
    }

    function treeCreak(t, h) {
        // Wood groaning as the trunk starts to go: pitch and strength climb for about fallTime,
        // with irregular cracks that come faster, ending on one big crack.
        const dur = Math.max(0.6, num(CONFIG.fallTime, 1.6));
        const k = distScale(h);
        const pk = LV.creak * k;
        wobbleVoice(t, 'sawtooth', 140, 310, dur, pk, fxBus, dur * 0.85, 'bandpass', 500, 1500, 5, 11, 0.45);
        wobbleVoice(t, 'sawtooth', 330, 700, dur, pk * 0.5, fxBus, dur * 0.8, 'bandpass', 1300, 2200, 8, 17, 0.5);
        const cracks = [[0.28, 0.4], [0.5, 0.55], [0.68, 0.7], [0.8, 0.85]];
        for (let i = 0; i < cracks.length; i++) {
            noise(t + dur * cracks[i][0], 0.05, 'bandpass', 2200, 1400, 1.6, pk * cracks[i][1], 0.003, fxBus);
        }
        noise(t + dur * 0.88, 0.14, 'bandpass', 1500, 600, 1.2, pk * 1.1, 0.004, fxBus);
    }

    function treeThud(t, h) {
        // Heavy ground hit with a little leaf rustle after it.
        const k = distScale(h);
        const pk = LV.thud * k;
        tone(t, 'sine', 115, 38, 0.5, pk, fxBus, 0.004);
        tone(t, 'triangle', 70, 40, 0.25, pk * 0.4, fxBus, 0.004);
        noise(t, 0.22, 'lowpass', 700, 200, 0.7, pk * 0.6, 0.004, fxBus);
        noise(t + 0.03, 0.5, 'bandpass', 4200, 2600, 0.8, pk * 0.22, 0.05, fxBus);
        noise(t + 0.2, 0.3, 'bandpass', 3400, 2200, 0.8, pk * 0.12, 0.05, fxBus);
    }

    function birdFlutter(t) {
        // Five wing flaps speeding up, then one squawk. About CONFIG.birdBlockTime in all.
        const total = Math.max(0.3, num(CONFIG.birdBlockTime, 0.5));
        const gaps = [0, 0.2, 0.37, 0.52, 0.65];
        for (let i = 0; i < gaps.length; i++) {
            const s = t + total * gaps[i] * 0.8;
            noise(s, 0.06, 'bandpass', 700 + i * 120, 1500 + i * 150, 0.9, LV.bird * (0.55 + i * 0.07), 0.015, fxBus);
        }
        const sq = t + total * 0.35;
        const sd = total * 0.4;
        wobbleVoice(sq, 'sawtooth', 1300, 850, sd, LV.bird * 0.8, fxBus, 0.02, 'bandpass', 1500, 1100, 2.5, 34, 0.4);
        tone(sq, 'triangle', 2100, 1400, sd * 0.6, LV.bird * 0.15, fxBus, 0.01);
    }

    function smash(t) {
        // Crunchy wood splinter burst: a sharp crack, a spray of fast bright bits, a short low knock.
        noise(t, 0.3, 'highpass', 2200, 1200, 0.7, LV.smash * 0.7, 0.003, fxBus);
        const bits = [0, 0.035, 0.07, 0.115, 0.17];
        for (let i = 0; i < bits.length; i++) {
            noise(t + bits[i], 0.05, 'bandpass', 3800 - i * 450, 1800, 2.0, LV.smash * (0.9 - i * 0.12), 0.002, fxBus);
        }
        tone(t, 'triangle', 320, 120, 0.1, LV.smash * 0.6, fxBus, 0.002);
    }

    function bounce(t) {
        // Hollow wooden bonk with a springy upward flick. Light and friendly next to the crash.
        tone(t, 'sine', 250, 480, 0.22, LV.bounce, fxBus, 0.003);
        tone(t, 'triangle', 170, 220, 0.1, LV.bounce * 0.4, fxBus, 0.002);
        noise(t, 0.04, 'bandpass', 1100, 700, 1.2, LV.bounce * 0.3, 0.002, fxBus);
    }

    function shieldWarning(t) {
        // Three quick soft ticks, each lower than the last.
        const freqs = [1500, 1180, 930];
        for (let i = 0; i < freqs.length; i++) {
            tone(t + i * 0.1, 'sine', freqs[i], 0, 0.05, LV.warn, fxBus, 0.004);
        }
    }

    function foxLost(t) {
        // Four falling notes, each with a small downward slide.
        const notes = [494, 440, 392, 330];
        const gaps = [0, 0.2, 0.4, 0.62];
        for (let i = 0; i < notes.length; i++) {
            const s = t + gaps[i];
            const dur = i === notes.length - 1 ? 0.5 : 0.24;
            tone(s, 'triangle', notes[i], notes[i] * 0.94, dur, LV.lost, fxBus, 0.012);
        }
    }

    function foxYip(t) {
        // Two quick barks, each a soft triangle with a downward chirp and a faint octave glint.
        // Kept in the low-mid range so phone speakers do not make it shrill.
        const barks = [[0, 1180, 720, 0.12, 1], [0.17, 1320, 800, 0.16, 0.9]];
        for (let i = 0; i < barks.length; i++) {
            const b = barks[i];
            const s = t + b[0];
            tone(s, 'triangle', b[1], b[2], b[3], LV.yip * b[4], fxBus, 0.008);
            tone(s, 'sine', b[1] * 1.5, b[2] * 1.5, b[3] * 0.7, LV.yip * 0.2 * b[4], fxBus, 0.006);
            noise(s, 0.05, 'bandpass', 1800, 1200, 1.0, LV.yip * 0.15 * b[4], 0.004, fxBus);
        }
    }

    function berryPlip(t) {
        // Tiny soft plip. Berries arriving close together climb a little each time.
        berryStep = (t - berryAt < 0.6) ? Math.min(berryStep + 1, 5) : 0;
        berryAt = t;
        const f = 880 * Math.pow(2, (berryStep * 2) / 12);
        tone(t, 'sine', f, f * 1.25, 0.08, LV.berry, fxBus, 0.004);
    }

    function mushroomPickup(t) {
        // Bubbly rising run: a glide plus three quick bubbles climbing.
        tone(t, 'sine', 300, 900, 0.36, LV.mushroom, fxBus, 0.01);
        const bub = [420, 560, 760, 1010];
        for (let i = 0; i < bub.length; i++) {
            const s = t + i * 0.085;
            tone(s, 'sine', bub[i], bub[i] * 1.5, 0.07, LV.mushroom * 0.7, fxBus, 0.004);
        }
        tone(t + 0.2, 'triangle', 1200, 1800, 0.2, LV.mushroom * 0.25, fxBus, 0.02);
    }

    function mushroomFading(t) {
        // Two soft low blips.
        tone(t, 'sine', 300, 0, 0.09, LV.mushroom * 0.6, fxBus, 0.006);
        tone(t + 0.16, 'sine', 240, 0, 0.12, LV.mushroom * 0.6, fxBus, 0.006);
    }

    function snakeHiss(t) {
        // Band-passed noise hiss with a quick upward whip.
        noise(t, 0.4, 'bandpass', 3200, 5200, 2.5, LV.snake * 2.6, 0.05, fxBus);
        noise(t + 0.15, 0.2, 'bandpass', 900, 3800, 1.2, LV.snake * 2, 0.03, fxBus);
        tone(t + 0.15, 'triangle', 400, 1300, 0.18, LV.snake * 0.35, fxBus, 0.01);
    }

    function foxStartle(t) {
        // One short high yelp, a single upward-then-down chirp.
        tone(t, 'triangle', 1500, 2100, 0.05, LV.yelp, fxBus, 0.005);
        tone(t + 0.05, 'triangle', 2100, 1300, 0.07, LV.yelp, fxBus, 0.004);
        tone(t, 'sine', 3000, 3900, 0.09, LV.yelp * 0.15, fxBus, 0.005);
    }

    function acornChime(t) {
        // Warm two-note chime, richer than the level-up: fifth-stacked partials and a soft tail.
        const notes = [587.33, 880];
        for (let i = 0; i < notes.length; i++) {
            const s = t + i * 0.14;
            const f = notes[i];
            const dur = i === 0 ? 0.35 : 0.6;
            tone(s, 'sine', f, 0, dur, LV.acorn, fxBus, 0.006);
            tone(s, 'sine', f * 1.5, 0, dur * 0.7, LV.acorn * 0.35, fxBus, 0.006);
            tone(s, 'triangle', f * 2, 0, dur * 0.5, LV.acorn * 0.25, fxBus, 0.004);
            tone(s, 'sine', f * 0.5, 0, dur * 0.8, LV.acorn * 0.4, fxBus, 0.01);
        }
    }

    function respawn(t) {
        // Dry woody crack, then at once a bright rising sweep. No low thud, unlike the crash.
        noise(t, 0.06, 'bandpass', 2600, 1500, 1.4, LV.respawn * 0.7, 0.002, fxBus);
        tone(t, 'triangle', 900, 500, 0.05, LV.respawn * 0.6, fxBus, 0.002);
        tone(t + 0.05, 'sine', 400, 1800, 0.5, LV.respawn, fxBus, 0.02);
        tone(t + 0.05, 'triangle', 800, 3200, 0.5, LV.respawn * 0.25, fxBus, 0.03);
        tone(t + 0.3, 'sine', 1800, 0, 0.3, LV.respawn * 0.3, fxBus, 0.01);
    }

    function startBlip(t) {
        tone(t, 'sine', 660, 990, 0.09, LV.start, fxBus, 0.004);
    }

    // Remember each hazard's progress by object. Fires the one-shots only when `fire` is true;
    // otherwise it just records, so nothing replays later.
    function scanHazards(state, fire, now) {
        const list = state && state.hazards;
        if (!Array.isArray(list)) return;
        for (let i = 0; i < list.length; i++) {
            const h = list[i];
            if (!h || typeof h !== 'object') continue;
            let r = hazMem.get(h);
            if (!r) { r = { started: false, landed: false }; hazMem.set(h, r); }
            const pr = num(h.progress, 0);
            if (h.type === 'fall') {
                if (pr >= 1) {
                    if (!r.landed) {
                        r.landed = true;
                        r.started = true;
                        if (fire) treeThud(now, h);
                    }
                } else if (pr > 0 && !r.started) {
                    r.started = true;
                    if (fire) treeCreak(now, h);
                }
            } else if (h.type === 'bear') {
                if (pr > 0 && !r.started) {
                    r.started = true;
                    if (fire) bearGrowl(now);
                }
            }
        }
    }

    function runEffects(state) {
        const now = ctx.currentTime;
        const mode = state.mode;
        const p = state.player || {};
        const y = p.y || 0;
        const riding = mode === 'riding';
        const wantFx = settings.effects;

        if (!prevValid) {
            // First call after unlock (or after the tab came back): record only.
            prev = {
                mode: mode, y: y, landTime: state.landTime, chargeTime: state.chargeTime,
                level: state.level,
                bounceTime: num(state.bounceTime, -Infinity), shield: num(state.shield, 0),
                phase: (state.fox && state.fox.phase) || 'cruise',
                pickupTime: num(state.pickupTime, -Infinity), mushroom: num(state.mushroom, 0),
                straight: num(state.fox && state.fox.straight, 0), respawnTime: num(state.respawnTime, -Infinity),
                catchTime: num(state.catchTime, -Infinity),
                smashTime: num(state.smashTime, -Infinity), birdTime: num(state.birdTime, -Infinity)
            };
            scanHazards(state, false, now);
            prevValid = true;
            return;
        }

        const modeChanged = mode !== prev.mode;
        const bounceTime = num(state.bounceTime, -Infinity);
        const shield = num(state.shield, 0);
        const warnAt = num(CONFIG.shieldWarnTime, 1);
        const phase = (state.fox && state.fox.phase) || 'cruise';
        const pickupTime = num(state.pickupTime, -Infinity);
        const mushroom = num(state.mushroom, 0);
        const straight = num(state.fox && state.fox.straight, 0);
        const respawnTime = num(state.respawnTime, -Infinity);
        const catchTime = num(state.catchTime, -Infinity);
        const smashTime = num(state.smashTime, -Infinity);
        const birdTime = num(state.birdTime, -Infinity);

        // Always record hazard progress; fire only while riding with effects on (a resume frame counts).
        scanHazards(state, wantFx && riding && (!modeChanged || prev.mode === 'paused'), now);

        if (wantFx) {
            if (modeChanged) {
                if (mode === 'crashed') {
                    const cause = state.crashCause;
                    if (cause === 'log') crashLog(now);
                    else if (cause === 'bear') crashBear(now);
                    else crash(now);
                }
                else if (mode === 'lost') foxLost(now);
                else if (mode === 'riding' &&
                    (prev.mode === 'ready' || prev.mode === 'crashed' || prev.mode === 'lost')) startBlip(now);
                // riding <-> paused and paused -> ready are silent.
            }
            if (riding && !modeChanged) {
                if (phase !== prev.phase && phase === 'taunt') foxYip(now);
                if (prev.y <= 0 && y > 0) jumpWhoosh(now);
                if (state.landTime > prev.landTime) landing(now);
                if (state.chargeTime > prev.chargeTime) boostWhoosh(now);
                // A catch drops the level; a decrease fires nothing. Catch wins over any chime.
                const caught = catchTime > prev.catchTime && catchTime >= 0;
                if (caught) catchFanfare(now);
                else if (state.level > prev.level) {
                    if (state.level === CONFIG.maxLevel) topLevelCue(now);
                    else levelChime(now);
                }
                const respawned = respawnTime > prev.respawnTime && respawnTime >= 0;
                const smashed = smashTime > prev.smashTime && smashTime >= 0;
                if (respawned) respawn(now);
                else if (!smashed && bounceTime > prev.bounceTime && bounceTime >= 0) bounce(now);
                if (smashed) smash(now);
                if (birdTime > prev.birdTime && birdTime >= 0) birdFlutter(now);
                if (pickupTime > prev.pickupTime && pickupTime >= 0) {
                    const type = state.pickupType;
                    if (type === 'berry') berryPlip(now);
                    else if (type === 'mushroom') mushroomPickup(now);
                    else if (type === 'snake') snakeHiss(now);
                    else if (type === 'acorn') acornChime(now);
                }
                if (prev.mushroom >= 3 && mushroom < 3 && mushroom > 0) mushroomFading(now);
                if (prev.straight <= 0 && straight > 0) foxStartle(now);
                if (prev.shield >= warnAt && shield < warnAt) shieldWarning(now);
            }
        }

        // Looping effects: only while riding.
        if (!riding || !wantFx) {
            if (pantNext !== 0 || tickNext !== 0 || pantGain) stopLoops();
        } else {
            const speedFrac = clamp(((p.speed || 0) - CONFIG.startSpeed) /
                Math.max(1, CONFIG.maxSpeed - CONFIG.startSpeed), 0, 1);
            const boosted = (p.boost || 0) > 0;

            if (y === 0) {
                if (pantNext === 0 || pantNext < now - 0.3) pantNext = now;
                if (now >= pantNext) {
                    puff(now, speedFrac);
                    // About 3.3 puffs per second at a crawl, up to about 5.5 flat out.
                    let interval = lerp(0.30, 0.18, speedFrac);
                    if (boosted) interval *= 0.8;
                    pantNext = now + interval;
                }
            } else if (pantNext !== 0 || pantGain) {
                stopPant();
            }

            const fox = state.fox;
            if (fox && !fox.visible) {
                const urgency = clamp((fox.lostTime || 0) / Math.max(0.1, num(state.lostLimit, CONFIG.foxLostLimit)), 0, 1);
                if (!wasFoxHidden) { wasFoxHidden = true; tickNext = now + 0.25; }
                if (now >= tickNext) {
                    foxTick(now, urgency);
                    tickNext = now + lerp(1.0, 0.28, urgency);
                }
            } else {
                wasFoxHidden = false;
                tickNext = 0;
            }
        }

        prev.mode = mode;
        prev.y = y;
        prev.landTime = state.landTime;
        prev.chargeTime = state.chargeTime;
        prev.level = state.level;
        prev.bounceTime = bounceTime;
        prev.shield = shield;
        prev.phase = phase;
        prev.pickupTime = pickupTime;
        prev.mushroom = mushroom;
        prev.straight = straight;
        prev.respawnTime = respawnTime;
        prev.catchTime = catchTime;
        prev.smashTime = smashTime;
        prev.birdTime = birdTime;
    }

    // ---- Public ------------------------------------------------------

    function unlock() {
        try {
            if (failed) return;
            if (!ctx) {
                if (!Ctor) { failed = true; return; }
                build();
                prevValid = false;
                hookVisibility();
            }
            if (ctx.state !== 'running' && !(typeof document !== 'undefined' && document.hidden)) {
                const p = ctx.resume();
                if (p && p.catch) p.catch(() => {});
            }
        } catch (e) {
            failed = true;
        }
    }

    function setSettings(s) {
        try {
            if (s && typeof s === 'object') {
                settings = {
                    music: s.music !== undefined ? !!s.music : settings.music,
                    effects: s.effects !== undefined ? !!s.effects : settings.effects,
                    volume: s.volume !== undefined ? s.volume : settings.volume
                };
            }
            if (ctx && !failed) {
                applyGains(null);
                appliedMusic = -1;   // re-evaluate the menu duck on the next update
            }
        } catch (e) { /* ignore */ }
    }

    function update(state) {
        try {
            if (!ctx || failed || !state) return;
            if (ctx.state !== 'running') {
                // Suspended, interrupted or not yet resumed: record nothing, schedule nothing.
                prevValid = false;
                musicRunning = false;
                if (pantGain || tickNext) stopLoops();
                return;
            }
            applyGains(state);
            runMusic(state);
            runEffects(state);
        } catch (e) { /* never throw into the game loop */ }
    }

    return { unlock, setSettings, update };
}
