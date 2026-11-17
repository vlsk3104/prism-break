// Everything the player sees: the neon field, bricks with their damage
// cracks, the paddle and balls with trails, falling powerups, particles,
// floating score text, the HUD, and the title / pause / game-over /
// victory screens. The renderer only reads world state; it never changes
// it, and the world never knows it exists.

import { BALL, BRICKS, COLORS, FIELD, FONT, PADDLE, POWERUPS } from './config.js';
import { createRandom } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const POWERUP_STYLE = {
  multi: { label: 'M', color: '#3dc8ff' },
  laser: { label: 'L', color: '#ff4d6d' },
  wide: { label: 'W', color: '#3dff8a' },
  slow: { label: 'S', color: '#b48cff' },
  life: { label: '+', color: '#ff5c8a' },
};

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  // A fixed starfield, seeded so every visit (and every screenshot) agrees.
  const starRandom = createRandom(20261117);
  const stars = [];
  for (let i = 0; i < 110; i += 1) {
    stars.push({ x: starRandom() * FIELD.width, y: starRandom() * FIELD.height, r: starRandom() * 1.6 + 0.4, a: 0.25 + starRandom() * 0.6 });
  }
  let frame = 0;

  function drawBackground(state) {
    const grad = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    grad.addColorStop(0, COLORS.bgTop);
    grad.addColorStop(1, COLORS.bgBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    for (const star of stars) {
      ctx.globalAlpha = star.a * (0.75 + 0.25 * Math.sin(frame * 0.02 + star.x));
      ctx.fillStyle = '#cfe4ff';
      ctx.fillRect(star.x, star.y, star.r, star.r);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 64; x < FIELD.width; x += 64) { ctx.moveTo(x, 0); ctx.lineTo(x, FIELD.height); }
    for (let y = 60; y < FIELD.height; y += 60) { ctx.moveTo(0, y); ctx.lineTo(FIELD.width, y); }
    ctx.stroke();
    // Side walls and the top rail glow faintly so the arena reads as one box.
    ctx.fillStyle = 'rgba(55,244,255,0.20)';
    ctx.fillRect(0, 0, 3, FIELD.height);
    ctx.fillRect(FIELD.width - 3, 0, 3, FIELD.height);
    ctx.fillRect(0, 0, FIELD.width, 3);
    void state;
  }

  function drawBrick(brick) {
    const { x, y, w, h } = brick;
    ctx.save();
    if (brick.kind === 'steel') {
      ctx.fillStyle = COLORS.steel;
      roundRect(ctx, x, y, w, h, 5);
      ctx.fill();
      ctx.strokeStyle = 'rgba(230,240,255,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 6, y + h - 6);
      ctx.lineTo(x + w - 6, y + 6);
      ctx.moveTo(x + 6, y + 6);
      ctx.lineTo(x + w - 6, y + h - 6);
      ctx.stroke();
    } else {
      const pulse = brick.kind === 'explosive' ? 10 + 6 * Math.sin(frame * 0.12 + brick.col) : 8;
      ctx.shadowColor = brick.color;
      ctx.shadowBlur = pulse;
      ctx.fillStyle = brick.color;
      roundRect(ctx, x, y, w, h, 5);
      ctx.fill();
      ctx.shadowBlur = 0;
      // A glassy top edge sells the prism look.
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      roundRect(ctx, x + 3, y + 3, w - 6, 6, 3);
      ctx.fill();
      if (brick.kind === 'armored') {
        ctx.strokeStyle = COLORS.armored;
        ctx.lineWidth = 2;
        roundRect(ctx, x + 1, y + 1, w - 2, h - 2, 5);
        ctx.stroke();
        ctx.fillStyle = 'rgba(10,14,30,0.35)';
        const shade = 1 - brick.hp / brick.maxHp;
        ctx.fillRect(x + 3, y + h - 5, (w - 6) * shade, 2);
        if (brick.hp < brick.maxHp) {
          // Cracks: branching hairlines whose shape is fixed per brick, so
          // a damaged brick keeps the same cracks frame after frame. The
          // second hit adds a second branch and a small spur.
          ctx.strokeStyle = 'rgba(240,248,255,0.65)';
          ctx.lineWidth = 1.1;
          const seed = (brick.col * 7 + brick.row * 13) % 5;
          const jx = (n) => ((seed * 31 + n * 17) % 9) - 4;
          ctx.beginPath();
          ctx.moveTo(x + w * 0.22 + jx(1), y + 2);
          ctx.lineTo(x + w * 0.40 + jx(2), y + h * 0.45);
          ctx.lineTo(x + w * 0.34 + jx(3), y + h - 3);
          ctx.moveTo(x + w * 0.40 + jx(2), y + h * 0.45);
          ctx.lineTo(x + w * 0.58 + jx(4), y + h * 0.62);
          if (brick.maxHp - brick.hp >= 2) {
            ctx.moveTo(x + w * 0.78 + jx(5), y + 2);
            ctx.lineTo(x + w * 0.64 + jx(6), y + h * 0.5);
            ctx.lineTo(x + w * 0.72 + jx(7), y + h - 3);
            ctx.moveTo(x + w * 0.64 + jx(6), y + h * 0.5);
            ctx.lineTo(x + w * 0.50 + jx(8), y + h * 0.7);
          }
          ctx.stroke();
        }
      }
      if (brick.kind === 'explosive') {
        ctx.fillStyle = '#fff3d6';
        ctx.beginPath();
        ctx.arc(x + w / 2, y + h / 2, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,243,214,0.8)';
        ctx.beginPath();
        ctx.arc(x + w / 2, y + h / 2, 8 + 2 * Math.sin(frame * 0.12 + brick.col), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    if (brick.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.85, brick.flash * 9)})`;
      roundRect(ctx, x, y, w, h, 5);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPaddle(state) {
    const paddle = state.paddle;
    const x = paddle.x - paddle.w / 2;
    ctx.save();
    const laserOn = state.laserT > 0;
    ctx.shadowColor = laserOn ? COLORS.paddleLaser : COLORS.paddle;
    ctx.shadowBlur = 16;
    const grad = ctx.createLinearGradient(x, PADDLE.y, x, PADDLE.y + PADDLE.height);
    grad.addColorStop(0, '#d9fbff');
    grad.addColorStop(0.35, laserOn ? '#ff8fa5' : '#37f4ff');
    grad.addColorStop(1, laserOn ? '#c21847' : '#0e7d99');
    ctx.fillStyle = grad;
    roundRect(ctx, x, PADDLE.y, paddle.w, PADDLE.height, 7);
    ctx.fill();
    ctx.shadowBlur = 0;
    if (laserOn) {
      ctx.fillStyle = '#ffd7de';
      const half = paddle.w / 2 - 8;
      roundRect(ctx, paddle.x - half - 4, PADDLE.y - 10, 8, 10, 3);
      ctx.fill();
      roundRect(ctx, paddle.x + half - 4, PADDLE.y - 10, 8, 10, 3);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBalls(state) {
    for (const ball of state.balls) {
      ctx.save();
      for (let i = 0; i < ball.trail.length; i += 1) {
        const t = ball.trail[i];
        const f = (i + 1) / ball.trail.length;
        ctx.globalAlpha = f * 0.30;
        ctx.fillStyle = '#37f4ff';
        ctx.beginPath();
        ctx.arc(t.x, t.y, BALL.radius * f, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowColor = '#aef7ff';
      ctx.shadowBlur = 18;
      ctx.fillStyle = COLORS.ball;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawPowerupsAndBolts(state) {
    for (const bolt of state.bolts) {
      ctx.save();
      ctx.shadowColor = '#ff4d6d';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#ff8fa5';
      roundRect(ctx, bolt.x - 2.5, bolt.y - 11, 5, 14, 2.5);
      ctx.fill();
      ctx.restore();
    }
    for (const drop of state.powerups) {
      const style = POWERUP_STYLE[drop.type];
      ctx.save();
      ctx.shadowColor = style.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = 'rgba(8,12,28,0.92)';
      roundRect(ctx, drop.x - POWERUPS.width / 2, drop.y - POWERUPS.height / 2, POWERUPS.width, POWERUPS.height, 8);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = style.color;
      ctx.lineWidth = 1.6;
      roundRect(ctx, drop.x - POWERUPS.width / 2, drop.y - POWERUPS.height / 2, POWERUPS.width, POWERUPS.height, 8);
      ctx.stroke();
      ctx.fillStyle = style.color;
      ctx.font = `700 13px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(style.label, drop.x, drop.y + 0.5);
      ctx.restore();
    }
  }

  function drawFx(state) {
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.font = `700 17px ${FONT}`;
    ctx.textAlign = 'center';
    for (const f of state.floaters) {
      ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawHud(state, best, muted) {
    ctx.save();
    ctx.font = `700 21px ${FONT}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.muted;
    ctx.fillText('SCORE', 22, 26);
    ctx.fillStyle = COLORS.text;
    ctx.fillText(String(state.score).padStart(6, '0'), 104, 26);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(`LEVEL ${state.levelIndex + 1} / 6`, FIELD.width / 2 - 90, 26);
    ctx.fillStyle = COLORS.text;
    ctx.fillText(state.levelName.toUpperCase(), FIELD.width / 2 + 92, 26);
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.muted;
    ctx.fillText('BEST', FIELD.width - 168, 26);
    ctx.fillStyle = COLORS.text;
    ctx.fillText(String(Math.max(best, state.score)).padStart(6, '0'), FIELD.width - 22, 26);
    // Lives as glowing orbs under the score.
    for (let i = 0; i < state.lives; i += 1) {
      ctx.shadowColor = '#ff5c8a';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#ff5c8a';
      ctx.beginPath();
      ctx.arc(34 + i * 24, 56, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    if (state.combo >= 2) {
      ctx.textAlign = 'left';
      ctx.fillStyle = COLORS.combo;
      ctx.font = `800 20px ${FONT}`;
      ctx.fillText(`COMBO x${state.combo}`, 128, 56);
    }
    // Active power timers as draining pills along the bottom-left.
    const pills = [];
    if (state.laserT > 0) pills.push(['LASER', state.laserT / POWERUPS.laserSeconds, '#ff4d6d']);
    if (state.wideT > 0) pills.push(['WIDE', state.wideT / POWERUPS.wideSeconds, '#3dff8a']);
    if (state.slowT > 0) pills.push(['SLOW', state.slowT / POWERUPS.slowSeconds, '#b48cff']);
    ctx.textAlign = 'left';
    pills.forEach(([label, frac, color], i) => {
      const x = 22 + i * 128;
      const y = FIELD.height - 26;
      ctx.fillStyle = 'rgba(10,14,30,0.8)';
      roundRect(ctx, x, y, 116, 14, 7);
      ctx.fill();
      ctx.fillStyle = color;
      roundRect(ctx, x, y, 116 * Math.min(1, Math.max(0, frac)), 14, 7);
      ctx.fill();
      // The label sits on top in bright text so it stays readable however
      // much of the bar is left.
      ctx.fillStyle = '#eef4ff';
      ctx.font = `800 10px ${FONT}`;
      ctx.fillText(label, x + 7, y + 7.5);
    });
    if (muted) {
      ctx.textAlign = 'right';
      ctx.fillStyle = COLORS.muted;
      ctx.font = `600 13px ${FONT}`;
      ctx.fillText('MUTED (M)', FIELD.width - 22, FIELD.height - 19);
    }
    ctx.restore();
  }

  function veil(alpha) {
    ctx.fillStyle = `rgba(4,5,16,${alpha})`;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function statsBlock(state, best) {
    const rows = [
      ['SCORE', String(state.score)],
      ['TIME', formatTime(state.elapsed)],
      ['MAX COMBO', `x${state.maxCombo}`],
      ['BRICKS BROKEN', String(state.bricksBroken)],
      ['BEST', String(Math.max(best, state.score))],
    ];
    ctx.font = `600 21px ${FONT}`;
    rows.forEach(([label, value], i) => {
      const y = 408 + i * 34;
      ctx.textAlign = 'right';
      ctx.fillStyle = COLORS.muted;
      ctx.fillText(label, FIELD.width / 2 - 24, y);
      ctx.textAlign = 'left';
      ctx.fillStyle = COLORS.text;
      ctx.fillText(value, FIELD.width / 2 + 24, y);
    });
  }

  function drawOverlay(state, screen, best) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (screen === SCREEN_TITLE) {
      veil(0.58);
      const grad = ctx.createLinearGradient(0, 190, 0, 300);
      grad.addColorStop(0, '#7df9ff');
      grad.addColorStop(0.5, '#37f4ff');
      grad.addColorStop(1, '#ff3dd8');
      ctx.shadowColor = '#37f4ff';
      ctx.shadowBlur = 34;
      ctx.fillStyle = grad;
      ctx.font = `900 92px ${FONT}`;
      ctx.fillText('PRISM BREAK', FIELD.width / 2, 238);
      ctx.shadowBlur = 0;
      ctx.fillStyle = COLORS.text;
      ctx.font = `600 23px ${FONT}`;
      ctx.fillText('Shatter six neon walls. Chain the explosions. Do not drop the light.', FIELD.width / 2, 318);
      ctx.fillStyle = COLORS.muted;
      ctx.font = `500 19px ${FONT}`;
      ctx.fillText('Move: mouse or ← → / A D      Launch & laser: click or Space', FIELD.width / 2, 386);
      ctx.fillText('Powerups:  M multi-ball · L laser · W wide · S slow-time · + extra life', FIELD.width / 2, 420);
      ctx.fillText('Pause: P or Esc      Mute: M', FIELD.width / 2, 454);
      if (Math.sin(frame * 0.06) > -0.25) {
        ctx.fillStyle = COLORS.accent;
        ctx.font = `800 26px ${FONT}`;
        ctx.fillText('CLICK OR PRESS SPACE TO PLAY', FIELD.width / 2, 528);
      }
      if (best > 0) {
        ctx.fillStyle = COLORS.combo;
        ctx.font = `700 19px ${FONT}`;
        ctx.fillText(`BEST SCORE  ${best}`, FIELD.width / 2, 580);
      }
    } else if (screen === SCREEN_PAUSED) {
      veil(0.55);
      ctx.fillStyle = COLORS.text;
      ctx.font = `900 64px ${FONT}`;
      ctx.fillText('PAUSED', FIELD.width / 2, 320);
      ctx.fillStyle = COLORS.muted;
      ctx.font = `600 21px ${FONT}`;
      ctx.fillText('Press P, Esc or Space to resume', FIELD.width / 2, 386);
    } else if (screen === SCREEN_OVER) {
      veil(0.68);
      ctx.shadowColor = '#ff4d6d';
      ctx.shadowBlur = 30;
      ctx.fillStyle = '#ff6b87';
      ctx.font = `900 76px ${FONT}`;
      ctx.fillText('GAME OVER', FIELD.width / 2, 218);
      ctx.shadowBlur = 0;
      ctx.fillStyle = COLORS.muted;
      ctx.font = `600 21px ${FONT}`;
      ctx.fillText(`The wall held — you reached level ${state.levelIndex + 1} of 6.`, FIELD.width / 2, 282);
      statsBlock(state, best);
      ctx.fillStyle = COLORS.accent;
      ctx.font = `800 24px ${FONT}`;
      ctx.fillText('PRESS SPACE OR CLICK TO TRY AGAIN', FIELD.width / 2, 616);
    } else if (screen === SCREEN_WIN) {
      veil(0.62);
      ctx.shadowColor = '#ffd23d';
      ctx.shadowBlur = 30;
      ctx.fillStyle = '#ffd23d';
      ctx.font = `900 76px ${FONT}`;
      ctx.fillText('PRISM SHATTERED!', FIELD.width / 2, 218);
      ctx.shadowBlur = 0;
      ctx.fillStyle = COLORS.muted;
      ctx.font = `600 21px ${FONT}`;
      ctx.fillText('All six walls are down. The light is free.', FIELD.width / 2, 282);
      statsBlock(state, best);
      ctx.fillStyle = COLORS.accent;
      ctx.font = `800 24px ${FONT}`;
      ctx.fillText('PRESS SPACE OR CLICK TO PLAY AGAIN', FIELD.width / 2, 616);
    }
    ctx.restore();
  }

  function drawCenterNotes(state, screen) {
    if (screen !== SCREEN_PLAY) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (state.phase === 'clear') {
      ctx.shadowColor = '#3dff8a';
      ctx.shadowBlur = 24;
      ctx.fillStyle = '#3dff8a';
      ctx.font = `900 54px ${FONT}`;
      ctx.fillText('LEVEL CLEAR!', FIELD.width / 2, 330);
      ctx.shadowBlur = 0;
    } else if (state.messageT > 0) {
      const alpha = Math.min(1, state.messageT / 0.6);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = COLORS.text;
      ctx.font = `800 34px ${FONT}`;
      ctx.fillText(`LEVEL ${state.levelIndex + 1} — ${state.levelName.toUpperCase()}`, FIELD.width / 2, 306);
      ctx.fillStyle = COLORS.muted;
      ctx.font = `500 19px ${FONT}`;
      ctx.fillText(state.levelHint, FIELD.width / 2, 342);
      ctx.globalAlpha = 1;
    }
    if (state.phase === 'ready' && state.messageT <= 0 && Math.sin(frame * 0.07) > -0.3) {
      ctx.fillStyle = COLORS.accent;
      ctx.font = `700 20px ${FONT}`;
      ctx.fillText('CLICK OR SPACE TO LAUNCH', FIELD.width / 2, PADDLE.y - 54);
    }
    ctx.restore();
  }

  function draw(state, screen, best, muted) {
    frame += 1;
    ctx.save();
    if (state.shake > 0.2) {
      const dx = (Math.sin(frame * 39.7) + Math.sin(frame * 17.3)) * state.shake * 0.5;
      const dy = (Math.cos(frame * 33.1) + Math.sin(frame * 23.9)) * state.shake * 0.4;
      ctx.translate(dx, dy);
    }
    drawBackground(state);
    for (const brick of state.bricks) if (brick.active) drawBrick(brick);
    drawPowerupsAndBolts(state);
    drawPaddle(state);
    drawBalls(state);
    drawFx(state);
    ctx.restore();
    drawHud(state, best, muted);
    drawCenterNotes(state, screen);
    if (screen !== SCREEN_PLAY) drawOverlay(state, screen, best);
  }

  return { draw };
}
