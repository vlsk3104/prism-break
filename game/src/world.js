// Prism Break's rules and state, with no drawing and no browser in it, so
// the exact same simulation runs in the page, in the screenshot scenes and
// headless in Node for validation. step() advances one fixed step, moves
// the paddle from the caller's control, flies the balls, resolves every
// collision, and returns what happened as bit flags so the caller can play
// sounds without the world knowing about audio or screens.

import { BALL, BRICKS, COLORS, FIELD, FX, LIVES, PADDLE, POWERUPS, ROW_COLORS, SCORE } from './config.js';
import { BRICK_TYPES, LEVELS } from './levels.js';

export const EV_BOUNCE = 1;
export const EV_PADDLE = 2;
export const EV_HIT = 4;
export const EV_BREAK = 8;
export const EV_EXPLODE = 16;
export const EV_POWER = 32;
export const EV_LOSE = 64;
export const EV_CLEAR = 128;
export const EV_WIN = 256;
export const EV_OVER = 512;
export const EV_LASER = 1024;
export const EV_ARMOR_BREAK = 2048;

export const PHASE_READY = 'ready';
export const PHASE_PLAYING = 'playing';
export const PHASE_CLEAR = 'clear';
export const PHASE_OVER = 'over';
export const PHASE_WIN = 'win';

const POWERUP_KINDS = ['multi', 'laser', 'wide', 'slow', 'life'];
const POWERUP_LABELS = { multi: 'MULTI BALL!', laser: 'LASER!', wide: 'WIDE!', slow: 'SLOW TIME!', life: 'EXTRA LIFE!' };

function clamp(value, lo, hi) {
  return value < lo ? lo : value > hi ? hi : value;
}

export function createWorld(random) {
  const paddle = { x: FIELD.width / 2, w: PADDLE.baseWidth, vx: 0 };
  const state = {
    phase: PHASE_READY,
    levelIndex: 0,
    levelName: LEVELS[0].name,
    levelHint: LEVELS[0].hint,
    score: 0,
    lives: LIVES,
    combo: 0,
    maxCombo: 0,
    bricksBroken: 0,
    elapsed: 0,
    levelTime: 0,
    messageT: 0,
    clearT: 0,
    hitStop: 0,
    shake: 0,
    slowT: 0,
    laserT: 0,
    wideT: 0,
    laserCd: 0,
    breakableLeft: 0,
    lastPower: '',
    paddle,
    balls: [],
    bricks: [],
    powerups: [],
    bolts: [],
    particles: [],
    floaters: [],
  };

  function brickRect(col, row) {
    return {
      x: BRICKS.left + col * (BRICKS.width + BRICKS.gap),
      y: BRICKS.top + row * (BRICKS.height + BRICKS.gap),
      w: BRICKS.width,
      h: BRICKS.height,
    };
  }

  function makeBall(x, y, angle, speed) {
    return { x, y, vx: Math.sin(angle) * speed, vy: -Math.cos(angle) * speed, speed, baseSpeed: speed, stuck: false, trail: [] };
  }

  function serveBall() {
    const ball = makeBall(paddle.x, PADDLE.y - BALL.radius - 1, 0, levelBallSpeed());
    ball.stuck = true;
    state.balls = [ball];
  }

  function levelBallSpeed() {
    return BALL.baseSpeed + BALL.speedPerLevel * state.levelIndex;
  }

  function startLevel(index) {
    state.levelIndex = index;
    const level = LEVELS[index];
    state.levelName = level.name;
    state.levelHint = level.hint;
    state.bricks = [];
    state.breakableLeft = 0;
    level.rows.forEach((rowText, row) => {
      [...rowText].forEach((ch, col) => {
        const type = BRICK_TYPES[ch];
        if (!type) return;
        const rect = brickRect(col, row);
        state.bricks.push({
          ...rect, col, row, kind: type.kind, hp: type.hp, maxHp: type.hp,
          active: true, flash: 0, color: ROW_COLORS[row % ROW_COLORS.length],
        });
        if (type.kind !== 'steel') state.breakableLeft += 1;
      });
    });
    state.powerups = [];
    state.bolts = [];
    state.levelTime = 0;
    state.messageT = 2.4;
    paddle.x = FIELD.width / 2;
    paddle.vx = 0;
    serveBall();
    state.phase = PHASE_READY;
  }

  function reset() {
    state.score = 0;
    state.lives = LIVES;
    state.combo = 0;
    state.maxCombo = 0;
    state.bricksBroken = 0;
    state.elapsed = 0;
    state.hitStop = 0;
    state.shake = 0;
    state.slowT = 0;
    state.laserT = 0;
    state.wideT = 0;
    state.laserCd = 0;
    state.particles = [];
    state.floaters = [];
    startLevel(0);
  }

  function launch() {
    if (state.phase !== PHASE_READY) return 0;
    let events = 0;
    for (const ball of state.balls) {
      if (!ball.stuck) continue;
      const angle = (random() - 0.5) * 0.5;
      ball.vx = Math.sin(angle) * ball.speed;
      ball.vy = -Math.cos(angle) * ball.speed;
      ball.stuck = false;
    }
    state.phase = PHASE_PLAYING;
    return events;
  }

  function burst(x, y, color, count, power) {
    for (let i = 0; i < count; i += 1) {
      if (state.particles.length >= FX.particleCap) return;
      const a = random() * Math.PI * 2;
      const sp = (40 + random() * 190) * power;
      state.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        life: 0.45 + random() * 0.5, maxLife: 0.95, color,
        size: 2 + random() * 3.5,
      });
    }
  }

  function addFloater(x, y, text, color) {
    if (state.floaters.length >= FX.floaterCap) state.floaters.shift();
    state.floaters.push({ x, y, text, color, life: 0.95, maxLife: 0.95 });
  }

  function rollPowerupType() {
    const roll = random();
    if (roll < 0.07) return 'life';
    if (roll < 0.33) return 'multi';
    if (roll < 0.58) return 'laser';
    if (roll < 0.82) return 'wide';
    return 'slow';
  }

  function maybeDrop(brick) {
    if (random() >= POWERUPS.dropChance) return;
    state.powerups.push({
      x: brick.x + brick.w / 2, y: brick.y + brick.h / 2,
      type: rollPowerupType(), active: true,
    });
  }

  function breakBrick(brick, events) {
    brick.active = false;
    state.breakableLeft -= 1;
    state.bricksBroken += 1;
    state.combo += 1;
    if (state.combo > state.maxCombo) state.maxCombo = state.combo;
    const base = brick.kind === 'armored' ? SCORE.armored : brick.kind === 'explosive' ? SCORE.explosive : SCORE.normal;
    const gained = base + SCORE.comboStep * (state.combo - 1);
    state.score += gained;
    addFloater(brick.x + brick.w / 2, brick.y, `+${gained}`, brick.kind === 'explosive' ? COLORS.explosive || '#ff9f1c' : brick.color);
    burst(brick.x + brick.w / 2, brick.y + brick.h / 2, brick.color, brick.kind === 'explosive' ? 22 : 12, brick.kind === 'explosive' ? 1.5 : 1);
    if (brick.kind === 'armored') {
      state.hitStop = FX.hitStopSeconds;
      events |= EV_ARMOR_BREAK;
    }
    if (brick.kind === 'explosive') {
      events |= EV_EXPLODE;
      state.shake = Math.min(15, state.shake + FX.shakeOnExplosion);
      events = detonateNeighbours(brick, events);
    } else {
      events |= EV_BREAK;
    }
    maybeDrop(brick);
    return events;
  }

  function detonateNeighbours(source, events) {
    const queue = [source];
    const seen = new Set([source]);
    while (queue.length > 0) {
      const current = queue.shift();
      for (const other of state.bricks) {
        if (!other.active || seen.has(other) || other.kind === 'steel') continue;
        if (Math.abs(other.col - current.col) <= 1 && Math.abs(other.row - current.row) <= 1) {
          seen.add(other);
          other.hp -= 2;
          other.flash = 0.09;
          if (other.hp <= 0) {
            if (other.kind === 'explosive') queue.push(other);
            events = breakBrickSilent(other, events, queue, seen);
          }
        }
      }
    }
    return events;
  }

  // Breaking a brick from inside a chain: like breakBrick, but any new
  // explosive joins the chain queue instead of recursing on its own.
  function breakBrickSilent(brick, events, queue, seen) {
    brick.active = false;
    state.breakableLeft -= 1;
    state.bricksBroken += 1;
    state.combo += 1;
    if (state.combo > state.maxCombo) state.maxCombo = state.combo;
    const base = brick.kind === 'armored' ? SCORE.armored : brick.kind === 'explosive' ? SCORE.explosive : SCORE.normal;
    const gained = base + SCORE.comboStep * (state.combo - 1);
    state.score += gained;
    addFloater(brick.x + brick.w / 2, brick.y, `+${gained}`, brick.color);
    burst(brick.x + brick.w / 2, brick.y + brick.h / 2, brick.color, 14, 1.3);
    events |= EV_BREAK;
    if (brick.kind === 'explosive') {
      events |= EV_EXPLODE;
      state.shake = Math.min(15, state.shake + 4);
    }
    maybeDrop(brick);
    return events;
  }

  function damageBrick(brick, amount, events) {
    if (brick.kind === 'steel') {
      brick.flash = 0.06;
      return events | EV_HIT;
    }
    brick.hp -= amount;
    brick.flash = 0.09;
    if (brick.hp > 0) return events | EV_HIT;
    return breakBrick(brick, events);
  }

  function applyPowerup(type) {
    state.lastPower = type;
    if (type === 'multi') {
      const sources = state.balls.filter((b) => !b.stuck);
      const origin = sources[0];
      if (origin) {
        for (const tilt of [-0.5, 0.5]) {
          if (state.balls.length >= BALL.maxCount) break;
          const speed = origin.speed;
          const baseAngle = Math.atan2(origin.vx, -origin.vy);
          const ball = makeBall(origin.x, origin.y, baseAngle + tilt, speed);
          ball.baseSpeed = origin.baseSpeed;
          state.balls.push(ball);
        }
      } else {
        for (const tilt of [-0.42, 0.42]) {
          const ball = makeBall(paddle.x, PADDLE.y - BALL.radius - 2, tilt, levelBallSpeed());
          state.balls.push(ball);
        }
        state.phase = PHASE_PLAYING;
      }
    } else if (type === 'laser') {
      state.laserT = POWERUPS.laserSeconds;
    } else if (type === 'wide') {
      state.wideT = POWERUPS.wideSeconds;
    } else if (type === 'slow') {
      state.slowT = POWERUPS.slowSeconds;
    } else if (type === 'life') {
      state.lives = Math.min(5, state.lives + 1);
    }
  }

  function fireBolts(events) {
    if (state.laserT <= 0 || state.laserCd > 0 || state.phase !== PHASE_PLAYING) return events;
    state.laserCd = POWERUPS.laserCooldown;
    const half = paddle.w / 2 - 8;
    state.bolts.push({ x: paddle.x - half, y: PADDLE.y - 10, active: true });
    state.bolts.push({ x: paddle.x + half, y: PADDLE.y - 10, active: true });
    return events | EV_LASER;
  }

  function updateFx(dt) {
    for (const p of state.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 340 * dt;
    }
    state.particles = state.particles.filter((p) => p.life > 0);
    for (const f of state.floaters) {
      f.life -= dt;
      f.y -= 44 * dt;
    }
    state.floaters = state.floaters.filter((f) => f.life > 0);
    for (const brick of state.bricks) if (brick.flash > 0) brick.flash -= dt;
    state.shake = Math.max(0, state.shake - FX.shakeDecay * dt);
  }

  function loseBall(ball) {
    state.balls = state.balls.filter((b) => b !== ball);
  }

  function onAllBallsLost(events) {
    state.lives -= 1;
    state.combo = 0;
    state.bolts = [];
    state.powerups = [];
    state.slowT = 0;
    state.laserT = 0;
    state.wideT = 0;
    events |= EV_LOSE;
    if (state.lives <= 0) {
      state.phase = PHASE_OVER;
      events |= EV_OVER;
    } else {
      serveBall();
      state.phase = PHASE_READY;
    }
    return events;
  }

  function collideBricks(ball, events) {
    for (const brick of state.bricks) {
      if (!brick.active) continue;
      const cx = clamp(ball.x, brick.x, brick.x + brick.w);
      const cy = clamp(ball.y, brick.y, brick.y + brick.h);
      const dx = ball.x - cx;
      const dy = ball.y - cy;
      if (dx * dx + dy * dy > BALL.radius * BALL.radius) continue;
      if (Math.abs(dx) > Math.abs(dy)) ball.vx = dx > 0 ? Math.abs(ball.vx) : -Math.abs(ball.vx);
      else ball.vy = dy > 0 ? Math.abs(ball.vy) : -Math.abs(ball.vy);
      // Keep the rebound from going nearly horizontal off a brick's corner.
      const speed = Math.hypot(ball.vx, ball.vy) || ball.speed;
      if (Math.abs(ball.vy) < speed * BALL.minVerticalRatio) {
        ball.vy = (ball.vy < 0 ? -1 : 1) * speed * BALL.minVerticalRatio;
        ball.vx = Math.sign(ball.vx || 1) * Math.sqrt(Math.max(0, speed * speed - ball.vy * ball.vy));
      }
      return damageBrick(brick, 1, events);
    }
    return events;
  }

  function stepBall(ball, dt, events) {
    ball.speed = Math.min(ball.baseSpeed * BALL.rampCap, ball.speed + BALL.rampPerSecond * dt);
    const effSpeed = ball.speed * (state.slowT > 0 ? POWERUPS.slowFactor : 1);
    const len = Math.hypot(ball.vx, ball.vy) || 1;
    ball.vx = (ball.vx / len) * effSpeed;
    ball.vy = (ball.vy / len) * effSpeed;
    const dist = effSpeed * dt;
    const sub = Math.max(1, Math.ceil(dist / 5));
    const sdt = dt / sub;
    for (let i = 0; i < sub; i += 1) {
      ball.x += ball.vx * sdt;
      ball.y += ball.vy * sdt;
      if (ball.x < BALL.radius) { ball.x = BALL.radius; ball.vx = Math.abs(ball.vx); events |= EV_BOUNCE; }
      if (ball.x > FIELD.width - BALL.radius) { ball.x = FIELD.width - BALL.radius; ball.vx = -Math.abs(ball.vx); events |= EV_BOUNCE; }
      if (ball.y < BALL.radius) { ball.y = BALL.radius; ball.vy = Math.abs(ball.vy); events |= EV_BOUNCE; }
      // Paddle: only while the ball falls toward it.
      if (ball.vy > 0 && ball.y + BALL.radius >= PADDLE.y && ball.y - BALL.radius <= PADDLE.y + PADDLE.height
        && Math.abs(ball.x - paddle.x) <= paddle.w / 2 + BALL.radius) {
        const rel = clamp((ball.x - paddle.x) / (paddle.w / 2), -1, 1);
        let angle = rel * PADDLE.maxBounceAngle + paddle.vx * 0.00032;
        // A dead-centre hit would loop vertically forever in a cleared
        // shaft, so a nearly straight rebound always leaves with a tilt.
        if (Math.abs(angle) < 0.07) angle += (random() < 0.5 ? -1 : 1) * 0.11;
        angle = clamp(angle, -1.25, 1.25);
        ball.vx = Math.sin(angle) * effSpeed;
        ball.vy = -Math.cos(angle) * effSpeed;
        ball.y = PADDLE.y - BALL.radius - 0.5;
        events |= EV_PADDLE;
      }
      events = collideBricks(ball, events);
      if (ball.y - BALL.radius > FIELD.height) {
        loseBall(ball);
        events |= EV_LOSE;
        return events;
      }
    }
    ball.trail.push({ x: ball.x, y: ball.y });
    if (ball.trail.length > 13) ball.trail.shift();
    return events;
  }

  function step(dt, control) {
    let events = 0;
    if (state.hitStop > 0) {
      state.hitStop -= dt;
      return events;
    }
    updateFx(dt);
    if (state.phase === PHASE_OVER || state.phase === PHASE_WIN) return events;
    state.elapsed += dt;
    if (state.messageT > 0) state.messageT -= dt;
    if (state.slowT > 0) state.slowT -= dt;
    if (state.laserT > 0) state.laserT -= dt;
    if (state.wideT > 0) state.wideT -= dt;
    if (state.laserCd > 0) state.laserCd -= dt;

    // Paddle: an absolute target (mouse / autopilot) wins over key direction.
    const halfW = paddle.w / 2;
    if (control && control.targetX !== null && control.targetX !== undefined) {
      const target = clamp(control.targetX, halfW, FIELD.width - halfW);
      paddle.vx = (target - paddle.x) / dt;
      paddle.x = target;
    } else {
      const dir = control ? control.dir || 0 : 0;
      paddle.vx = dir * PADDLE.keySpeed;
      paddle.x = clamp(paddle.x + paddle.vx * dt, halfW, FIELD.width - halfW);
    }
    const targetW = state.wideT > 0 ? PADDLE.wideWidth : PADDLE.baseWidth;
    paddle.w += (targetW - paddle.w) * Math.min(1, dt * 10);

    for (const ball of state.balls) {
      if (ball.stuck) { ball.x = paddle.x; ball.y = PADDLE.y - BALL.radius - 1; ball.trail.length = 0; }
    }

    if (control && control.action) {
      if (state.phase === PHASE_READY) launch();
      else events = fireBolts(events);
    }

    if (state.phase === PHASE_CLEAR) {
      state.clearT -= dt;
      if (state.clearT <= 0) {
        if (state.levelIndex >= LEVELS.length - 1) {
          state.phase = PHASE_WIN;
          // Nothing should hang frozen in the air behind the win screen.
          state.bolts = [];
          state.powerups = [];
          events |= EV_WIN;
        } else {
          startLevel(state.levelIndex + 1);
        }
      }
      return events;
    }
    if (state.phase !== PHASE_PLAYING) return events;
    state.levelTime += dt;

    for (const ball of [...state.balls]) {
      if (!ball.stuck && state.balls.includes(ball)) events = stepBall(ball, dt, events);
    }
    if (state.balls.length === 0 && state.phase === PHASE_PLAYING) {
      events = onAllBallsLost(events);
      return events;
    }

    // Laser bolts fly up and chip bricks for one damage each.
    for (const bolt of state.bolts) {
      if (!bolt.active) continue;
      bolt.y -= POWERUPS.boltSpeed * dt;
      if (bolt.y < 0) { bolt.active = false; continue; }
      for (const brick of state.bricks) {
        if (!brick.active) continue;
        if (bolt.x >= brick.x && bolt.x <= brick.x + brick.w && bolt.y >= brick.y && bolt.y <= brick.y + brick.h) {
          bolt.active = false;
          const before = brick.active;
          events = damageBrick(brick, 1, events);
          if (before && brick.active) state.score += SCORE.laserHit;
          break;
        }
      }
    }
    state.bolts = state.bolts.filter((b) => b.active);

    // Falling powerups: caught on the paddle, lost below the field.
    for (const drop of state.powerups) {
      if (!drop.active) continue;
      drop.y += POWERUPS.fallSpeed * dt;
      if (drop.y > FIELD.height + 12) { drop.active = false; continue; }
      if (drop.y + POWERUPS.height / 2 >= PADDLE.y && drop.y - POWERUPS.height / 2 <= PADDLE.y + PADDLE.height
        && Math.abs(drop.x - paddle.x) <= paddle.w / 2 + POWERUPS.width / 2) {
        drop.active = false;
        applyPowerup(drop.type);
        addFloater(paddle.x, PADDLE.y - 26, POWERUP_LABELS[drop.type], '#7dffce');
        burst(drop.x, drop.y, '#7dffce', 10, 0.8);
        events |= EV_POWER;
      }
    }
    state.powerups = state.powerups.filter((d) => d.active);

    if (state.breakableLeft <= 0 && state.phase === PHASE_PLAYING) {
      state.phase = PHASE_CLEAR;
      state.clearT = 1.5;
      events |= EV_CLEAR;
    }
    return events;
  }

  reset();
  return { state, reset, startLevel, launch, step };
}

export { LEVELS, POWERUP_KINDS, POWERUP_LABELS };
