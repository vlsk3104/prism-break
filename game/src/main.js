// Boot and the one loop. Input is read every frame, the world advances in
// fixed 1/60 s steps, world events are turned into sound, and the renderer
// paints what is there. Screens: title (with a live autopilot demo running
// behind the card), play, paused, game over and victory.
//
// ?seed=N fixes the random pattern. ?shot=title|play|frenzy|win (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for the screenshot tooling.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld, EV_ARMOR_BREAK, EV_BOUNCE, EV_BREAK, EV_CLEAR, EV_EXPLODE,
  EV_HIT, EV_LASER, EV_LOSE, EV_OVER, EV_PADDLE, EV_POWER, EV_WIN,
} from './world.js';
import { ACTION_ACTION, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { createAutopilot } from './autopilot.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();
const pilot = createAutopilot();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best then lasts this visit.
  }
}

function playEvents(events) {
  if (events & EV_EXPLODE) audio.play('explode');
  else if (events & EV_ARMOR_BREAK) audio.play('armorBreak');
  else if (events & EV_BREAK) audio.play('break');
  else if (events & EV_HIT) audio.play('hit');
  else if (events & EV_PADDLE) audio.play('paddle');
  else if (events & EV_BOUNCE) audio.play('bounce');
  if (events & EV_LASER) audio.play('laser');
  if (events & EV_POWER) audio.play('power');
  if (events & EV_LOSE) audio.play('lose');
  if (events & EV_CLEAR) audio.play('clear');
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let pendingAction = false;

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    pendingAction = false;
    screen = SCREEN_PLAY;
    announce('Playing. Level 1, 3 lives.');
  }

  function finishRun(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    audio.play(won ? 'win' : 'over');
    announce(won ? `You win. Score ${world.state.score}.` : `Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) audio.toggleMute();
    if (actions & ACTION_ACTION) {
      audio.unlock();
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) startGame();
      else if (screen === SCREEN_PAUSED) { screen = SCREEN_PLAY; announce('Playing.'); }
      else pendingAction = true;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) { screen = SCREEN_PAUSED; announce('Paused.'); }
      else if (screen === SCREEN_PAUSED) { screen = SCREEN_PLAY; announce('Playing.'); }
    }
  }

  function stepWorld() {
    if (screen === SCREEN_TITLE) {
      // The demo plays itself; a lost demo game simply restarts.
      world.step(STEP, pilot(world.state));
      if (world.state.phase === 'over' || world.state.phase === 'win') world.reset();
      return;
    }
    const control = {
      dir: input.direction(),
      targetX: input.targetX(),
      action: pendingAction,
    };
    pendingAction = false;
    const events = world.step(STEP, control);
    playEvents(events);
    if (events & EV_WIN) finishRun(true);
    else if (events & EV_OVER) finishRun(false);
    else if (events & EV_LOSE && world.state.lives > 0) announce(`${world.state.lives} ${world.state.lives === 1 ? 'life' : 'lives'} left.`);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        stepWorld();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, audio.isMuted());
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Prism Break. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
