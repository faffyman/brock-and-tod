// Brock & Tod cockpit: mountain bike handlebars and two badger paws.
// Drawn in screen space over the scene. Geometry is written in local units
// where 1 unit is half the bar width, then scaled to the view.

import { CONFIG } from '../config.js';

const STEER_ROT = 0.25;
const GRIP_X = 0.62;

// Bar height at a given local x: a slight rise towards the ends.
function barY(x) {
    const t = x / 0.78;
    return 0.03 - 0.10 * t * t;
}

function drawTyre(ctx) {
    // Top of the front tyre peeking out below the stem.
    ctx.fillStyle = '#16181a';
    ctx.beginPath();
    ctx.moveTo(-0.13, 0.62);
    ctx.lineTo(-0.115, 0.3);
    ctx.quadraticCurveTo(0, 0.22, 0.115, 0.3);
    ctx.lineTo(0.13, 0.62);
    ctx.closePath();
    ctx.fill();
    // Tread blocks.
    ctx.fillStyle = '#2b2f33';
    for (let i = 0; i < 4; i++) {
        const y = 0.33 + i * 0.07;
        const half = 0.095 + i * 0.008;
        ctx.fillRect(-half, y, half * 0.55, 0.035);
        ctx.fillRect(half * 0.45, y + 0.03, half * 0.55, 0.035);
    }
    // Fork crown.
    ctx.fillStyle = '#4a5157';
    ctx.beginPath();
    ctx.moveTo(-0.15, 0.2);
    ctx.lineTo(0.15, 0.2);
    ctx.lineTo(0.12, 0.3);
    ctx.lineTo(-0.12, 0.3);
    ctx.closePath();
    ctx.fill();
}

function drawStemAndBar(ctx) {
    // Stem.
    ctx.fillStyle = '#3b4248';
    ctx.beginPath();
    ctx.moveTo(-0.075, -0.03);
    ctx.lineTo(0.075, -0.03);
    ctx.lineTo(0.055, 0.22);
    ctx.lineTo(-0.055, 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#6b747b';
    ctx.fillRect(-0.075, -0.035, 0.15, 0.03);

    // Bar tube with a highlight line.
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#23282c';
    ctx.lineWidth = 0.052;
    ctx.beginPath();
    ctx.moveTo(-0.8, -0.07);
    ctx.quadraticCurveTo(0, 0.13, 0.8, -0.07);
    ctx.stroke();
    ctx.strokeStyle = '#59636a';
    ctx.lineWidth = 0.014;
    ctx.beginPath();
    ctx.moveTo(-0.78, -0.088);
    ctx.quadraticCurveTo(0, 0.112, 0.78, -0.088);
    ctx.stroke();
}

// One side drawn for the right hand, mirrored by the caller for the left.
function drawGripAndLever(ctx) {
    // Brake lever blade, sweeping inward and forward of the grip.
    const gx = 0.47;
    const gy = barY(gx);
    ctx.strokeStyle = '#8f979d';
    ctx.lineWidth = 0.028;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(gx + 0.02, gy - 0.02);
    ctx.quadraticCurveTo(gx - 0.11, gy - 0.1, gx - 0.2, gy - 0.075);
    ctx.stroke();
    // Lever clamp.
    ctx.fillStyle = '#2c3237';
    ctx.fillRect(gx - 0.005, gy - 0.05, 0.07, 0.06);

    // Rubber grip with a pale end cap.
    ctx.strokeStyle = '#101214';
    ctx.lineWidth = 0.098;
    ctx.beginPath();
    ctx.moveTo(0.5, barY(0.5));
    ctx.lineTo(0.77, barY(0.77));
    ctx.stroke();
    ctx.strokeStyle = '#2a2e32';
    ctx.lineWidth = 0.02;
    ctx.beginPath();
    ctx.moveTo(0.52, barY(0.52) - 0.026);
    ctx.lineTo(0.76, barY(0.76) - 0.026);
    ctx.stroke();
    ctx.fillStyle = '#9aa2a8';
    ctx.beginPath();
    ctx.arc(0.795, barY(0.795), 0.03, 0, Math.PI * 2);
    ctx.fill();
}

function drawForearm(ctx) {
    // Lighter grey forearm fur running down and out to the screen corner.
    const gy = barY(GRIP_X);
    ctx.fillStyle = '#8d9197';
    ctx.beginPath();
    ctx.moveTo(GRIP_X - 0.13, gy + 0.05);
    ctx.lineTo(GRIP_X + 0.13, gy + 0.05);
    ctx.quadraticCurveTo(GRIP_X + 0.3, gy + 0.5, GRIP_X + 0.42, 1.1);
    ctx.lineTo(GRIP_X - 0.34, 1.1);
    ctx.quadraticCurveTo(GRIP_X - 0.2, gy + 0.5, GRIP_X - 0.13, gy + 0.05);
    ctx.closePath();
    ctx.fill();
    // Darker band towards the paw so the colour change reads as fur.
    ctx.fillStyle = '#4d5055';
    ctx.beginPath();
    ctx.moveTo(GRIP_X - 0.13, gy + 0.05);
    ctx.lineTo(GRIP_X + 0.13, gy + 0.05);
    ctx.lineTo(GRIP_X + 0.16, gy + 0.22);
    ctx.quadraticCurveTo(GRIP_X, gy + 0.3, GRIP_X - 0.17, gy + 0.22);
    ctx.closePath();
    ctx.fill();
    // Fur tufts.
    ctx.strokeStyle = '#c3c7cb';
    ctx.lineWidth = 0.012;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
        const t = 0.3 + i * 0.1;
        const x = GRIP_X - 0.2 + (i % 3) * 0.17 + t * 0.12;
        const y = gy + t * 0.9;
        ctx.moveTo(x, y);
        ctx.lineTo(x + 0.025, y + 0.06);
    }
    ctx.stroke();
}

function drawPaw(ctx) {
    const gx = GRIP_X;
    const gy = barY(GRIP_X);

    // Main mound of dark fur, sitting on the grip.
    ctx.fillStyle = '#17181b';
    ctx.beginPath();
    ctx.ellipse(gx, gy + 0.005, 0.15, 0.115, 0.08, 0, Math.PI * 2);
    ctx.fill();
    // Wrist taper into the forearm.
    ctx.beginPath();
    ctx.moveTo(gx - 0.12, gy + 0.03);
    ctx.lineTo(gx + 0.12, gy + 0.03);
    ctx.lineTo(gx + 0.1, gy + 0.2);
    ctx.lineTo(gx - 0.1, gy + 0.2);
    ctx.closePath();
    ctx.fill();

    // Stubby toes curling over the grip, with a soft lighter rim.
    const toeY = gy - 0.095;
    for (let i = 0; i < 4; i++) {
        const tx = gx - 0.105 + i * 0.07;
        const ty = toeY + (i === 0 || i === 3 ? 0.018 : 0);
        ctx.fillStyle = '#25272b';
        ctx.beginPath();
        ctx.ellipse(tx, ty, 0.04, 0.05, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#34373c';
        ctx.beginPath();
        ctx.ellipse(tx - 0.008, ty - 0.012, 0.022, 0.028, 0, 0, Math.PI * 2);
        ctx.fill();
        // Pale claw tip.
        ctx.fillStyle = '#efe7d2';
        ctx.beginPath();
        ctx.moveTo(tx - 0.022, ty - 0.036);
        ctx.quadraticCurveTo(tx, ty - 0.1, tx + 0.024, ty - 0.034);
        ctx.quadraticCurveTo(tx, ty - 0.05, tx - 0.022, ty - 0.036);
        ctx.closePath();
        ctx.fill();
    }

    // A few light fur strokes on the back of the paw.
    ctx.strokeStyle = '#5b5f66';
    ctx.lineWidth = 0.012;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
        const x = gx - 0.07 + i * 0.05;
        ctx.moveTo(x, gy + 0.0);
        ctx.lineTo(x + 0.008, gy + 0.06);
    }
    ctx.stroke();
}

export function drawCockpit(ctx, state, view) {
    const w = view.w;
    const h = view.h;

    // Size: capped by screen width, by view.h (landscape) and by the height share.
    const barW = Math.min(w * 0.96, h * 1.25);
    const half = Math.min(barW / 2, (h * 0.29) / 0.82);

    const steer = state.player.steer;
    // Reduce motion: no bob, shake, bounce twist or landing bump. Steering still
    // turns the bars at their normal angle.
    const calm = !!state.reduceMotion;
    let dx = steer * half * 0.07;
    let dy = 0;
    let extraRot = 0;

    if (!calm) {
        if (state.mode === 'riding' && !((state.player.y || 0) > 0)) {
            const speedK = Math.min(1, state.player.speed / CONFIG.maxSpeed);
            const ph = state.distance * 0.3;
            const amp = half * (0.006 + 0.012 * speedK);
            dy = Math.sin(ph) * amp + Math.sin(ph * 2.3 + 1) * amp * 0.35;
            dx += Math.sin(ph * 0.5) * amp * 0.3;
        } else if (state.mode === 'crashed') {
            const t = state.time - state.crashTime;
            if (t >= 0 && t < 0.5) {
                const k = Math.exp(-t * 7);
                dy = -Math.sin(t * 38) * k * half * 0.08;
                dx += Math.sin(t * 52) * k * half * 0.03;
                extraRot = Math.sin(t * 44) * k * 0.05;
            }
        }

        // Bounce: bars jolt sideways towards bounceDir and twist, then settle.
        if (state.mode === 'riding' && state.bounceTime && state.bounceDir) {
            const bt = state.time - state.bounceTime;
            if (bt >= 0 && bt < 0.3) {
                const u = 1 - bt / 0.3;
                const k = u * u * Math.cos(bt * 9);
                dx += state.bounceDir * half * 0.16 * k;
                extraRot += state.bounceDir * 0.11 * k;
                dy += Math.abs(k) * half * 0.03;
            }
        }
    }

    // Air: bars lift and tip up with height. Landing: short downward bump.
    // Reduce motion keeps only a small offset that follows the height, no pitch.
    const py = state.player.y || 0;
    let pitch = 0;
    if (py > 0) {
        const k = Math.min(1, py / 1.5);
        if (calm) {
            dy = -half * 0.03 * k;
        } else {
            dy = -half * 0.12 * k;
            pitch = 0.07 * k;
        }
    }
    if (!calm && state.landTime !== undefined && state.mode !== 'paused') {
        const lt = state.time - state.landTime;
        if (lt >= 0 && lt < 0.25) dy += Math.sin((lt / 0.25) * Math.PI) * half * 0.08;
    }

    // Lost: bars settle level.
    let rotSteer = steer;
    if (state.mode === 'lost') {
        rotSteer = steer * Math.max(0, 1 - (state.time - state.crashTime) / 0.4);
        dx = rotSteer * half * 0.07;
    }

    ctx.save();
    ctx.translate(w / 2 + dx, h - half * 0.5 + dy);
    ctx.rotate(rotSteer * STEER_ROT + extraRot);
    ctx.scale(half, half * (1 + pitch));

    drawTyre(ctx);

    // Right side, then mirrored left side.
    for (let side = 1; side >= -1; side -= 2) {
        ctx.save();
        ctx.scale(side, 1);
        drawForearm(ctx);
        ctx.restore();
    }

    drawStemAndBar(ctx);

    for (let side = 1; side >= -1; side -= 2) {
        ctx.save();
        ctx.scale(side, 1);
        drawGripAndLever(ctx);
        drawPaw(ctx);
        ctx.restore();
    }

    ctx.restore();
}
