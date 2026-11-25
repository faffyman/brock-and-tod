import { CONFIG } from './config.js';
import { createWorld, resetWorld, setReady, updateWorld, pauseWorld, resumeWorld } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { loadHighScores, saveHighScores, loadSettings, saveSettings, loadStats, saveStats, addRunToStats } from './storage.js';
import { registerServiceWorker, onInstallAvailable, promptInstall, isInstallAvailable, isStandalone, isIos } from './pwa.js';
import { drawScene } from './render/scene.js';
import { drawCockpit } from './render/cockpit.js';
import { drawIndicator } from './render/indicator.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const ctx = canvas.getContext('2d');
const hudEl = $('hud');
const hudScore = $('hud-score');
const hudDistance = $('hud-distance');
const hudLevel = $('hud-level');
const hudLevelText = $('hud-level-text');
const livePolite = $('live-polite');
const liveAlert = $('live-alert');
const accessBtn = $('access-btn');
const accessBackdrop = $('access-backdrop');
const accessClose = $('access-close');
const helpEasy = $('help-easy');
const hudCharges = $('hud-charges');
const hudDots = $('hud-dots');
const hudHint = $('hud-hint');
const hudCombo = $('hud-combo');
const pauseBtn = $('pause-btn');
const breakdownEl = $('message-breakdown');
const bdDist = $('bd-dist');
const bdDistPts = $('bd-dist-pts');
const bdJumps = $('bd-jumps');
const bdJumpPts = $('bd-jump-pts');
const bdBerries = $('bd-berries');
const bdBerryPts = $('bd-berry-pts');
const bdSaves = $('bd-saves');
const hudMushroom = $('hud-mushroom');
const hudMushroomS = $('hud-mushroom-s');
const hudAcorn = $('hud-acorn');
const bdNear = $('bd-near');
const bdNearPts = $('bd-near-pts');
const bdCatch = $('bd-catch');
const bdCatchPts = $('bd-catch-pts');
const bdTotal = $('bd-total');
const flashEl = $('flash');
const easyTagEl = document.createElement('span');
easyTagEl.className = 'tag';
easyTagEl.textContent = 'Easy ride';
const messageEl = $('message');
const panelEl = $('message-panel');
const logoEl = $('message-logo');
const kickerEl = $('message-kicker');
const titleEl = $('message-title');
const badgeEl = $('message-badge');
const line1El = $('message-line1');
const line2El = $('message-line2');
const line3El = $('message-line3');
const actionsEl = $('message-actions');
const menuBtn = $('menu-btn');
const infoBtn = $('info-btn');
const infoBackdrop = $('info-backdrop');
const infoClose = $('info-close');
const infoList = $('info-list');
const soundBtn = $('sound-btn');
const soundBackdrop = $('sound-backdrop');
const soundClose = $('sound-close');
const statsBtn = $('stats-btn');
const statsBackdrop = $('stats-backdrop');
const statsClose = $('stats-close');
const statsBody = $('stats-body');
const statsResetBtn = $('stats-reset');
const segButtons = Array.from(document.querySelectorAll('.seg__btn'));
const installBtn = $('install-btn');
const iosHint = $('ios-hint');
const iosHintClose = $('ios-hint-close');
const diffButtons = Array.from(document.querySelectorAll('.diff-btn'));

const state = createWorld();
const input = createInput(canvas);
let view = { w: 0, h: 0, horizonY: 0, focal: 0 };
let infoOpen = false; // true while any dialog (how to play, sound, accessibility or stats) is open

const audio = createAudio();
const settings = loadSettings();

// Reduce motion follows the system setting until the player picks a value in the menu.
const motionQuery = typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
let motionChosen = typeof settings.reduceMotion === 'boolean';

function systemReducesMotion() {
    return !!(motionQuery && motionQuery.matches);
}

function applyAccessibility() {
    state.reduceMotion = settings.reduceMotion;
    state.easyRide = !!settings.easyRide;
    document.documentElement.setAttribute('data-reduce-motion', String(settings.reduceMotion));
}

function persistSettings() {
    // Until the player chooses, reduceMotion is not stored, so the system setting keeps deciding.
    saveSettings(motionChosen ? settings : { ...settings, reduceMotion: undefined });
}

if (!motionChosen) settings.reduceMotion = systemReducesMotion();
applyAccessibility();
if (motionQuery) {
    const onMotionChange = () => {
        if (motionChosen) return;
        settings.reduceMotion = systemReducesMotion();
        applyAccessibility();
        refreshSettingButtons();
    };
    if (motionQuery.addEventListener) motionQuery.addEventListener('change', onMotionChange);
    else if (motionQuery.addListener) motionQuery.addListener(onMotionChange);
}
audio.setSettings(settings);

// Unlock audio inside the gesture's own handler (needed on iOS Safari).
for (const type of ['pointerdown', 'keydown', 'click', 'touchend']) {
    window.addEventListener(type, () => audio.unlock(), true);
}

// Saved high scores
Object.assign(state.bests, loadHighScores());
state.best = state.bests[state.difficulty] || 0;

function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state.viewHalfTan = w / (2 * Math.min(w, h) * CONFIG.focalRatio);
    view = {
        w,
        h,
        horizonY: h * CONFIG.horizonRatio,
        focal: Math.min(w, h) * CONFIG.focalRatio
    };
}

window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
resize();

const INSTALL_LINE = 'To install: tap Share, then Add to Home Screen.';
const HINT_KEY = 'trailbadger.iosHintDismissed';

// How to play panel, built from CONFIG values
const infoItems = [
    ['Goal', 'You are Brock the badger. Chase Tod the fox for as long as you can.'],
    ['Steer', 'Touch the left or right half of the screen. On a keyboard, use the arrow keys.'],
    ['Trees', 'Hit one and the run ends.'],
    ['Tod', 'If Tod is out of sight for ' + CONFIG.foxLostLimit +
        ' seconds, Tod gets away. An arrow shows which way to go.'],
    ['Ramps', 'Ride over them to jump and get a short speed boost. Each landed jump scores ' +
        CONFIG.jumpBonus + ' times your combo.'],
    ['Combo', 'Land ramps in a row to raise the combo, up to x' + CONFIG.comboMax +
        '. Riding past a ramp without jumping resets it.'],
    ['Near misses', 'Pass close to a tree without hitting it, on the ground, for ' +
        CONFIG.nearMissPoints + ' points. Not while boost protection is on.'],
    ['Pickups', [
        'Berries: ride over them for ' + CONFIG.berryPoints + ' points each.',
        'Mushroom: for ' + CONFIG.mushroomTime + ' seconds Tod may be out of sight ' +
            CONFIG.mushroomBonus + ' second longer.',
        'Snake: Brock throws it at Tod, and Tod then rides straight for ' +
            CONFIG.snakeStraightTime + ' seconds.',
        'Acorn: appears from level ' + CONFIG.acornMinLevel + '. Hold one and the next tree crash is ' +
            'saved, with ' + CONFIG.respawnShieldTime + ' seconds of protection. Jump over pickups to skip them.'
    ]],
    ['Hazards', [
        'Logs and falling trees block the trail. Ride round them, or jump them from a ramp.',
        'Bears lean out from behind trees, so leave some room.',
        'Birds block your view for a moment but cannot hurt you.',
        'A boost smashes through logs.'
    ]],
    ['Pause', 'Tap the pause button, or press P or Escape. The game also pauses when you leave it. ' +
        'Tap the screen or press Space to resume.'],
    ['Boost', 'Every ' + CONFIG.jumpsPerCharge +
        ' landed jumps earns a boost. Hold both sides of the screen to use it. For ' +
        CONFIG.chargeBoostTime + ' seconds Brock also bounces off tree trunks instead of ' +
        'crashing. The protection ends when the boost ends, and Tod can still get away.'],
    ['Levels', 'Every ' + CONFIG.levelDistance + ' m the ride gets faster, up to level ' +
        CONFIG.maxLevel + '. At level ' + CONFIG.maxLevel + ' Tod can be caught. A catch scores ' +
        CONFIG.catchPoints + ' points and the ride carries on from level ' +
        CONFIG.catchRestartLevel + '.'],
    ['Difficulty', 'Beginner, Normal and Expert change how many trees there are.'],
    ['Accessibility', 'The Accessibility button, a figure in a circle, opens two options. Reduce motion turns off screen shake, flashes and ' +
        'drifting effects. Easy ride gives Tod a longer time out of sight before Tod gets away.'],
    ['Sound', 'Sound settings are behind the speaker button. On an iPhone, the ring/silent switch also mutes game sound.'],
    ['Install (iPhone or iPad)', INSTALL_LINE]
];
for (const [label, text] of infoItems) {
    const li = document.createElement('li');
    const strong = document.createElement('strong');
    strong.textContent = label;
    li.appendChild(strong);
    if (Array.isArray(text)) {
        for (const line of text) {
            const div = document.createElement('div');
            div.textContent = line;
            li.appendChild(div);
        }
    } else {
        li.appendChild(document.createTextNode(text));
    }
    infoList.appendChild(li);
}

// Lifetime stats: loaded once, updated when a run ends.
let stats = loadStats();
let runRecorded = false;   // a run is recorded once, when it ends
let runLogsSmashed = 0;    // world.js does not count smashed logs, so count them here
let seenSmashTime = state.smashTime;
let resetTimer = 0;

function beginRun(difficulty) {
    resetWorld(state, difficulty);
    runRecorded = false;
    runLogsSmashed = 0;
    seenSmashTime = state.smashTime;
}

function trackRun() {
    if (state.smashTime !== seenSmashTime) {
        seenSmashTime = state.smashTime;
        if (state.mode === 'riding') runLogsSmashed += 1;
    }
    if (runRecorded || (state.mode !== 'crashed' && state.mode !== 'lost')) return;
    runRecorded = true;
    stats = addRunToStats(stats, {
        distance: state.distance,
        level: state.catches > 0 ? CONFIG.maxLevel : state.level,
        jumps: state.jumps,
        bestCombo: state.bestCombo,
        berries: state.berries,
        nearMisses: state.nearMisses,
        catches: state.catches,
        respawns: state.respawns,
        bounces: state.bounces,
        logsSmashed: runLogsSmashed,
        ending: state.mode === 'lost' ? 'lost' : (state.crashCause || 'tree'),
        difficulty: state.difficulty
    });
    saveStats(stats);
}

function formatDistance(m) {
    return m > 1000 ? (m / 1000).toFixed(1) + ' km' : Math.round(m) + ' m';
}

function renderStats() {
    statsBody.textContent = '';
    if (stats.runs < 1) {
        const p = document.createElement('p');
        p.className = 'stats-empty';
        p.textContent = 'No rides yet. Finish a ride and your stats will show up here.';
        statsBody.appendChild(p);
        return;
    }
    const bests = state.bests;
    const sections = [
        ['Rides', [
            ['Runs', stats.runs],
            ['Total distance', formatDistance(stats.distance)],
            ['Longest run', stats.longestRun + ' m'],
            ['Highest level', stats.highestLevel]
        ]],
        ['Best scores', Object.keys(CONFIG.difficulties).map((key) => [
            CONFIG.difficulties[key].label,
            (bests[key] > 0 ? bests[key] : '-') + ' (' + (stats.runsByDifficulty[key] || 0) +
                (stats.runsByDifficulty[key] === 1 ? ' run)' : ' runs)')
        ])],
        ['Tricks', [
            ['Jumps landed', stats.jumps],
            ['Best combo', 'x' + stats.bestCombo],
            ['Near misses', stats.nearMisses],
            ['Bounces', stats.bounces],
            ['Logs smashed', stats.logsSmashed]
        ]],
        ['Forest', [
            ['Berries', stats.berries],
            ['Times Tod was caught', stats.foxesCaught],
            ['Acorn saves', stats.acornSaves]
        ]],
        ['How rides ended', [
            ['Tree', stats.endings.tree],
            ['Log', stats.endings.log],
            ['Bear', stats.endings.bear],
            ['Tod got away', stats.endings.lost]
        ]]
    ];
    for (const [heading, rows] of sections) {
        const h = document.createElement('h3');
        h.textContent = heading;
        statsBody.appendChild(h);
        for (const [label, value] of rows) {
            const row = document.createElement('div');
            row.className = 'stats-row';
            const l = document.createElement('span');
            l.textContent = label;
            const v = document.createElement('b');
            v.textContent = value;
            row.appendChild(l);
            row.appendChild(v);
            statsBody.appendChild(row);
        }
    }
}

function disarmReset() {
    clearTimeout(resetTimer);
    resetTimer = 0;
    statsResetBtn.textContent = 'Reset stats';
    statsResetBtn.classList.remove('is-armed');
}

statsResetBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (!resetTimer) {
        statsResetBtn.textContent = 'Tap again to reset';
        statsResetBtn.classList.add('is-armed');
        resetTimer = setTimeout(disarmReset, 3000);
        return;
    }
    disarmReset();
    stats = loadStats();
    for (const k of Object.keys(stats)) {
        if (typeof stats[k] === 'number') stats[k] = 0;
        else for (const j of Object.keys(stats[k])) stats[k][j] = 0;
    }
    saveStats(stats);
    renderStats();
});

// Dialogs: how to play, sound, accessibility and stats share one open/close path.
const dialogs = {
    info: { backdrop: infoBackdrop, close: infoClose, opener: infoBtn },
    sound: { backdrop: soundBackdrop, close: soundClose, opener: soundBtn },
    access: { backdrop: accessBackdrop, close: accessClose, opener: accessBtn },
    stats: { backdrop: statsBackdrop, close: statsClose, opener: statsBtn }
};
let activeDialog = null;

function openDialog(name) {
    if (name === 'stats') {
        disarmReset();
        renderStats();
    }
    activeDialog = dialogs[name];
    infoOpen = true;
    activeDialog.backdrop.hidden = false;
    activeDialog.close.focus();
}

function closeInfo() {
    if (!infoOpen) return;
    const d = activeDialog;
    disarmReset();
    infoOpen = false;
    activeDialog = null;
    d.backdrop.hidden = true;
    if (!d.opener.hidden) d.opener.focus();
}

for (const [name, d] of Object.entries(dialogs)) {
    d.opener.addEventListener('click', (e) => {
        e.preventDefault();
        openDialog(name);
    });
    d.close.addEventListener('click', (e) => {
        e.preventDefault();
        closeInfo();
    });
    d.backdrop.addEventListener('click', (e) => {
        if (e.target === d.backdrop) closeInfo();
    });
}

function easySeconds() {
    return (CONFIG.foxLostLimit * CONFIG.easyRideLostFactor).toFixed(1);
}
helpEasy.textContent = 'Tod can be out of sight for ' + easySeconds() + ' seconds, not ' +
    CONFIG.foxLostLimit + '.';

function refreshSettingButtons() {
    for (const btn of segButtons) {
        btn.setAttribute('aria-pressed',
            String(String(settings[btn.dataset.setting]) === btn.dataset.value));
    }
}
refreshSettingButtons();

for (const btn of segButtons) {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        const key = btn.dataset.setting;
        settings[key] = key === 'volume' ? btn.dataset.value : btn.dataset.value === 'true';
        if (key === 'reduceMotion') motionChosen = true;
        applyAccessibility();
        refreshSettingButtons();
        audio.setSettings(settings);
        persistSettings();
    });
}

// Charge display: static icons and dots, toggled by class
const chargeEls = [];
for (let i = 0; i < CONFIG.maxCharges; i++) {
    const el = document.createElement('span');
    el.className = 'charge';
    hudCharges.appendChild(el);
    chargeEls.push(el);
}
const dotEls = [];
for (let i = 0; i < CONFIG.jumpsPerCharge; i++) {
    const el = document.createElement('span');
    el.className = 'dot';
    hudDots.appendChild(el);
    dotEls.push(el);
}

// Install option: shown on the splash and end screens after the first run has ended.
let playedOnce = false;
let hintDismissed = false;
try {
    hintDismissed = localStorage.getItem(HINT_KEY) === '1';
} catch (e) {
    // Storage blocked: the hint simply shows each time.
}

function refreshInstall() {
    const idle = state.mode === 'ready' || state.mode === 'crashed' || state.mode === 'lost';
    const ended = state.mode === 'crashed' || state.mode === 'lost';
    const standalone = isStandalone();
    installBtn.hidden = !(idle && playedOnce && !standalone && isInstallAvailable());
    iosHint.hidden = !(ended && playedOnce && !standalone && isIos() && !hintDismissed);
}

onInstallAvailable(refreshInstall);
installBtn.addEventListener('click', (e) => {
    e.preventDefault();
    installBtn.blur();
    promptInstall();
});
iosHintClose.addEventListener('click', (e) => {
    e.preventDefault();
    hintDismissed = true;
    try {
        localStorage.setItem(HINT_KEY, '1');
    } catch (err) {
        // Ignore: dismissal lasts for this page view only.
    }
    refreshInstall();
});

function canRestart() {
    return (state.mode === 'crashed' || state.mode === 'lost') &&
        state.time - state.crashTime >= CONFIG.crashLockout;
}

function handleTap(source) {
    if (infoOpen) return;
    if (state.mode === 'paused') {
        resumeWorld(state);
    } else if (state.mode === 'ready') {
        // Only the buttons (or Space/Enter) start a run from the splash.
        if (source === 'key') beginRun();
    } else if (canRestart()) {
        beginRun();
    }
}

input.onTap(handleTap);

// The message panel takes its own touches, so it can be pinch zoomed. A tap on its text acts like
// a tap on the canvas (resume, ride again). Buttons inside it handle themselves.
panelEl.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    handleTap('pointer');
});

function startRun(difficulty) {
    if (state.mode === 'riding' || infoOpen) return;
    beginRun(difficulty);
}

for (const btn of diffButtons) {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        btn.blur();
        startRun(btn.dataset.difficulty);
    });
}

menuBtn.addEventListener('click', (e) => {
    e.preventDefault();
    menuBtn.blur();
    if (!infoOpen && (state.mode === 'crashed' || state.mode === 'lost' || state.mode === 'paused')) {
        setReady(state); // from a paused run this ends it without recording a score
    }
});

pauseBtn.addEventListener('click', (e) => {
    e.preventDefault();
    pauseBtn.blur();
    pauseWorld(state);
});

function togglePause() {
    if (state.mode === 'riding') pauseWorld(state);
    else if (state.mode === 'paused') resumeWorld(state);
}

// Leaving the page or the window pauses a run. Nothing resumes it again but the player.
document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseWorld(state);
});
window.addEventListener('blur', () => pauseWorld(state));

window.addEventListener('keydown', (e) => {
    if (infoOpen) {
        if (e.key === 'Escape') {
            e.preventDefault();
            closeInfo();
        } else if (e.key === 'Tab') {
            e.preventDefault();
            if (activeDialog) activeDialog.close.focus();
        }
        return;
    }
    if ((e.key === 'Escape' || e.key === 'p' || e.key === 'P') && !e.repeat) {
        e.preventDefault();
        togglePause();
        return;
    }
    if (state.mode !== 'ready' || e.repeat) return;
    const keys = { '1': 'beginner', '2': 'normal', '3': 'expert' };
    if (e.key in keys) startRun(keys[e.key]);
});

// Flash queue: one element, one message at a time
const flashQueue = [];
let flashBusy = false;
let flashTimer = 0;

// Screen reader announcements. The polite region gets running commentary, the alert region the result.
function announce(text) {
    const el = document.createElement('div');
    el.textContent = text;
    livePolite.appendChild(el);
    setTimeout(() => el.remove(), 6000);
}

function announceResult(text) {
    liveAlert.textContent = '';
    setTimeout(() => { liveAlert.textContent = text; }, 50);
}

function motionReduced() {
    return state.reduceMotion || systemReducesMotion();
}

function playNextFlash() {
    const text = flashQueue.shift();
    if (text === undefined) {
        flashBusy = false;
        return;
    }
    flashBusy = true;
    flashEl.textContent = text;
    flashEl.classList.remove('is-on', 'is-static');
    void flashEl.offsetWidth;
    if (motionReduced()) {
        // No CSS animation: show the text in place, then move on to the next one.
        flashEl.classList.add('is-static');
        clearTimeout(flashTimer);
        flashTimer = setTimeout(() => {
            flashEl.classList.remove('is-static');
            playNextFlash();
        }, 1500);
    } else {
        flashEl.classList.add('is-on');
    }
}

function queueFlash(text) {
    if (flashQueue.length >= 4) return;
    flashQueue.push(text);
    if (!flashBusy) playNextFlash();
}

function clearFlash() {
    flashQueue.length = 0;
    flashBusy = false;
    clearTimeout(flashTimer);
    flashEl.classList.remove('is-on', 'is-static');
}

flashEl.addEventListener('animationend', () => {
    if (flashEl.classList.contains('is-on')) playNextFlash();
});

// HUD and message: touch the DOM only when the value changes.
const shown = {
    score: -1, distance: -1, level: -1, charges: -1, dots: -1, combo: -1, mode: null,
    difficulty: null, best: -1, landTime: state.landTime, chargeTime: state.chargeTime,
    catchTime: state.catchTime, smashTime: state.smashTime, pickupTime: state.pickupTime, respawnTime: state.respawnTime,
    mushroom: -1, warn: false, acorn: null
};
let foxSeen = null;        // last announced fox visibility while riding, null when not riding
let lastOutAt = -1e9;      // time of the last "out of sight" announcement
let lastBackAt = -1e9;     // time of the last "back in sight" announcement
let endedEasy = false;     // easy ride was on when the last run ended
const END_CAUSE = { tree: 'Brock hit a tree', log: 'Brock hit a log', bear: 'Brock hit a bear' };
const CRASH_KICKER = { tree: 'Crash!', log: 'Hit a log!', bear: 'Bear!' };
const PICKUP_FLASH = { mushroom: 'Mushroom!', snake: 'Snake!', acorn: 'Acorn!' };

function showMessage(opts) {
    const splash = !!opts.splash;
    actionsEl.hidden = !splash;
    menuBtn.hidden = splash;
    panelEl.classList.toggle('message__panel--splash', splash);
    logoEl.hidden = !splash;
    kickerEl.textContent = opts.kicker || '';
    titleEl.textContent = opts.title || '';
    badgeEl.hidden = !opts.badge;
    line1El.textContent = opts.line1 || '';
    line2El.textContent = opts.line2 || '';
    line3El.textContent = opts.line3 || '';
    if (opts.easy) {
        line2El.appendChild(document.createTextNode(' '));
        line2El.appendChild(easyTagEl);
    }
    breakdownEl.hidden = !opts.breakdown;
    infoBtn.hidden = false;
    soundBtn.hidden = false;
    statsBtn.hidden = false;
    accessBtn.hidden = false;
    messageEl.hidden = false;
}

function refreshBests() {
    for (const btn of diffButtons) {
        const v = state.bests[btn.dataset.difficulty];
        btn.querySelector('.diff-btn__best').textContent = 'Best: ' + (v > 0 ? v : '-');
    }
}

function updateHud() {
    const riding = state.mode === 'riding';
    hudEl.hidden = !(riding || state.mode === 'paused');
    // The corner buttons show while paused, so the HUD drops below them.
    hudEl.classList.toggle('hud--paused', state.mode === 'paused');
    pauseBtn.hidden = !riding;
    if (riding) {
        infoBtn.hidden = true;
        soundBtn.hidden = true;
        statsBtn.hidden = true;
        accessBtn.hidden = true;
    }

    if (state.score !== shown.score) {
        shown.score = state.score;
        hudScore.textContent = state.score;
    }
    const metres = Math.floor(state.distance);
    if (metres !== shown.distance) {
        shown.distance = metres;
        hudDistance.textContent = metres + ' m';
    }

    if (state.level !== shown.level) {
        // Flash only on a real level-up while riding, not on a reset to level 1.
        if (riding && state.level > shown.level && shown.level > 0) {
            queueFlash(state.level === CONFIG.maxLevel ? 'Catch Tod!' : 'Level ' + state.level);
        }
        if (riding && shown.level > 0 && state.level > 1) {
            announce('Level ' + state.level + (state.level === CONFIG.maxLevel ? '. Tod can be caught.' : ''));
        }
        shown.level = state.level;
        hudLevelText.textContent = 'Lv ' + state.level;
        // A different colour at the top level: the fox can be caught now.
        hudLevel.classList.toggle('hud__level--top', state.level === CONFIG.maxLevel);
    }

    if (state.charges !== shown.charges) {
        if (riding && shown.charges === 0 && state.charges === 1) announce('Boost ready');
        shown.charges = state.charges;
        chargeEls.forEach((el, i) => el.classList.toggle('is-ready', i < state.charges));
        hudHint.hidden = state.charges < 1;
    }
    const dots = state.jumps % CONFIG.jumpsPerCharge;
    if (dots !== shown.dots) {
        shown.dots = dots;
        dotEls.forEach((el, i) => el.classList.toggle('is-on', i < dots));
    }

    if (state.combo !== shown.combo) {
        shown.combo = state.combo;
        hudCombo.hidden = state.combo < 2;
        hudCombo.textContent = 'x' + state.combo;
    }

    // Event flashes, only for fresh events while riding
    if (state.landTime !== shown.landTime) {
        shown.landTime = state.landTime;
        if (riding && state.time - state.landTime < 0.5) queueFlash('+' + state.lastJumpPoints +
            (state.combo > 1 ? ' x' + state.combo : ''));
    }
    if (state.chargeTime !== shown.chargeTime) {
        shown.chargeTime = state.chargeTime;
        if (riding && state.time - state.chargeTime < 0.5) queueFlash('Boost!');
    }

    if (state.pickupTime !== shown.pickupTime) {
        shown.pickupTime = state.pickupTime;
        if (riding && state.time - state.pickupTime < 0.5 && PICKUP_FLASH[state.pickupType]) {
            queueFlash(PICKUP_FLASH[state.pickupType]);
        }
    }
    if (state.catchTime !== shown.catchTime) {
        shown.catchTime = state.catchTime;
        if (riding && state.time - state.catchTime < 0.5) {
            queueFlash('Caught Tod! +' + CONFIG.catchPoints);
            announce('Caught Tod, plus ' + CONFIG.catchPoints + ' points');
        }
    }
    if (state.smashTime !== shown.smashTime) {
        shown.smashTime = state.smashTime;
        if (riding && state.time - state.smashTime < 0.5) queueFlash('Smash!');
    }
    if (state.respawnTime !== shown.respawnTime) {
        shown.respawnTime = state.respawnTime;
        if (riding && state.time - state.respawnTime < 0.5) queueFlash('Saved by the acorn!');
    }

    // Held items: the mushroom shows whole seconds left, pulsing in the last 3
    const mushSecs = Math.ceil(state.mushroom);
    const warn = state.mushroom > 0 && state.mushroom <= 3;
    if (mushSecs !== shown.mushroom || warn !== shown.warn) {
        shown.mushroom = mushSecs;
        shown.warn = warn;
        hudMushroom.hidden = mushSecs <= 0;
        // The last 3 seconds are bold with an exclamation mark, not only a pulse.
        hudMushroomS.textContent = mushSecs + (warn ? '!' : '');
        hudMushroom.classList.toggle('is-warn', warn);
    }
    if (state.acorn !== shown.acorn) {
        shown.acorn = state.acorn;
        hudAcorn.hidden = !state.acorn;
    }

    const best = Math.floor(state.best);
    if (state.mode !== shown.mode || state.difficulty !== shown.difficulty ||
        (!riding && best !== shown.best)) {
        const modeChanged = state.mode !== shown.mode;
        const prevMode = shown.mode;
        shown.mode = state.mode;
        shown.best = best;
        shown.difficulty = state.difficulty;
        for (const btn of diffButtons) {
            btn.setAttribute('aria-pressed', String(btn.dataset.difficulty === state.difficulty));
        }
        refreshBests();
        if (!riding) clearFlash();
        const label = CONFIG.difficulties[state.difficulty].label;
        if (modeChanged) {
            if (riding && prevMode === 'paused') announce('Resumed');
            else if (riding) announce('Ride started. ' + label + ' difficulty.');
            else if (state.mode === 'paused' && prevMode === 'riding') announce('Paused');
        }
        if (state.mode === 'ready') {
            showMessage({
                splash: true,
                title: 'Brock & Tod',
                line1: 'Tod the Fox is cunning, but Brock the Badger never gives up.',
                line2: 'Choose a difficulty to ride.'
            });
        } else if (state.mode === 'crashed' || state.mode === 'lost') {
            if (modeChanged && state.newBest) saveHighScores(state.bests);
            if (modeChanged) {
                endedEasy = state.easyRide;
                const cause = state.mode === 'lost' ? 'Tod got away' : (END_CAUSE[state.crashCause] || END_CAUSE.tree);
                announceResult(cause + ', score ' + state.score + ', distance ' + metres + ' metres, level ' +
                    state.level + (state.newBest ? ', new high score.' : '.'));
            }
            playedOnce = true;
            bdDist.textContent = metres + ' m';
            bdDistPts.textContent = Math.floor(state.distance * CONFIG.pointsPerMetre);
            bdJumps.textContent = state.jumps + ' (best combo x' + state.bestCombo + ')';
            bdJumpPts.textContent = state.jumpPoints;
            bdBerries.textContent = state.berries;
            bdBerryPts.textContent = state.berries * CONFIG.berryPoints;
            bdSaves.hidden = state.respawns < 1;
            bdSaves.textContent = 'Acorn saves: ' + state.respawns;
            bdNear.textContent = state.nearMisses;
            bdNearPts.textContent = state.nearMisses * CONFIG.nearMissPoints;
            bdCatch.textContent = state.catches;
            bdCatchPts.textContent = state.catches * CONFIG.catchPoints;
            bdTotal.textContent = state.score;
            showMessage({
                kicker: state.mode === 'crashed' ? (CRASH_KICKER[state.crashCause] || 'Crash!') : 'Tod got away',
                title: 'Score ' + state.score,
                badge: state.newBest,
                breakdown: true,
                line2: label + '. Best: ' + best,
                easy: endedEasy,
                line3: 'Tap to ride again'
            });
        } else if (state.mode === 'paused') {
            showMessage({ title: 'Paused', line1: 'Tap to resume' });
        } else {
            messageEl.hidden = true;
        }
        refreshInstall();
    }
    if (riding && infoOpen) closeInfo();

    // Tod in or out of sight, while riding. At most one of each announcement per second.
    if (riding && state.fox) {
        const visible = !!state.fox.visible;
        if (foxSeen === null) foxSeen = visible;
        if (visible !== foxSeen) {
            foxSeen = visible;
            if (!visible && state.time - lastOutAt >= 1) {
                lastOutAt = state.time;
                announce('Tod is out of sight');
            } else if (visible && state.time - lastBackAt >= 1) {
                lastBackAt = state.time;
                announce('Tod is back in sight');
            }
        }
    } else {
        foxSeen = null;
    }
}

let last = null;

function frame(now) {
    const dt = last === null ? 0 : Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    const frozen = infoOpen || state.mode === 'paused';
    updateWorld(state, dt, frozen ? 0 : input.steer(), frozen ? false : input.both());
    trackRun();
    audio.update(state);
    drawScene(ctx, state, view);
    drawCockpit(ctx, state, view);
    drawIndicator(ctx, state, view);
    updateHud();
    registerServiceWorker();
requestAnimationFrame(frame);
}

// After the tab was hidden, restart timing so no huge dt gets through.
document.addEventListener('visibilitychange', () => {
    last = null;
});

registerServiceWorker();
requestAnimationFrame(frame);
