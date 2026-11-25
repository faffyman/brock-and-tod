// Brock & Tod out-of-sight indicator: edge arrow and countdown while the fox
// is not visible. Screen space, drawn after the cockpit.

import { CONFIG } from '../config.js';

const TAU = Math.PI * 2;

function arrowPath(ctx, x, y, size, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.2, -size * 0.85);
    ctx.lineTo(-size * 0.2, -size * 0.35);
    ctx.lineTo(-size * 0.9, -size * 0.35);
    ctx.lineTo(-size * 0.9, size * 0.35);
    ctx.lineTo(-size * 0.2, size * 0.35);
    ctx.lineTo(-size * 0.2, size * 0.85);
    ctx.closePath();
    ctx.restore();
}

function foxMarker(ctx, x, y, r) {
    ctx.fillStyle = '#e8741f';
    ctx.strokeStyle = '#2c1a12';
    ctx.lineWidth = Math.max(1.5, r * 0.18);
    ctx.beginPath();
    ctx.moveTo(x - r, y - r * 0.2);
    ctx.lineTo(x - r * 0.85, y - r * 1.25);
    ctx.lineTo(x - r * 0.2, y - r * 0.75);
    ctx.lineTo(x + r * 0.2, y - r * 0.75);
    ctx.lineTo(x + r * 0.85, y - r * 1.25);
    ctx.lineTo(x + r, y - r * 0.2);
    ctx.quadraticCurveTo(x + r * 0.9, y + r * 0.9, x, y + r);
    ctx.quadraticCurveTo(x - r * 0.9, y + r * 0.9, x - r, y - r * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff6e4';
    ctx.beginPath();
    ctx.arc(x, y + r * 0.55, r * 0.28, 0, TAU);
    ctx.fill();
}

// Shield cue: golden edge glow on both sides plus a draining arc above the stem.
// Gradients are cached and rebuilt only when the view size changes.
let edgeLeft = null;
let edgeRight = null;
let edgeKey = '';

// Small shield outline, drawn upright and centred on x, y. The icon is 1 unit
// wide by 1.15 tall times size. warn adds an exclamation mark inside.
function shieldIcon(ctx, x, y, size, warn, colour) {
    const hw = size * 0.5;
    const top = y - size * 0.575;
    const bot = y + size * 0.575;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x - hw, top + size * 0.12);
    ctx.quadraticCurveTo(x, top - size * 0.08, x + hw, top + size * 0.12);
    ctx.lineTo(x + hw, y + size * 0.1);
    ctx.quadraticCurveTo(x + hw * 0.8, bot - size * 0.12, x, bot);
    ctx.quadraticCurveTo(x - hw * 0.8, bot - size * 0.12, x - hw, y + size * 0.1);
    ctx.closePath();
    ctx.fillStyle = 'rgba(30,20,6,0.6)';
    ctx.fill();
    // Dark outline under a bright one, so the icon reads on any ground.
    ctx.strokeStyle = 'rgba(30,20,6,0.9)';
    ctx.lineWidth = Math.max(3.5, size * 0.2);
    ctx.stroke();
    ctx.strokeStyle = colour;
    ctx.lineWidth = Math.max(2, size * 0.1);
    ctx.stroke();
    if (warn) {
        ctx.fillStyle = colour;
        ctx.strokeStyle = colour;
        ctx.lineWidth = Math.max(2, size * 0.13);
        ctx.beginPath();
        ctx.moveTo(x, y - size * 0.3);
        ctx.lineTo(x, y + size * 0.1);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y + size * 0.28, Math.max(1.2, size * 0.075), 0, TAU);
        ctx.fill();
    }
    ctx.restore();
}

// Slowest cycle per second used for any pulse here: half of CONFIG.maxBlinkRate,
// so a light to dark change never happens more than maxBlinkRate times a second.
const PULSE_HZ = CONFIG.maxBlinkRate / 2;

function drawShield(ctx, state, view) {
    const shield = state.shield;
    if ((state.mode !== 'riding' && state.mode !== 'paused') || !(shield > 0)) return;

    // The last shieldWarnTime seconds: lighter colour, dashed arc and an
    // exclamation mark. Unless reduce motion is on, the glow also breathes
    // between a bright and a dim state (both visible, at most PULSE_HZ cycles a second).
    const warn = shield <= CONFIG.shieldWarnTime;
    let glow = 1;
    if (warn && !state.reduceMotion && state.mode !== 'paused') {
        glow = 0.7 + 0.3 * Math.cos(state.time * TAU * PULSE_HZ);
    }

    const w = view.w;
    const h = view.h;
    const unit = Math.min(w, h);
    const bw = unit * 0.1;
    const key = w + '|' + h;
    if (key !== edgeKey) {
        edgeLeft = ctx.createLinearGradient(0, 0, bw, 0);
        edgeLeft.addColorStop(0, 'rgba(255,196,60,0.55)');
        edgeLeft.addColorStop(1, 'rgba(255,196,60,0)');
        edgeRight = ctx.createLinearGradient(w, 0, w - bw, 0);
        edgeRight.addColorStop(0, 'rgba(255,196,60,0.55)');
        edgeRight.addColorStop(1, 'rgba(255,196,60,0)');
        edgeKey = key;
    }
    // Side edges only, full height. The HUD pills sit in the centre, clear of these strips.
    ctx.globalAlpha = glow;
    ctx.fillStyle = edgeLeft;
    ctx.fillRect(0, 0, bw, h);
    ctx.fillStyle = edgeRight;
    ctx.fillRect(w - bw, 0, bw, h);
    ctx.globalAlpha = 1;

    // Draining arc over the stem, same sizing as the cockpit.
    const barW = Math.min(w * 0.96, h * 1.25);
    const half = Math.min(barW / 2, (h * 0.29) / 0.82);
    const cx = w / 2;
    const cy = h - half * 0.5 - half * 0.12;
    const r = half * 0.3;
    const frac = Math.min(1, shield / CONFIG.chargeBoostTime);
    const colour = warn ? '#ffe9a0' : '#ffc43c';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(4, unit * 0.014);
    ctx.strokeStyle = 'rgba(30,20,6,0.55)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = colour;
    if (warn) {
        ctx.lineCap = 'butt';
        ctx.setLineDash([unit * 0.028, unit * 0.02]);
    }
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI * (1.5 - 0.5 * frac), Math.PI * (1.5 + 0.5 * frac));
    ctx.stroke();
    ctx.setLineDash([]);

    // Shape cues inside the arc: a shield icon (with an exclamation mark in the
    // warning) and the whole seconds left.
    const iconSize = r * 0.62;
    const iy = cy - r * 0.42;
    shieldIcon(ctx, cx - r * 0.34, iy, iconSize, warn, colour);
    const fs = Math.round(r * 0.62);
    ctx.font = '800 ' + fs + 'px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, fs * 0.2);
    ctx.strokeStyle = 'rgba(30,20,6,0.9)';
    const label = String(Math.ceil(shield));
    ctx.strokeText(label, cx + r * 0.02, iy);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, cx + r * 0.02, iy);
}

export function drawIndicator(ctx, state, view) {
    drawShield(ctx, state, view);

    const fox = state.fox;
    if (state.mode !== 'riding' || !fox || fox.visible !== false) return;

    const w = view.w;
    const unit = Math.min(w, view.h);
    const limit = typeof state.lostLimit === 'number' && state.lostLimit > 0 ? state.lostLimit : CONFIG.foxLostLimit;
    const lost = Math.max(0, fox.lostTime || 0);
    const left = Math.max(0, limit - lost);
    const urgency = Math.min(1, lost / limit);
    // Size pulse only, slower than maxBlinkRate cycles a second, and none in reduce motion.
    const pulse = state.reduceMotion ? 1 : 1 + 0.14 * Math.sin(state.time * TAU * PULSE_HZ * (0.5 + 0.5 * urgency));

    const dx = fox.x - state.player.x;
    const halfTan = state.viewHalfTan || w / (2 * view.focal);
    const sideOut = Math.abs(dx) / Math.max(fox.z, 0.01) > halfTan;
    const size = unit * 0.075 * pulse;
    const fs = Math.round(unit * 0.065);

    const hot = urgency > 0.5;
    ctx.fillStyle = hot ? '#ff3b2f' : '#ffc61a';
    ctx.strokeStyle = '#1b1208';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, unit * 0.012);

    let ax;
    let ay;
    let angle;
    let tx;
    let ty;
    let align;
    if (sideOut) {
        const sgn = dx < 0 ? -1 : 1;
        ax = sgn < 0 ? size * 1.2 : w - size * 1.2;
        ay = view.horizonY;
        angle = sgn < 0 ? Math.PI : 0;
        tx = sgn < 0 ? ax + size * 1.15 : ax - size * 1.15;
        ty = ay - size * 0.2;
        align = sgn < 0 ? 'left' : 'right';
    } else {
        ax = w / 2;
        ay = Math.max(76, unit * 0.14) + size;
        angle = -Math.PI / 2;
        tx = ax + size * 1.3;
        ty = ay;
        align = 'left';
    }

    arrowPath(ctx, ax, ay, size, angle);
    ctx.stroke();
    ctx.fill();
    if (sideOut) foxMarker(ctx, ax, ay + size * 1.45, size * 0.42);
    else foxMarker(ctx, ax - size * 1.5, ay, size * 0.42);

    ctx.font = '800 ' + fs + 'px system-ui, -apple-system, sans-serif';
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    // Exclamation marks as well as the colour: none, one from half the limit, two in the last second.
    const marks = left <= 1 ? '!!' : lost >= limit / 2 ? '!' : '';
    const label = left.toFixed(1) + marks;
    ctx.strokeText(label, tx, ty);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, tx, ty);
}
