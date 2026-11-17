// A predictive pilot shared by the title-screen demo and the screenshot
// scenes: it forecasts where the lowest falling ball crosses the paddle
// line (unfolding wall bounces), then deliberately meets the ball
// off-centre so the rebound angles toward the lowest standing brick —
// a pilot that always centred the ball would lock it into a vertical
// loop in any shaft it cleared. It plays the real rules: it can miss,
// and on the title screen that is part of the show.

import { BALL, FIELD, PADDLE } from './config.js';

function predictLandingX(ball) {
  // Unfold the field: mirror the ball's x into an endless strip, advance it
  // to the paddle line, then fold the strip back into the real width.
  const span = FIELD.width - BALL.radius * 2;
  const time = (PADDLE.y - BALL.radius - ball.y) / ball.vy;
  let x = ball.x - BALL.radius + ball.vx * time;
  x = ((x % (span * 2)) + span * 2) % (span * 2);
  if (x > span) x = span * 2 - x;
  return x + BALL.radius;
}

function targetBrick(state, ballX) {
  // Aim at one of the lowest standing bricks, rotating the choice every
  // few seconds: fixating on a single brick can trap the ball above a
  // steel frame, while rotating varies the entry angle until one lands.
  const standing = state.bricks.filter((b) => b.active && b.kind !== 'steel');
  if (standing.length === 0) return null;
  standing.sort((a, b) => (b.y - a.y) || (Math.abs(a.x + a.w / 2 - ballX) - Math.abs(b.x + b.w / 2 - ballX)));
  const pool = standing.slice(0, 6);
  return pool[Math.floor(state.elapsed / 5) % pool.length];
}

export function createAutopilot() {
  return function pilot(state) {
    let chosen = null;
    for (const ball of state.balls) {
      if (ball.stuck) continue;
      if (ball.vy > 0 && (chosen === null || ball.y > chosen.y)) chosen = ball;
    }
    let target = state.paddle.x;
    if (chosen) {
      const landing = predictLandingX(chosen);
      const brick = targetBrick(state, chosen.x);
      if (brick) {
        const brickCx = brick.x + brick.w / 2;
        const brickCy = brick.y + brick.h / 2;
        // A slow sweep on top of the aimed angle keeps long rallies from
        // settling into a repeating pattern that never connects.
        const desired = Math.atan2(brickCx - landing, PADDLE.y - brickCy) + Math.sin(state.elapsed * 0.45) * 0.22;
        const rel = Math.max(-0.85, Math.min(0.85, desired / PADDLE.maxBounceAngle));
        target = landing - rel * (state.paddle.w / 2);
      } else {
        target = landing;
      }
    } else if (state.balls.length > 0) {
      target = state.balls[0].x;
    }
    const wantAction = state.phase === 'ready' || state.laserT > 0;
    return { dir: 0, targetX: target, action: wantAction };
  };
}
