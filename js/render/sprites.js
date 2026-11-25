// Brock & Tod sprites drawn in the rolled scene space: jump ramp and fox rider.
// Both are sized only from scale (pixels per metre) and CONFIG.

import { CONFIG } from '../config.js';

const HAZE = [176, 186, 150];
const TAU = Math.PI * 2;

function mix(c, f) {
    if (f <= 0) return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
    return 'rgb(' + Math.round(c[0] + (HAZE[0] - c[0]) * f) + ',' +
        Math.round(c[1] + (HAZE[1] - c[1]) * f) + ',' +
        Math.round(c[2] + (HAZE[2] - c[2]) * f) + ')';
}

const RAMP_WOOD = [176, 126, 70];
const RAMP_DARK = [112, 76, 40];
const RAMP_LIP = [220, 176, 106];
const RAMP_MARK = [255, 214, 32];
const RAMP_WHITE = [250, 246, 230];

/**
 * Wooden kicker seen from the approach side. baseY is the ground line at the
 * ramp foot, screenX its centre. haze is 0 (none) to 1 (fully hazed).
 */
export function drawRamp(ctx, screenX, baseY, scale, haze) {
    const hw = CONFIG.rampHalfWidth * scale;
    const hh = Math.max(CONFIG.rampHeight * scale, 2.5);
    const top = baseY - hh;
    const lipW = hw * 0.94;

    // Shadow on the ground.
    ctx.fillStyle = 'rgba(20,18,8,0.3)';
    ctx.fillRect(screenX - hw * 1.05, baseY - 0.5, hw * 2.1, Math.max(1.5, scale * 0.15));

    // Face of the ramp.
    ctx.fillStyle = mix(RAMP_WOOD, haze);
    ctx.beginPath();
    ctx.moveTo(screenX - hw, baseY);
    ctx.lineTo(screenX + hw, baseY);
    ctx.lineTo(screenX + lipW, top);
    ctx.lineTo(screenX - lipW, top);
    ctx.closePath();
    ctx.fill();
    // Dark outline so the ramp separates from the ground by lightness in every theme.
    ctx.strokeStyle = 'rgba(28,18,10,0.75)';
    ctx.lineWidth = Math.max(1, scale * 0.045);
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Plank lines.
    if (hh > 7) {
        ctx.strokeStyle = mix(RAMP_DARK, haze);
        ctx.lineWidth = Math.max(1, scale * 0.04);
        ctx.beginPath();
        for (let i = 1; i < 5; i++) {
            const t = i / 5;
            const half = hw + (lipW - hw) * t;
            const y = baseY - hh * t;
            ctx.moveTo(screenX - half, y);
            ctx.lineTo(screenX + half, y);
        }
        ctx.stroke();
    }

    // Bright lip bar.
    ctx.fillStyle = mix(RAMP_LIP, haze);
    ctx.fillRect(screenX - lipW, top - Math.max(1, scale * 0.1), lipW * 2, Math.max(1, scale * 0.1));

    // Side markers: yellow posts with white caps, visible from far away.
    const mw = Math.max(2, scale * 0.22);
    const mh = Math.max(hh * 1.5, 5);
    ctx.fillStyle = mix(RAMP_MARK, haze * 0.5);
    ctx.fillRect(screenX - hw - mw, baseY - mh, mw, mh);
    ctx.fillRect(screenX + hw, baseY - mh, mw, mh);
    ctx.fillStyle = mix(RAMP_WHITE, haze * 0.5);
    ctx.fillRect(screenX - hw - mw, baseY - mh, mw, Math.max(1, mh * 0.3));
    ctx.fillRect(screenX + hw, baseY - mh, mw, Math.max(1, mh * 0.3));
}

const FOX_ORANGE = [255, 104, 0];
const FOX_LIGHT = [255, 255, 255];
const FOX_DARK = [44, 26, 18];
const FOX_WHITE = [255, 246, 228];
const FOX_WHEEL = [24, 26, 30];
const FOX_BAR = [52, 58, 64];

const NO_POSE = { taunt: 0, sprint: 0, tail: null, straight: 0, calm: false };

/**
 * Rear view of a fox on a mountain bike. baseY is the rear wheel contact
 * point. scale is pixels per metre, the fox is about 1.5 m tall. lean is -1
 * to 1. time drives the paw wave. haze is 0 to 1. pose is optional:
 * { taunt, sprint, tail } with taunt and sprint blended 0 to 1 and tail the
 * tail wag phase. Without it the fox draws in its cruise pose. pose.calm
 * (reduce motion) halves the tail and wave swing and drops the sprint lines,
 * dust and rattle shiver.
 */
export function drawFox(ctx, screenX, baseY, scale, lean, time, haze, pose) {
    const p = pose || NO_POSE;
    const tn = p.taunt;
    const sp = p.sprint;
    const st = p.straight || 0;
    const calm = !!p.calm;
    const orange = mix(FOX_ORANGE, haze);
    const light = mix(FOX_LIGHT, haze);
    const dark = mix(FOX_DARK, haze);
    const white = mix(FOX_WHITE, haze * 0.6);
    const wheel = mix(FOX_WHEEL, haze);
    const bar = mix(FOX_BAR, haze);

    ctx.save();
    ctx.translate(screenX, baseY);
    // Soft ground shadow so the bike sits on the trail.
    ctx.fillStyle = 'rgba(15,12,6,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 0, scale * 0.45, scale * 0.09, 0, 0, TAU);
    ctx.fill();

    // Sprint: speed lines and dust behind the rear wheel, in screen units.
    if (sp > 0.02 && !calm) {
        const ph = (time * 3) % 1;
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(255,252,235,' + (0.7 * sp).toFixed(3) + ')';
        ctx.lineWidth = Math.max(1, scale * 0.035);
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
            const side = i === 1 ? 1 : -1;
            const f = (ph + i / 3) % 1;
            const x0 = side * scale * (0.2 + 0.1 * i + 0.25 * f);
            const y0 = -scale * (0.2 + 0.28 * i);
            ctx.moveTo(x0, y0);
            ctx.lineTo(x0 + side * scale * (0.18 + 0.1 * f), y0 + scale * 0.03);
        }
        ctx.stroke();
        ctx.fillStyle = 'rgba(214,196,150,' + (0.55 * sp).toFixed(3) + ')';
        for (let i = 0; i < 2; i++) {
            const side = i ? 1 : -1;
            const f = (ph + i * 0.5) % 1;
            ctx.beginPath();
            ctx.arc(side * scale * (0.16 + 0.22 * f), -scale * 0.05 - scale * 0.06 * f,
                scale * (0.04 + 0.05 * f), 0, TAU);
            ctx.fill();
        }
    }

    ctx.rotate(lean * 0.35);
    // Rattled: a small fast shiver while the snake is on.
    if (st > 0.02 && !calm) ctx.translate(Math.sin(time * 45) * 0.012 * st * scale, 0);
    ctx.scale(scale, scale);
    ctx.strokeStyle = dark;
    ctx.lineJoin = 'round';
    // Outline: about 1.3 px at small sizes, growing with scale but capped at
    // 3.5 px so a close fox does not get a heavy border.
    const rim = Math.min(3.5, Math.max(1.3, scale * 0.05)) / scale;
    ctx.lineWidth = rim;

    // Rear wheel and frame.
    ctx.fillStyle = wheel;
    ctx.beginPath();
    ctx.ellipse(0, -0.36, 0.08, 0.36, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = bar;
    ctx.fillRect(-0.025, -0.75, 0.05, 0.42);

    // Hunch: upper body drops and leans forward when sprinting, sits up a touch
    // when taunting.
    const drop = 0.1 * sp - 0.03 * tn;

    // Tail, behind the body. Cruise sways, taunt wags slow and wide, sprint
    // streams back flat with little sway.
    const tailPhase = p.tail === null ? time * 5 : p.tail;
    const amp = 0.45 + 0.5 * tn - 0.33 * sp;
    const sway = Math.sin(tailPhase) * amp * (calm ? 0.5 : 1);
    const a = -1.05 + 0.55 * sp + sway - lean * 0.2;
    const len = 0.95 + 0.12 * sp;
    const bx = 0.1;
    const by = -0.72 + drop * 0.5;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    ctx.fillStyle = orange;
    ctx.beginPath();
    ctx.ellipse(bx + ca * len * 0.5, by + sa * len * 0.5, len * 0.5, 0.19, a, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = white;
    ctx.beginPath();
    ctx.ellipse(bx + ca * len * 0.9, by + sa * len * 0.9, len * 0.22, 0.17, a, 0, TAU);
    ctx.fill();

    // Dark socks on the pedals.
    ctx.fillStyle = dark;
    ctx.fillRect(-0.3, -0.34, 0.1, 0.12);
    ctx.fillRect(0.2, -0.3, 0.1, 0.12);

    // Handlebar and arms. In a taunt the right arm swings up in a wave.
    ctx.strokeStyle = bar;
    ctx.lineWidth = 0.05;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-0.4, -1.0);
    ctx.lineTo(0.4, -1.0);
    ctx.stroke();
    const sy = -1.1 + drop;
    ctx.strokeStyle = orange;
    ctx.lineWidth = 0.11;
    ctx.beginPath();
    ctx.moveTo(-0.2, sy);
    ctx.lineTo(-0.36, -1.0);
    ctx.moveTo(0.2, sy);
    let wx = 0.36;
    let wy = -1.0;
    if (tn > 0.01) {
        const wave = Math.sin(time * 8) * (calm ? 0.06 : 0.12);
        wx = 0.36 + (0.55 + wave - 0.36) * tn;
        wy = -1.0 + (-1.52 - -1.0) * tn;
    }
    ctx.lineTo(wx, wy);
    ctx.stroke();
    if (tn > 0.01) {
        // Raised paw: dark mitt with a pale pad.
        const pr = 0.07 + 0.03 * tn;
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.arc(wx, wy - 0.03 * tn, pr, 0, TAU);
        ctx.fill();
    }

    // Body.
    ctx.fillStyle = orange;
    ctx.beginPath();
    ctx.ellipse(0, -0.82 + drop * 0.6, 0.27, 0.33 - 0.05 * sp, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.ellipse(0, -0.72 + drop * 0.5, 0.17, 0.2 - 0.03 * sp, 0, 0, TAU);
    ctx.fill();

    if (st > 0.02) drawSnakeWrap(ctx, st, time, rim, calm);

    // Head and ears. Shifted down when hunched, turned to look back when taunting.
    ctx.save();
    const hy = -1.27 + drop * 1.4;
    ctx.translate(-0.06 * tn, hy);
    ctx.rotate(-0.22 * tn);
    const hs = 1 + 0.12 * tn;
    ctx.scale(hs, hs);
    ctx.fillStyle = orange;
    ctx.beginPath();
    ctx.arc(0, 0, 0.19, 0, TAU);
    ctx.fill();
    ctx.stroke();
    for (let s = -1; s <= 1; s += 2) {
        ctx.fillStyle = orange;
        ctx.beginPath();
        ctx.moveTo(s * 0.19, 0.03);
        ctx.lineTo(s * 0.03, -0.15);
        ctx.lineTo(s * 0.16, -0.39);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.moveTo(s * 0.12, -0.23);
        ctx.lineTo(s * 0.07, -0.2);
        ctx.lineTo(s * 0.16, -0.39);
        ctx.closePath();
        ctx.fill();
    }
    // Back of the head fades out as the face turns round.
    if (tn < 0.98) {
        ctx.fillStyle = light;
        ctx.beginPath();
        ctx.ellipse(0, 0.05, 0.1 * (1 - tn), 0.09, 0, 0, TAU);
        ctx.fill();
    }
    if (tn > 0.25) {
        // Profile face: white muzzle poking out to the left, one eye, a grin.
        const k = Math.min(1, (tn - 0.25) / 0.75);
        ctx.globalAlpha *= k;
        ctx.fillStyle = white;
        ctx.beginPath();
        ctx.ellipse(-0.17, 0.05, 0.17, 0.11, 0.1, 0, TAU);
        ctx.fill();
        ctx.lineWidth = rim * 0.8;
        ctx.strokeStyle = dark;
        ctx.stroke();
        // Nose.
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.arc(-0.33, 0.03, Math.max(0.035, 0.9 / scale), 0, TAU);
        ctx.fill();
        // Eye: pale with a dark pupil, and a raised brow for the cheeky look.
        const er = Math.max(0.04, 1.3 / scale);
        ctx.fillStyle = light;
        ctx.beginPath();
        ctx.arc(-0.07, -0.05, er, 0, TAU);
        ctx.fill();
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.arc(-0.09, -0.05, er * 0.55, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = dark;
        ctx.lineWidth = Math.max(0.02, 1 / scale);
        ctx.beginPath();
        ctx.moveTo(-0.14, -0.13);
        ctx.lineTo(-0.02, -0.1);
        ctx.stroke();
        // Grin: curved mouth line with the corner turned up.
        ctx.lineWidth = Math.max(0.025, 1.1 / scale);
        ctx.beginPath();
        ctx.moveTo(-0.31, 0.08);
        ctx.quadraticCurveTo(-0.18, 0.17, -0.06, 0.07);
        ctx.stroke();
        ctx.globalAlpha /= k;
    }
    ctx.restore();

    if (st > 0.02) drawRattled(ctx, st, time, scale, calm);

    ctx.restore();
}

const SNAKE_GREEN = [70, 214, 56];
const SNAKE_DARK = [20, 96, 30];
const SNAKE_BELLY = [214, 244, 110];

// Green snake wrapped twice round the fox body, head up by the shoulder.
// Drawn in fox units (metres, origin at the rear wheel contact), alpha follows st.
function drawSnakeWrap(ctx, st, time, rim, calm) {
    ctx.save();
    ctx.globalAlpha *= st;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Two diagonal coils across the body, dark edge first, then bright green.
    for (let pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = pass ? mix(SNAKE_GREEN, 0) : mix(SNAKE_DARK, 0);
        ctx.lineWidth = pass ? 0.11 : 0.11 + rim * 1.6;
        ctx.beginPath();
        ctx.moveTo(-0.28, -1.0);
        ctx.quadraticCurveTo(0.0, -0.8, 0.28, -0.7);
        ctx.moveTo(-0.28, -0.78);
        ctx.quadraticCurveTo(0.0, -0.6, 0.27, -0.52);
        ctx.stroke();
    }
    // Pale belly flecks along the coils.
    ctx.fillStyle = mix(SNAKE_BELLY, 0);
    for (let i = 0; i < 3; i++) {
        const t = 0.2 + i * 0.3;
        ctx.beginPath();
        ctx.arc(-0.28 + 0.56 * t, -0.93 + 0.26 * t + 0.03 * Math.sin(t * 3), 0.025, 0, TAU);
        ctx.fill();
    }
    // Head raised by the left shoulder, with a flicking tongue.
    ctx.fillStyle = mix(SNAKE_GREEN, 0);
    ctx.strokeStyle = mix(SNAKE_DARK, 0);
    ctx.lineWidth = rim;
    ctx.beginPath();
    ctx.moveTo(-0.28, -1.0);
    ctx.lineTo(-0.34, -1.1);
    ctx.lineTo(-0.38, -1.18);
    ctx.lineWidth = 0.11 + rim * 1.6;
    ctx.stroke();
    ctx.lineWidth = 0.11;
    ctx.strokeStyle = mix(SNAKE_GREEN, 0);
    ctx.stroke();
    ctx.lineWidth = rim;
    ctx.strokeStyle = mix(SNAKE_DARK, 0);
    ctx.beginPath();
    ctx.ellipse(-0.4, -1.24, 0.11, 0.08, -0.5, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-0.43, -1.26, 0.028, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#1a1208';
    ctx.beginPath();
    ctx.arc(-0.44, -1.26, 0.015, 0, TAU);
    ctx.fill();
    if (calm || Math.sin(time * 9) > 0) {
        ctx.strokeStyle = '#e02020';
        ctx.lineWidth = Math.max(0.02, rim * 0.8);
        ctx.beginPath();
        ctx.moveTo(-0.49, -1.22);
        ctx.lineTo(-0.58, -1.2);
        ctx.moveTo(-0.58, -1.2);
        ctx.lineTo(-0.62, -1.24);
        ctx.moveTo(-0.58, -1.2);
        ctx.lineTo(-0.62, -1.16);
        ctx.stroke();
    }
    ctx.restore();
}

function star4(ctx, x, y, r) {
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r * 0.3, y - r * 0.3);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x + r * 0.3, y + r * 0.3);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r * 0.3, y + r * 0.3);
    ctx.lineTo(x - r, y);
    ctx.lineTo(x - r * 0.3, y - r * 0.3);
    ctx.closePath();
}

// Rattled look: little yellow stars circling above the head and a sweat drop.
// Sizes have a pixel floor so they stay readable but tiny at minimum scale.
function drawRattled(ctx, st, time, scale, calm) {
    ctx.save();
    ctx.globalAlpha *= st;
    const r = Math.max(0.1, 2.2 / scale);
    ctx.fillStyle = '#ffe23a';
    ctx.strokeStyle = 'rgba(60,36,6,0.7)';
    ctx.lineWidth = Math.max(0.02, 0.8 / scale);
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
        const a = (calm ? 0 : time * 4) + i * TAU / 3;
        star4(ctx, Math.cos(a) * 0.3, -1.72 + Math.sin(a) * 0.07, r * (0.8 + 0.3 * Math.sin(a * 2)));
    }
    ctx.stroke();
    ctx.fill();
    // Sweat drop that slides down and fades by the right of the head.
    const f = calm ? 0.4 : (time * 1.4) % 1;
    ctx.globalAlpha *= 1 - f * f;
    ctx.fillStyle = '#9fdcff';
    const dx = 0.3;
    const dy = -1.35 + f * 0.28;
    const dr = Math.max(0.05, 1.6 / scale);
    ctx.beginPath();
    ctx.moveTo(dx, dy - dr * 1.8);
    ctx.quadraticCurveTo(dx + dr * 1.1, dy - dr * 0.2, dx, dy + dr * 0.7);
    ctx.quadraticCurveTo(dx - dr * 1.1, dy - dr * 0.2, dx, dy - dr * 1.8);
    ctx.fill();
    ctx.restore();
}

// ---------------------------------------------------------------------------
// Pickups. Each is drawn in metres with the origin at its ground contact and
// y up as negative, about 0.6 m tall, then drawn PICKUP_SIZE times larger.

const PICKUP_SIZE = 1.3;
const PICKUP_MIN = 20;          // minimum pixels per metre, about 12 px tall
const OUTLINE = 'rgba(28,18,10,0.85)';

const BERRY = [124, 24, 78];
const BERRY_HI = [214, 110, 160];
const LEAF = [196, 238, 150];        // pale, so the leaf is light against dark and mid ground
const BERRY_RING = 'rgb(255,248,226)';
const CAP_RED = [226, 38, 32];
const STEM_PALE = [244, 232, 204];
const NUT_TAN = [226, 170, 90];
const NUT_HI = [248, 214, 140];
const NUT_CAP = [92, 52, 24];

/**
 * A pickup standing on the ground. baseY is the ground line, scale pixels per
 * metre of depth, haze 0 to 1. time is the render clock and seed a per pickup
 * number (its x works) so they do not bob in step. flying skips the ground
 * shadow and bob (the thrown snake). type is 'berry', 'mushroom', 'snake' or
 * 'acorn'. calm (reduce motion) halves the bob and pulse and holds the tongue
 * flick and sparkle steady.
 */
export function drawPickup(ctx, type, screenX, baseY, scale, haze, time, seed, flying, calm) {
    // Berries are common, so they are drawn smaller than the rarer pickups.
    const big = type === 'acorn' ? 1.25 : type === 'berry' ? 0.75 : 1;
    const sc = Math.max(scale * PICKUP_SIZE, PICKUP_MIN) * big;
    const ph = time * 3.2 + (seed || 0) * 2.3;
    const k = calm ? 0.5 : 1;
    const bob = flying ? 0 : (0.5 + 0.5 * Math.sin(ph)) * 0.1 * k;
    const pulse = 1 + 0.035 * k * Math.sin(ph * 1.3);
    const h = Math.min(haze, 0.4);

    if (!flying) {
        ctx.fillStyle = 'rgba(15,12,6,0.4)';
        ctx.beginPath();
        ctx.ellipse(screenX, baseY, sc * 0.27 * (1 - bob * 1.2), sc * 0.06, 0, 0, TAU);
        ctx.fill();
    }

    ctx.save();
    ctx.translate(screenX, baseY - bob * sc);
    ctx.scale(sc * pulse, sc * pulse);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = Math.max(0.03, 1.3 / sc);
    if (type === 'berry') drawBerry(ctx, h, sc);
    else if (type === 'mushroom') drawMushroom(ctx, h);
    else if (type === 'snake') drawSnakePickup(ctx, h, time, sc, calm);
    else drawAcorn(ctx, h, time, sc, calm);
    ctx.restore();
}

function drawBerry(ctx, h, sc) {
    const pts = [[-0.14, -0.15], [0.14, -0.15], [0, -0.38]];
    // Pale leaf and stem behind the berries. Red and purple on green ground is
    // hard to tell apart for red-green colour blindness, so the cluster is
    // separated by lightness: a dark outer ring, a cream ring, then the fruit.
    const ring = Math.max(0.04, 1.5 / sc);
    const outer = Math.max(0.03, 1.1 / sc);
    ctx.fillStyle = OUTLINE;
    ctx.beginPath();
    ctx.ellipse(0.17, -0.57, 0.2 + ring + outer, 0.085 + ring + outer, -0.5, 0, TAU);
    for (let i = 0; i < 3; i++) {
        ctx.moveTo(pts[i][0] + 0.16 + ring + outer, pts[i][1]);
        ctx.arc(pts[i][0], pts[i][1], 0.16 + ring + outer, 0, TAU);
    }
    ctx.fill();
    ctx.fillStyle = BERRY_RING;
    ctx.beginPath();
    ctx.ellipse(0.17, -0.57, 0.2 + ring, 0.085 + ring, -0.5, 0, TAU);
    for (let i = 0; i < 3; i++) {
        ctx.moveTo(pts[i][0] + 0.16 + ring, pts[i][1]);
        ctx.arc(pts[i][0], pts[i][1], 0.16 + ring, 0, TAU);
    }
    ctx.fill();
    ctx.fillStyle = mix(LEAF, h);
    ctx.beginPath();
    ctx.ellipse(0.17, -0.57, 0.2, 0.085, -0.5, 0, TAU);
    ctx.fill();
    ctx.fillStyle = mix(BERRY, h);
    for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(pts[i][0], pts[i][1], 0.16, 0, TAU);
        ctx.fill();
        ctx.stroke();
    }
    // Highlights always on: they carry the light shape at small sizes too.
    ctx.fillStyle = mix(BERRY_HI, h);
    const hr = sc > 28 ? 0.04 : 0.055;
    for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(pts[i][0] - 0.05, pts[i][1] - 0.06, hr, 0, TAU);
        ctx.fill();
    }
}

function drawMushroom(ctx, h) {
    ctx.fillStyle = mix(STEM_PALE, h * 0.5);
    ctx.beginPath();
    ctx.moveTo(-0.11, 0);
    ctx.lineTo(-0.07, -0.32);
    ctx.lineTo(0.07, -0.32);
    ctx.lineTo(0.11, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = mix(CAP_RED, h);
    ctx.beginPath();
    ctx.ellipse(0, -0.34, 0.34, 0.3, 0, Math.PI, TAU);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fffaf0';
    const spots = [[-0.14, -0.44, 0.06], [0.1, -0.52, 0.055], [0.19, -0.38, 0.04], [-0.02, -0.34, 0.035]];
    for (let i = 0; i < spots.length; i++) {
        ctx.beginPath();
        ctx.arc(spots[i][0], spots[i][1], spots[i][2], 0, TAU);
        ctx.fill();
    }
}

function drawSnakePickup(ctx, h, time, sc, calm) {
    const green = mix(SNAKE_GREEN, h);
    const dark = mix(SNAKE_DARK, h);
    ctx.fillStyle = green;
    // Two stacked coils.
    ctx.beginPath();
    ctx.ellipse(0, -0.09, 0.32, 0.1, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, -0.2, 0.22, 0.085, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    // Neck rising in an S, dark edge then bright body.
    const wiggle = 0.02 * (calm ? 0.5 : 1) * Math.sin(time * 3);
    for (let pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = pass ? green : OUTLINE;
        ctx.lineWidth = pass ? 0.12 : 0.12 + Math.max(0.03, 2.4 / sc);
        ctx.beginPath();
        ctx.moveTo(0.1, -0.2);
        ctx.bezierCurveTo(0.3, -0.3, -0.14 + wiggle, -0.4, 0.0, -0.54);
        ctx.stroke();
    }
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = Math.max(0.03, 1.3 / sc);
    // Dark bands across the coils.
    ctx.strokeStyle = dark;
    ctx.lineWidth = Math.max(0.03, 1.6 / sc);
    ctx.beginPath();
    ctx.moveTo(-0.15, -0.16);
    ctx.lineTo(-0.12, -0.03);
    ctx.moveTo(0.14, -0.16);
    ctx.lineTo(0.11, -0.03);
    ctx.moveTo(-0.02, -0.27);
    ctx.lineTo(-0.02, -0.15);
    ctx.stroke();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = Math.max(0.03, 1.3 / sc);
    // Head, facing left.
    ctx.fillStyle = green;
    ctx.beginPath();
    ctx.ellipse(-0.03, -0.6, 0.12, 0.085, -0.35, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff6b0';
    ctx.beginPath();
    ctx.arc(-0.05, -0.63, 0.03, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#1a1208';
    ctx.beginPath();
    ctx.arc(-0.06, -0.63, 0.016, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = dark;
    // Forked tongue flick.
    if (calm || Math.sin(time * 7) > 0.1) {
        ctx.strokeStyle = '#e02222';
        ctx.lineWidth = Math.max(0.025, 1.4 / sc);
        ctx.beginPath();
        ctx.moveTo(-0.14, -0.58);
        ctx.lineTo(-0.25, -0.57);
        ctx.moveTo(-0.25, -0.57);
        ctx.lineTo(-0.3, -0.61);
        ctx.moveTo(-0.25, -0.57);
        ctx.lineTo(-0.3, -0.53);
        ctx.stroke();
    }
}

function drawAcorn(ctx, h, time, sc, calm) {
    // Nut with a pointed tip, then the cap and a short stalk.
    ctx.fillStyle = mix(NUT_TAN, h);
    ctx.beginPath();
    ctx.moveTo(-0.21, -0.32);
    ctx.bezierCurveTo(-0.24, -0.12, -0.08, -0.02, 0, 0);
    ctx.bezierCurveTo(0.08, -0.02, 0.24, -0.12, 0.21, -0.32);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = mix(NUT_HI, h);
    ctx.beginPath();
    ctx.ellipse(-0.09, -0.2, 0.035, 0.08, 0.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = mix(NUT_CAP, h);
    ctx.beginPath();
    ctx.ellipse(0, -0.33, 0.26, 0.2, 0, Math.PI, TAU);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(-0.025, -0.58, 0.05, 0.1);
    if (sc > 30) {
        ctx.fillStyle = mix([140, 90, 46], h);
        ctx.beginPath();
        ctx.arc(-0.1, -0.38, 0.025, 0, TAU);
        ctx.arc(0.04, -0.42, 0.025, 0, TAU);
        ctx.arc(0.13, -0.36, 0.025, 0, TAU);
        ctx.fill();
    }
    // Faint sparkle: the acorn is rare.
    const s = calm ? 0.5 : Math.max(0, Math.sin(time * 4.5));
    if (s > 0.05) {
        ctx.fillStyle = 'rgba(255,248,200,' + (0.85 * s).toFixed(3) + ')';
        ctx.beginPath();
        star4(ctx, 0.2, -0.56, 0.13 * s + 0.02);
        ctx.fill();
        ctx.beginPath();
        star4(ctx, -0.22, -0.18, 0.08 * s + 0.01);
        ctx.fill();
    }
}

// ---------------------------------------------------------------------------
// Hazards: fallen log, falling tree, bear. Same convention as the ramp: screenX
// and baseY are the ground point, scale is pixels per metre, haze 0 to 1.
// What each one blocks is exactly what it draws, measured in metres from its x.

function rrect(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

// Pale rim drawn under the dark outline of the log and the bear.
const RIM = 'rgba(255,244,214,0.5)';
const LOG_THICK = 0.7;
const LOG_BARK = [100, 70, 46];
const LOG_LIGHT = [142, 106, 70];
const LOG_DARK = [66, 44, 28];
const LOG_CUT = [232, 202, 150];
const LOG_RING = [176, 134, 88];
const LOG_LINE = [40, 26, 16];
// Broken log: the body ends this far from the centre, the pale splinters reach in to SPLINT.
const LOG_BODY_END = 0.85;
const LOG_SPLINT = 0.5;
const LOG_GROOVES = [[0.08, 0.35, 0.45], [0.42, 0.72, 0.58], [0.55, 0.9, 0.34], [0.15, 0.5, 0.68], [0.7, 0.95, 0.62]];

// Lighter cut end with growth rings, an ellipse whose outer edge is at x0 (or x1 when flip).
function logCap(ctx, x, midY, rx, ry, haze, lw) {
    ctx.fillStyle = mix(LOG_CUT, haze);
    ctx.strokeStyle = mix(LOG_LINE, haze);
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.ellipse(x, midY, rx, ry, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    if (ry > 7) {
        ctx.strokeStyle = mix(LOG_RING, haze);
        ctx.lineWidth = Math.max(1, ry * 0.07);
        ctx.beginPath();
        ctx.ellipse(x, midY, rx * 0.62, ry * 0.62, 0, 0, TAU);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(x, midY, rx * 0.26, ry * 0.26, 0, 0, TAU);
        ctx.stroke();
    }
}

// Fill the path just built as bark, with light top, dark underside and grooves,
// then the outline. x0 to x1 is the horizontal extent of the body.
function logPaint(ctx, x0, x1, top, baseY, T, haze, lw) {
    ctx.fillStyle = mix(LOG_BARK, haze);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = mix(LOG_LIGHT, haze);
    ctx.fillRect(x0 - 2, top - T, x1 - x0 + 4, T * 1.28);
    ctx.fillStyle = mix(LOG_DARK, haze);
    ctx.fillRect(x0 - 2, baseY - T * 0.24, x1 - x0 + 4, T);
    if (T > 8) {
        ctx.strokeStyle = mix(LOG_DARK, haze);
        ctx.lineWidth = Math.max(1, T * 0.05);
        ctx.beginPath();
        const W = x1 - x0;
        for (let i = 0; i < LOG_GROOVES.length; i++) {
            const g = LOG_GROOVES[i];
            const y = top + T * g[2];
            ctx.moveTo(x0 + W * g[0], y);
            ctx.lineTo(x0 + W * g[1], y);
        }
        ctx.stroke();
    }
    ctx.restore();
    // Pale rim under the dark outline, so a dark log still separates from dark ground at night.
    ctx.strokeStyle = RIM;
    ctx.lineWidth = lw + Math.max(1.5, lw * 1.6);
    ctx.stroke();
    ctx.strokeStyle = mix(LOG_LINE, haze);
    ctx.lineWidth = lw;
    ctx.stroke();
}

// Short branch stub standing up from the top of the log.
function logStub(ctx, x, top, scale, haze, lean) {
    const bw = 0.17 * scale;
    const hgt = 0.3 * scale;
    ctx.fillStyle = mix(LOG_BARK, haze);
    ctx.beginPath();
    ctx.moveTo(x - bw / 2, top + bw * 0.6);
    ctx.lineTo(x - bw * 0.3 + lean * 0.05 * scale, top - hgt);
    ctx.lineTo(x + bw * 0.3 + lean * 0.05 * scale, top - hgt);
    ctx.lineTo(x + bw / 2, top + bw * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = mix(LOG_CUT, haze);
    ctx.fillRect(x - bw * 0.3 + lean * 0.05 * scale, top - hgt - Math.max(1, bw * 0.12), bw * 0.6, Math.max(1, bw * 0.2));
}

// The left half of a broken log (the right half is this mirrored). The inner end
// is snapped: tilted up a little and ending in pale splinters.
function logHalf(ctx, sx, baseY, scale, T, lw, haze) {
    const xa = sx - CONFIG.logLength * scale / 2 + lw / 2;
    const xi = Math.max(xa + 2, sx - LOG_BODY_END * scale);
    const xt = Math.max(xi, sx - LOG_SPLINT * scale);
    const top = baseY - T;
    const rz = 0.16 * scale;
    const r = T * 0.32;
    if (scale > 9) logStub(ctx, sx - 1.5 * scale, top, scale, haze, -1);
    ctx.beginPath();
    ctx.moveTo(xa, baseY - r);
    ctx.arcTo(xa, top, xa + r, top, r);
    ctx.lineTo(xi, top - rz);
    ctx.lineTo(xi, baseY);
    ctx.lineTo(xa + r, baseY);
    ctx.arcTo(xa, baseY, xa, baseY - r, r);
    ctx.closePath();
    logPaint(ctx, xa, xi, top, baseY, T, haze, lw);
    // Splinters.
    const y0 = top - rz;
    const hh = baseY - y0;
    const reach = [0, 1, 0.3, 0.85, 0.2, 0.95, 0];
    ctx.fillStyle = mix(LOG_CUT, haze);
    ctx.strokeStyle = mix(LOG_LINE, haze);
    ctx.lineWidth = Math.max(1, lw * 0.8);
    ctx.lineJoin = 'miter';
    ctx.beginPath();
    ctx.moveTo(xi, y0);
    for (let i = 1; i < reach.length; i++) ctx.lineTo(xi + (xt - xi) * reach[i], y0 + hh * i / (reach.length - 1));
    ctx.lineTo(xi, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.lineJoin = 'round';
    const cap = Math.min(Math.max(T * 0.2, 2), (xi - xa) * 0.3);
    logCap(ctx, xa + cap, baseY - T / 2, cap, T / 2 - lw / 2, haze, lw);
}

/**
 * Fallen log across the trail, CONFIG.logLength long and centred on screenX. The
 * outer edge of its outline is exactly the end of the blocked span.
 */
export function drawLog(ctx, screenX, baseY, scale, haze, broken) {
    const sx = screenX;
    const half = CONFIG.logLength * scale / 2;
    const T = Math.max(LOG_THICK * scale, 3);
    const lw = Math.max(1, scale * 0.035);
    ctx.lineJoin = 'round';

    // Ground shadow, inside the span.
    ctx.fillStyle = 'rgba(20,18,8,0.32)';
    ctx.beginPath();
    if (broken) {
        const mid = (half + LOG_BODY_END * scale) / 2;
        const rx = (half - LOG_BODY_END * scale) / 2;
        ctx.ellipse(sx - mid, baseY, rx, Math.max(1.5, T * 0.22), 0, 0, TAU);
        ctx.moveTo(sx + mid + rx, baseY);
        ctx.ellipse(sx + mid, baseY, rx, Math.max(1.5, T * 0.22), 0, 0, TAU);
    } else {
        ctx.ellipse(sx, baseY, half, Math.max(1.5, T * 0.22), 0, 0, TAU);
    }
    ctx.fill();

    if (broken) {
        logHalf(ctx, sx, baseY, scale, T, lw, haze);
        ctx.save();
        ctx.translate(sx, 0);
        ctx.scale(-1, 1);
        ctx.translate(-sx, 0);
        logHalf(ctx, sx, baseY, scale, T, lw, haze);
        ctx.restore();
        // Scuffed ground and loose chips in the gap.
        ctx.fillStyle = 'rgba(30,22,12,0.4)';
        ctx.fillRect(sx - LOG_SPLINT * scale * 0.9, baseY - Math.max(1, scale * 0.05), LOG_SPLINT * scale * 1.8, Math.max(1.5, scale * 0.1));
        if (scale > 9) {
            ctx.fillStyle = mix(LOG_CUT, haze);
            ctx.fillRect(sx - 0.3 * scale, baseY - 0.12 * scale, 0.2 * scale, 0.07 * scale);
            ctx.fillRect(sx + 0.1 * scale, baseY - 0.07 * scale, 0.16 * scale, 0.06 * scale);
        }
        return;
    }

    const xa = sx - half + lw / 2;
    const xb = sx + half - lw / 2;
    const top = baseY - T;
    if (scale > 9) {
        logStub(ctx, sx - 1.4 * scale, top, scale, haze, -1);
        logStub(ctx, sx + 0.95 * scale, top, scale, haze, 1);
    }
    ctx.beginPath();
    rrect(ctx, xa, top, xb - xa, T, T * 0.4);
    logPaint(ctx, xa, xb, top, baseY, T, haze, lw);
    // Branch knot facing the rider.
    if (T > 10) {
        const kr = 0.1 * scale;
        ctx.fillStyle = mix(LOG_CUT, haze);
        ctx.strokeStyle = mix(LOG_LINE, haze);
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.ellipse(sx + 1.15 * scale, baseY - T * 0.45, kr, kr * 0.8, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();
    }
    const cap = Math.min(Math.max(T * 0.2, 2), (xb - xa) * 0.2);
    logCap(ctx, xa + cap, baseY - T / 2, cap, T / 2 - lw / 2, haze, lw);
    logCap(ctx, xb - cap, baseY - T / 2, cap, T / 2 - lw / 2, haze, lw);
}

// Falling tree. Local frame: origin at the stump base, x lateral, up is -y.
const FALL_LEAN = 0.12;                  // warning lean at progress 0 (about 7 degrees)
const FALL_DUST = 0.55;                  // seconds the impact dust puff lasts
const FALL_TRUNK = [84, 58, 40];
const FALL_TRUNK_L = [116, 84, 56];
const FALL_FOL = [96, 116, 48];          // dull olive: the sick tree looks different from the pines
const FALL_FOL_L = [140, 154, 64];
const FALL_CUT = [244, 230, 178];
const FALL_TIERS = [[0.2, 0.58, 1.9], [0.4, 0.78, 1.55], [0.6, 1, 1.05]];

/**
 * Falling tree. screenX is the stump, dir the side it falls to, p the fall progress
 * 0 to 1 and dust the seconds since impact (-1 for none). The trunk is
 * CONFIG.fallLength long, so lying flat it reaches exactly the blocked span.
 */
export function drawFallingTree(ctx, screenX, baseY, scale, dir, p, haze, dust, calm) {
    const d = dir < 0 ? -1 : 1;
    const q = p < 0 ? 0 : p > 1 ? 1 : p;
    const H = CONFIG.fallLength;
    const bw = CONFIG.trunkRadius;
    const theta = FALL_LEAN + (Math.PI / 2 - FALL_LEAN) * q * q;
    const sinT = Math.sin(theta);
    const u = scale;
    const trunk = mix(FALL_TRUNK, haze);
    const light = mix(FALL_TRUNK_L, haze);
    const cut = mix(FALL_CUT, haze);

    // Ground shadow follows the trunk.
    ctx.fillStyle = 'rgba(20,18,8,0.28)';
    ctx.beginPath();
    ctx.ellipse(screenX + d * sinT * H * u / 2, baseY, Math.max(bw * 1.5, sinT * H / 2) * u, Math.max(1.5, u * (0.12 + 0.2 * sinT)), 0, 0, TAU);
    ctx.fill();

    ctx.save();
    ctx.translate(screenX, baseY - bw * u * sinT);
    ctx.rotate(d * theta);

    // Trunk, tapering, light on the side that ends up on top.
    const ls = -d;
    ctx.fillStyle = trunk;
    ctx.beginPath();
    ctx.moveTo(-bw * u, 0);
    ctx.lineTo(bw * u, 0);
    ctx.lineTo(bw * 0.5 * u, -H * u);
    ctx.lineTo(-bw * 0.5 * u, -H * u);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.moveTo(ls * bw * u, 0);
    ctx.lineTo(ls * bw * 0.3 * u, 0);
    ctx.lineTo(ls * bw * 0.15 * u, -H * u);
    ctx.lineTo(ls * bw * 0.5 * u, -H * u);
    ctx.closePath();
    ctx.fill();

    // Crown: three tiers along the trunk, the tip of the last at the trunk end.
    ctx.fillStyle = mix(FALL_FOL, haze);
    ctx.beginPath();
    for (let i = 0; i < FALL_TIERS.length; i++) {
        const t = FALL_TIERS[i];
        ctx.moveTo(-t[2] * u, -t[0] * H * u);
        ctx.lineTo(0, -t[1] * H * u);
        ctx.lineTo(t[2] * u, -t[0] * H * u);
        ctx.closePath();
    }
    ctx.fill();
    if (u * bw > 2) {
        ctx.fillStyle = mix(FALL_FOL_L, haze);
        ctx.beginPath();
        for (let i = 0; i < FALL_TIERS.length; i++) {
            const t = FALL_TIERS[i];
            ctx.moveTo(ls * t[2] * u, -t[0] * H * u);
            ctx.lineTo(0, -t[1] * H * u);
            ctx.lineTo(ls * t[2] * 0.2 * u, -t[0] * H * u);
            ctx.closePath();
        }
        ctx.fill();
    }

    // Warning: a pale split opening up the base on the side it falls to, with a dark crack.
    ctx.fillStyle = cut;
    ctx.beginPath();
    ctx.moveTo(d * bw * u, 0.05 * u * -1);
    ctx.lineTo(d * bw * -0.5 * u, -0.9 * u);
    ctx.lineTo(d * bw * 0.1 * u, -2.5 * u);
    ctx.lineTo(d * bw * 0.95 * u, -1.3 * u);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = mix([46, 30, 20], haze);
    ctx.lineWidth = Math.max(1, u * 0.05);
    ctx.beginPath();
    ctx.moveTo(d * bw * 0.45 * u, -0.1 * u);
    ctx.lineTo(d * bw * 0.2 * u, -1.1 * u);
    ctx.lineTo(d * bw * 0.35 * u, -1.8 * u);
    ctx.stroke();
    ctx.restore();

    // Once it moves, a short broken stump stays standing: jagged top, pale wood.
    if (q > 0) {
        const hs = [1.0, 1.35, 0.9, 1.5, 1.05, 1.25];
        ctx.fillStyle = trunk;
        ctx.beginPath();
        ctx.moveTo(screenX - bw * u, baseY);
        ctx.lineTo(screenX + bw * u, baseY);
        for (let i = 0; i < 6; i++) ctx.lineTo(screenX + bw * u * (1 - i * 0.4), baseY - hs[i] * u);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = light;
        ctx.fillRect(screenX - bw * u, baseY - 0.95 * u, bw * u * 0.5, 0.95 * u);
        ctx.fillStyle = cut;
        ctx.beginPath();
        ctx.moveTo(screenX + bw * u, baseY - hs[0] * u);
        for (let i = 1; i < 6; i++) ctx.lineTo(screenX + bw * u * (1 - i * 0.4), baseY - hs[i] * u);
        for (let i = 5; i >= 0; i--) ctx.lineTo(screenX + bw * u * (1 - i * 0.4), baseY - hs[i] * u + Math.max(1.5, 0.2 * u));
        ctx.closePath();
        ctx.fill();
    }
    // Chips on the ground by the base.
    ctx.fillStyle = cut;
    ctx.fillRect(screenX + d * (bw + 0.12) * u, baseY - 0.07 * u, 0.22 * u, Math.max(1, 0.07 * u));
    ctx.fillRect(screenX + d * (bw + 0.5) * u, baseY - 0.04 * u, 0.15 * u, Math.max(1, 0.05 * u));

    // Impact dust, low along the lying trunk.
    if (!calm && dust >= 0 && dust < FALL_DUST) {
        const k = dust / FALL_DUST;
        const a = 0.55 * Math.pow(1 - k, 1.3);
        ctx.fillStyle = 'rgba(214,204,168,' + a.toFixed(3) + ')';
        for (let i = 0; i < 7; i++) {
            const along = 0.35 + 0.1 * i;
            const rise = 0.3 + 1.6 * k * (0.6 + 0.2 * (i % 3));
            const r = u * (0.5 + 1.1 * k) * (0.7 + 0.15 * (i % 3));
            ctx.beginPath();
            ctx.arc(screenX + d * (along * H + (i % 2 ? 0.7 : -0.3) * k) * u, baseY - rise * u, r, 0, TAU);
            ctx.fill();
        }
    }
}

const BEAR_FUR = [122, 82, 52];
const BEAR_DARK = [90, 58, 36];
const BEAR_LIGHT = [212, 176, 130];
const BEAR_LINE = [38, 24, 14];
const BEAR_CLAW = [240, 234, 218];
const BEAR_PAW_R = 0.21;
const BEAR_CLAW_LEN = 0.15;

/**
 * Bear leaning out from behind a trunk at screenX. Draw this BEFORE the tree.
 * p is the lean 0 to 1. At p = 1 the tip of the claws is CONFIG.bearReach beyond
 * the trunk edge on the dir side.
 */
export function drawBear(ctx, screenX, baseY, scale, dir, p, haze) {
    const d = dir < 0 ? -1 : 1;
    const q = p < 0 ? 0 : p > 1 ? 1 : p;
    const e = q * q * (3 - 2 * q);
    const lw = Math.max(1, scale * 0.045);
    const k = d * scale;
    const fur = mix(BEAR_FUR, haze);
    const dark = mix(BEAR_DARK, haze);
    const line = mix(BEAR_LINE, haze);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Body: a leaning capsule from hip to shoulder.
    const shU = 0.1 + 0.42 * e;
    const bodyW = 0.84 * scale;
    const rim = Math.max(1.5, lw * 1.6);
    ctx.strokeStyle = RIM;
    ctx.lineWidth = bodyW + rim;
    ctx.beginPath();
    ctx.moveTo(screenX + k * 0.05, baseY - 0.5 * scale);
    ctx.lineTo(screenX + k * shU, baseY - 1.35 * scale);
    ctx.stroke();
    ctx.strokeStyle = line;
    ctx.lineWidth = bodyW;
    ctx.stroke();
    ctx.strokeStyle = fur;
    ctx.lineWidth = Math.max(1, bodyW - lw * 2);
    ctx.stroke();

    // Reaching arm and big paw. The claw tip ends exactly at trunk edge + bearReach.
    const tip = CONFIG.trunkRadius + CONFIG.bearReach - lw / 2 / scale;
    const pawU = 0.52 + (tip - BEAR_PAW_R - BEAR_CLAW_LEN - 0.52) * e;
    const pawH = 0.95 + 0.2 * e;
    const armW = 0.4 * scale;
    ctx.strokeStyle = RIM;
    ctx.lineWidth = armW + rim;
    ctx.beginPath();
    ctx.moveTo(screenX + k * (shU + 0.05), baseY - 1.25 * scale);
    ctx.lineTo(screenX + k * pawU, baseY - pawH * scale);
    ctx.stroke();
    ctx.strokeStyle = line;
    ctx.lineWidth = armW;
    ctx.stroke();
    ctx.strokeStyle = fur;
    ctx.lineWidth = Math.max(1, armW - lw * 2);
    ctx.stroke();

    const px = screenX + k * pawU;
    const py = baseY - pawH * scale;
    const pr = BEAR_PAW_R * scale;
    // Claws, fanned, pointing outwards.
    ctx.fillStyle = mix(BEAR_CLAW, haze);
    ctx.strokeStyle = line;
    ctx.lineWidth = lw;
    for (let i = -1; i <= 1; i++) {
        const a = i * 0.5;
        const c = Math.cos(a);
        const s = Math.sin(a);
        const reach = pr + BEAR_CLAW_LEN * scale * (i === 0 ? 1 : 0.85);
        const bx = pr * 0.7;
        const w = pr * 0.22;
        ctx.beginPath();
        ctx.moveTo(px + d * (c * bx - s * w), py + (s * bx + c * w));
        ctx.lineTo(px + d * c * reach, py + s * reach);
        ctx.lineTo(px + d * (c * bx + s * w), py + (s * bx - c * w));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, TAU);
    ctx.fill();
    ctx.stroke();
    if (pr > 4) {
        ctx.fillStyle = mix(BEAR_LIGHT, haze);
        ctx.beginPath();
        ctx.ellipse(px + d * pr * 0.1, py + pr * 0.1, pr * 0.45, pr * 0.38, 0, 0, TAU);
        ctx.fill();
    }

    // Head: ears, face, lighter muzzle, nose, eyes with a frown.
    const hu = 0.1 + 0.75 * e;
    const hx = screenX + k * hu;
    const hy = baseY - 1.85 * scale;
    const hr = 0.38 * scale;
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(d * 0.22 * e);
    for (let i = -1; i <= 1; i += 2) {
        ctx.fillStyle = fur;
        ctx.strokeStyle = line;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.arc(i * 0.33 * scale, -0.3 * scale, 0.16 * scale, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = mix(BEAR_LIGHT, haze);
        ctx.beginPath();
        ctx.arc(i * 0.33 * scale, -0.3 * scale, 0.08 * scale, 0, TAU);
        ctx.fill();
    }
    ctx.fillStyle = fur;
    ctx.strokeStyle = line;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.arc(0, 0, hr, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = mix(BEAR_LIGHT, haze);
    ctx.beginPath();
    ctx.ellipse(0, 0.13 * scale, 0.21 * scale, 0.16 * scale, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = line;
    ctx.beginPath();
    ctx.ellipse(0, 0.05 * scale, 0.08 * scale, 0.055 * scale, 0, 0, TAU);
    ctx.fill();
    if (scale > 6) {
        for (let i = -1; i <= 1; i += 2) {
            ctx.fillStyle = line;
            ctx.beginPath();
            ctx.arc(i * 0.16 * scale, -0.1 * scale, 0.05 * scale, 0, TAU);
            ctx.fill();
            ctx.strokeStyle = line;
            ctx.lineWidth = Math.max(1, scale * 0.04);
            ctx.beginPath();
            ctx.moveTo(i * 0.26 * scale, -0.22 * scale);
            ctx.lineTo(i * 0.08 * scale, -0.15 * scale);
            ctx.stroke();
        }
    }
    ctx.restore();
    ctx.lineCap = 'butt';
}

// ---------------------------------------------------------------------------
// Screen space effects: the bird across the view and the smash burst. Neither
// is part of the world, both are sized from the view only.

const BIRD_BODY = '#1a1c26';
const BIRD_FAR = '#12141c';
const BIRD_SHEEN = '#3e4560';
const BIRD_BEAK = '#eca832';
export const BIRD_FEATHER_TIME = 0.4;
const BIRD_BEAT = 0.75;   // wing beats per second, under CONFIG.maxBlinkRate
// Trailing edge of a wing in units of s, from the tip back to the root.
const WING_EDGE = [1.5, 0.06, 1.62, 0.22, 1.12, 0.2, 1.22, 0.42, 0.72, 0.36, 0.78, 0.56, 0.25, 0.5, 0, 0.45];

function birdSize(view) {
    return Math.min(view.w * 0.4, view.h * 0.42);
}

// Bird centre for u 0 to 1: off screen at both ends, slower through the middle.
function birdX(view, s, d, u) {
    return view.w / 2 + d * (view.w + 4.6 * s) * ((u - 0.5) - 0.08 * Math.sin(TAU * (u - 0.5)));
}

function birdWing(ctx, side, s, a, body, sheen) {
    ctx.save();
    ctx.translate(side * 0.3 * s, -0.12 * s);
    ctx.scale(side, 1);
    ctx.rotate(-a);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(0, -0.3 * s);
    ctx.quadraticCurveTo(0.9 * s, -0.6 * s, 1.95 * s, -0.12 * s);
    for (let i = 0; i < WING_EDGE.length; i += 2) ctx.lineTo(WING_EDGE[i] * s, WING_EDGE[i + 1] * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = sheen;
    ctx.beginPath();
    ctx.moveTo(0.1 * s, -0.28 * s);
    ctx.quadraticCurveTo(0.9 * s, -0.55 * s, 1.8 * s, -0.14 * s);
    ctx.quadraticCurveTo(0.9 * s, -0.36 * s, 0.1 * s, -0.1 * s);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

/**
 * Large dark bird, seen from the front with its head turned to the way it flies,
 * sweeping across the view. t is seconds since the bird started, dir -1 for right
 * to left and 1 for left to right, blockTime the seconds it crosses. For another
 * BIRD_FEATHER_TIME after that only loose feathers drift.
 * The wing beat is slow (BIRD_BEAT cycles per second) so the large dark shape never
 * alternates faster than CONFIG.maxBlinkRate. calm (reduce motion) draws a still
 * silhouette in the centre that fades in and out over blockTime, with no sweep,
 * no flapping and no feathers.
 */
export function drawBird(ctx, view, t, dir, blockTime, calm) {
    const d = dir < 0 ? -1 : 1;
    const s = birdSize(view);
    const unit = Math.min(view.w, view.h);
    const yb = view.h * 0.42;
    const end = calm ? blockTime : blockTime + BIRD_FEATHER_TIME;
    if (t < 0 || t >= end) return;

    // Loose feathers, shed along the way, drifting down and sideways.
    const fade = Math.min(1, (end - t) / 0.15);
    for (let i = 0; i < (calm ? 0 : 6); i++) {
        const tr = blockTime * (0.18 + 0.13 * i);
        const age = t - tr;
        if (age < 0) continue;
        const ur = tr / blockTime;
        const ox = birdX(view, s, d, ur) + (i - 2.5) * 0.55 * s;
        const oy = yb + (i % 2 ? -0.35 : 0.3) * s;
        const x = ox + d * unit * (0.1 + 0.03 * (i % 3)) * age + Math.sin(age * 9 + i) * unit * 0.03;
        const y = oy + unit * 0.12 * age + unit * 0.5 * age * age;
        const len = unit * (0.06 + 0.012 * (i % 3));
        ctx.save();
        ctx.globalAlpha = fade * Math.min(1, age / 0.05);
        ctx.translate(x, y);
        ctx.rotate(i * 1.3 + age * (i % 2 ? 6 : -6));
        ctx.fillStyle = '#242838';
        ctx.beginPath();
        ctx.ellipse(0, 0, len, len * 0.2, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#8a92b0';
        ctx.lineWidth = Math.max(1, unit * 0.004);
        ctx.beginPath();
        ctx.moveTo(-len, 0);
        ctx.lineTo(len, 0);
        ctx.stroke();
        ctx.restore();
    }
    ctx.globalAlpha = 1;
    if (t >= blockTime) return;

    const u = t / blockTime;
    const phase = t * TAU * BIRD_BEAT;
    const a = calm ? 0.35 : 0.2 + 0.75 * Math.sin(phase);
    ctx.save();
    if (calm) {
        // Fade in over the first third, out over the last third, peak 0.9.
        ctx.globalAlpha = 0.9 * Math.max(0, Math.min(1, u / 0.3, (1 - u) / 0.3));
        ctx.translate(view.w / 2, yb);
    } else {
        ctx.translate(birdX(view, s, d, u), yb - Math.sin(phase) * 0.05 * s);
        ctx.rotate(d * 0.18);
    }

    // Tail fan, far wing, body, near wing, head.
    ctx.fillStyle = BIRD_FAR;
    ctx.beginPath();
    ctx.moveTo(-0.28 * s, 0.45 * s);
    ctx.lineTo(0.28 * s, 0.45 * s);
    ctx.lineTo(0.42 * s, 1.0 * s);
    ctx.lineTo(0.14 * s, 0.9 * s);
    ctx.lineTo(0, 1.05 * s);
    ctx.lineTo(-0.14 * s, 0.9 * s);
    ctx.lineTo(-0.42 * s, 1.0 * s);
    ctx.closePath();
    ctx.fill();
    birdWing(ctx, -d, s, a - 0.12, BIRD_FAR, BIRD_FAR);
    ctx.fillStyle = BIRD_BODY;
    ctx.beginPath();
    ctx.ellipse(0, 0, 0.5 * s, 0.68 * s, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = BIRD_SHEEN;
    ctx.beginPath();
    ctx.ellipse(-d * 0.12 * s, -0.12 * s, 0.17 * s, 0.4 * s, d * 0.2, 0, TAU);
    ctx.fill();
    birdWing(ctx, d, s, a, BIRD_BODY, BIRD_SHEEN);
    ctx.fillStyle = BIRD_BODY;
    ctx.beginPath();
    ctx.arc(d * 0.15 * s, -0.78 * s, 0.31 * s, 0, TAU);
    ctx.fill();
    ctx.fillStyle = BIRD_BEAK;
    ctx.beginPath();
    ctx.moveTo(d * 0.4 * s, -0.92 * s);
    ctx.lineTo(d * 0.4 * s, -0.66 * s);
    ctx.lineTo(d * 0.95 * s, -0.76 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff8e0';
    ctx.beginPath();
    ctx.arc(d * 0.26 * s, -0.86 * s, 0.08 * s, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#0a0a10';
    ctx.beginPath();
    ctx.arc(d * 0.285 * s, -0.86 * s, 0.045 * s, 0, TAU);
    ctx.fill();
    ctx.restore();
}

const SPLINT_COLOURS = ['#ecd2a0', '#d6b078', '#9a6e44', '#6a4a30', '#f4e4c0'];

/**
 * Smash burst: splinters and bark chips thrown out and up from the lower centre
 * of the view, with a brief ring of dust. t is seconds since the smash, dur the
 * length of the effect.
 */
export function drawSmash(ctx, view, t, dur) {
    const unit = Math.min(view.w, view.h);
    const u = t / dur;
    const ox = view.w / 2;
    const oy = view.h * 0.7;
    const fade = u < 0.55 ? 1 : Math.max(0, 1 - (u - 0.55) / 0.45);

    // Dust ring.
    if (t < 0.22) {
        const k = t / 0.22;
        ctx.fillStyle = 'rgba(218,196,150,' + (0.42 * (1 - k)).toFixed(3) + ')';
        ctx.beginPath();
        ctx.ellipse(ox, oy, unit * (0.1 + 0.42 * k), unit * (0.06 + 0.22 * k), 0, 0, TAU);
        ctx.fill();
    }

    ctx.globalAlpha = fade;
    for (let i = 0; i < 26; i++) {
        const f = (i * 0.618) % 1;
        const a = -Math.PI * (0.06 + 0.88 * ((i * 0.381 + 0.13) % 1));
        const sp = unit * (0.95 + 1.5 * f);
        const px = ox + Math.cos(a) * sp * t * (1 - 0.3 * u);
        const py = oy + Math.sin(a) * sp * t + unit * 2 * t * t;
        const vx = Math.cos(a) * sp;
        const vy = Math.sin(a) * sp + unit * 4 * t;
        ctx.fillStyle = SPLINT_COLOURS[i % SPLINT_COLOURS.length];
        ctx.save();
        ctx.translate(px, py);
        if (i % 3) {
            // Splinter: a long thin shard pointing along its flight, tumbling a little.
            ctx.rotate(Math.atan2(vy, vx) + Math.sin(t * 9 + i) * 0.4);
            const L = unit * (0.07 + 0.07 * f);
            ctx.beginPath();
            ctx.moveTo(L, 0);
            ctx.lineTo(-L * 0.6, -L * 0.14);
            ctx.lineTo(-L * 0.4, L * 0.1);
            ctx.closePath();
        } else {
            // Bark chip: a small tumbling slab.
            ctx.rotate(i * 1.3 + t * (i % 2 ? 11 : -11));
            const c = unit * (0.02 + 0.012 * f);
            ctx.beginPath();
            ctx.rect(-c * 1.4, -c, c * 2.8, c * 2);
        }
        ctx.fill();
        ctx.strokeStyle = 'rgba(40,26,16,0.7)';
        ctx.lineWidth = Math.max(1, unit * 0.003);
        ctx.stroke();
        ctx.restore();
    }
    ctx.globalAlpha = 1;
}
