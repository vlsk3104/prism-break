// Prism Break tuning: every gameplay number lives here so the balance pass
// only ever touches one file. The field is a fixed 1280x720 logical space;
// the renderer letterboxes it into the window, so no rule depends on the
// actual screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step in seconds: 60 updates a second at any refresh rate. */
export const STEP = 1 / 60;

export const PADDLE = {
  y: 664,
  height: 14,
  baseWidth: 112,
  wideWidth: 176,
  keySpeed: 880,
  /** How strongly paddle motion bends the ball (the "spin" a moving paddle imparts). */
  spinFactor: 0.16,
  /** Widest rebound angle from vertical, in radians, at the paddle's very edge. */
  maxBounceAngle: (65 * Math.PI) / 180,
};

export const BALL = {
  radius: 8,
  /** Speed on level 1, and the extra speed each later level starts with. */
  baseSpeed: 420,
  speedPerLevel: 34,
  /** Within a level the ball gains this many px/s each second, up to rampCap times its start speed. */
  rampPerSecond: 7,
  rampCap: 1.38,
  /** A rebound never leaves the ball flatter than this angle from vertical. */
  minVerticalRatio: 0.34,
  maxCount: 6,
};

export const BRICKS = {
  cols: 12,
  top: 92,
  left: 64,
  gap: 6,
  height: 24,
  get width() {
    return (FIELD.width - this.left * 2 - this.gap * (this.cols - 1)) / this.cols;
  },
};

export const LIVES = 3;

export const SCORE = {
  normal: 50,
  armored: 80,
  explosive: 70,
  /** Added per combo step on top of the brick's base value. */
  comboStep: 5,
  laserHit: 10,
};

export const POWERUPS = {
  fallSpeed: 175,
  width: 30,
  height: 16,
  /** Chance that a broken brick drops a powerup. */
  dropChance: 0.17,
  wideSeconds: 14,
  laserSeconds: 12,
  slowSeconds: 8,
  /** Ball speed multiplier while slow-time runs. */
  slowFactor: 0.55,
  laserCooldown: 0.17,
  boltSpeed: 760,
};

export const FX = {
  hitStopSeconds: 0.045,
  shakeOnExplosion: 7,
  shakeDecay: 26,
  particleCap: 420,
  floaterCap: 24,
};

/** Neon colour per brick row band; armored and special bricks override it. */
export const ROW_COLORS = ['#ff4d6d', '#ff8a3d', '#ffd23d', '#3dff8a', '#3dc8ff', '#8a5cff', '#ff3dd8', '#3dffe0'];

export const COLORS = {
  bgTop: '#070714',
  bgBottom: '#0d1030',
  grid: 'rgba(90,110,255,0.07)',
  paddle: '#37f4ff',
  paddleLaser: '#ff4d6d',
  ball: '#ffffff',
  steel: '#5a6478',
  armored: '#c8d2e8',
  explosive: '#ff9f1c',
  text: '#eef4ff',
  muted: '#8b96b8',
  accent: '#37f4ff',
  combo: '#ffd23d',
};

export const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'prism-break.best.v1';
