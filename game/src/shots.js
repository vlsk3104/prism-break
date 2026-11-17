// The screenshot scenes behind ?shot=title|play|frenzy|win. Each one plays
// the real rules forward from a fresh world with the shared autopilot, so
// a frame is what an actual game looks like and a fixed seed always gives
// the same frame. The win scene plays the first two walls for real, then
// stages the final wall with only a few bricks left standing — the pilot
// still has to break those itself before the victory screen can appear.

import { STEP } from './config.js';
import { createAutopilot } from './autopilot.js';
import { SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const pilot = createAutopilot();

function run(world, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) world.step(STEP, pilot(world.state));
}

function addExtraBalls(state) {
  const origin = state.balls.find((b) => !b.stuck) || state.balls[0];
  if (!origin) return;
  for (const tilt of [-0.5, 0.5]) {
    const angle = Math.atan2(origin.vx, -origin.vy) + tilt;
    state.balls.push({
      x: origin.x, y: origin.y,
      vx: Math.sin(angle) * origin.speed, vy: -Math.cos(angle) * origin.speed,
      speed: origin.speed, baseSpeed: origin.baseSpeed, stuck: false, trail: [],
    });
  }
}

export function stageShot(name, world) {
  const state = world.state;
  world.reset();
  if (name === 'play') {
    world.startLevel(1);
    run(world, 24);
    return { screen: SCREEN_PLAY, best: state.score };
  }
  if (name === 'frenzy') {
    world.startLevel(2);
    run(world, 2.5);
    addExtraBalls(state);
    state.laserT = 11;
    state.wideT = 11;
    run(world, 8);
    return { screen: SCREEN_PLAY, best: state.score };
  }
  if (name === 'win') {
    // Play the first two walls for real so the victory stats are earned,
    // not typed in; only the final wall is staged (below).
    for (let i = 0; i < 420 / STEP && state.levelIndex < 2; i += 1) {
      world.step(STEP, pilot(state));
      if (state.phase === 'over' || state.phase === 'win') break;
    }
    world.startLevel(5);
    // Leave a small cluster of normal bricks standing on the final wall.
    let kept = 0;
    for (const brick of state.bricks) {
      if (!brick.active) continue;
      if (brick.kind === 'normal' && brick.row >= 5 && kept < 4) { kept += 1; continue; }
      brick.active = false;
      if (brick.kind !== 'steel') state.breakableLeft -= 1;
    }
    state.laserT = 10;
    for (let i = 0; i < 120 / STEP && state.phase !== 'win'; i += 1) {
      world.step(STEP, pilot(state));
      if (state.phase === 'over') break;
    }
    return { screen: state.phase === 'win' ? SCREEN_WIN : SCREEN_PLAY, best: state.score };
  }
  // title (and any unknown name): the demo game runs behind the title card.
  run(world, 7);
  return { screen: SCREEN_TITLE, best: 0 };
}
