// High scores in localStorage. Never throws; the game works without storage.
import { CONFIG } from './config.js';

export function loadHighScores() {
    const out = {};
    try {
        const raw = globalThis.localStorage.getItem(CONFIG.storageKey);
        if (!raw) return out;
        const data = JSON.parse(raw);
        if (data === null || typeof data !== 'object' || Array.isArray(data)) return out;
        for (const key of Object.keys(CONFIG.difficulties)) {
            const v = data[key];
            if (typeof v === 'number' && Number.isFinite(v) && v >= 0) out[key] = v;
        }
    } catch (e) {
        return {};
    }
    return out;
}

export function loadSettings() {
    const out = { ...CONFIG.defaultSettings };
    try {
        const raw = globalThis.localStorage.getItem(CONFIG.settingsKey);
        if (!raw) return out;
        const data = JSON.parse(raw);
        if (data === null || typeof data !== 'object' || Array.isArray(data)) return out;
        if (typeof data.music === 'boolean') out.music = data.music;
        if (typeof data.effects === 'boolean') out.effects = data.effects;
        if (typeof data.easyRide === 'boolean') out.easyRide = data.easyRide;
        if (typeof data.reduceMotion === 'boolean') out.reduceMotion = data.reduceMotion;
        if (typeof data.volume === 'string' &&
            Object.prototype.hasOwnProperty.call(CONFIG.volumeLevels, data.volume)) {
            out.volume = data.volume;
        }
    } catch (e) {
        return { ...CONFIG.defaultSettings };
    }
    return out;
}

export function saveSettings(settings) {
    try {
        const s = settings || {};
        const data = {
            music: !!s.music,
            effects: !!s.effects,
            volume: s.volume,
            easyRide: !!s.easyRide
        };
        if (typeof s.reduceMotion === 'boolean') data.reduceMotion = s.reduceMotion;
        globalThis.localStorage.setItem(CONFIG.settingsKey, JSON.stringify(data));
    } catch (e) {
        // Storage blocked or full: ignore.
    }
}

export function saveHighScores(bests) {
    try {
        const data = {};
        for (const key of Object.keys(CONFIG.difficulties)) {
            const v = bests && bests[key];
            if (typeof v === 'number' && Number.isFinite(v) && v >= 0) data[key] = v;
        }
        globalThis.localStorage.setItem(CONFIG.storageKey, JSON.stringify(data));
    } catch (e) {
        // Storage blocked or full: ignore.
    }
}

// Lifetime stats. Same rules: never throws, the game works without storage.
const STAT_TOTALS = ['runs', 'distance', 'longestRun', 'highestLevel', 'jumps', 'bestCombo',
    'berries', 'nearMisses', 'foxesCaught', 'acornSaves', 'logsSmashed', 'bounces'];
const STAT_ENDINGS = ['tree', 'log', 'bear', 'lost'];
const STAT_DIFFICULTIES = ['beginner', 'normal', 'expert'];

function zeroMap(keys) {
    const out = {};
    for (const k of keys) out[k] = 0;
    return out;
}

function defaultStats() {
    const out = zeroMap(STAT_TOTALS);
    out.endings = zeroMap(STAT_ENDINGS);
    out.runsByDifficulty = zeroMap(STAT_DIFFICULTIES);
    return out;
}

function validCount(v) {
    return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

function isPlainObject(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function readKnown(target, source, keys) {
    if (!isPlainObject(source)) return;
    for (const k of keys) {
        if (Object.prototype.hasOwnProperty.call(source, k) && validCount(source[k])) target[k] = source[k];
    }
}

export function loadStats() {
    const out = defaultStats();
    try {
        const raw = globalThis.localStorage.getItem(CONFIG.statsKey);
        if (!raw) return out;
        const data = JSON.parse(raw);
        if (!isPlainObject(data)) return out;
        readKnown(out, data, STAT_TOTALS);
        readKnown(out.endings, data.endings, STAT_ENDINGS);
        readKnown(out.runsByDifficulty, data.runsByDifficulty, STAT_DIFFICULTIES);
    } catch (e) {
        return defaultStats();
    }
    return out;
}

export function saveStats(stats) {
    try {
        const s = isPlainObject(stats) ? stats : {};
        const data = defaultStats();
        readKnown(data, s, STAT_TOTALS);
        readKnown(data.endings, s.endings, STAT_ENDINGS);
        readKnown(data.runsByDifficulty, s.runsByDifficulty, STAT_DIFFICULTIES);
        globalThis.localStorage.setItem(CONFIG.statsKey, JSON.stringify(data));
    } catch (e) {
        // Storage blocked or full: ignore.
    }
}

// Pure. Returns a new stats object with one finished run added.
export function addRunToStats(stats, run) {
    const base = defaultStats();
    readKnown(base, stats, STAT_TOTALS);
    readKnown(base.endings, isPlainObject(stats) ? stats.endings : null, STAT_ENDINGS);
    readKnown(base.runsByDifficulty, isPlainObject(stats) ? stats.runsByDifficulty : null, STAT_DIFFICULTIES);
    const r = isPlainObject(run) ? run : {};
    const n = (k) => (validCount(r[k]) ? r[k] : 0);
    const out = base;
    out.runs += 1;
    const metres = Math.floor(n('distance'));
    out.distance += metres;
    out.longestRun = Math.max(out.longestRun, metres);
    out.highestLevel = Math.max(out.highestLevel, n('level'));
    out.jumps += n('jumps');
    out.bestCombo = Math.max(out.bestCombo, n('bestCombo'));
    out.berries += n('berries');
    out.nearMisses += n('nearMisses');
    out.foxesCaught += n('catches');
    out.acornSaves += n('respawns');
    out.logsSmashed += n('logsSmashed');
    out.bounces += n('bounces');
    if (STAT_ENDINGS.includes(r.ending)) out.endings[r.ending] += 1;
    if (STAT_DIFFICULTIES.includes(r.difficulty)) out.runsByDifficulty[r.difficulty] += 1;
    return out;
}
