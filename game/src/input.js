// Keyboard and pointer input. Held keys give a direction; the pointer
// gives an absolute paddle target in field coordinates (the canvas is
// letterboxed, so the mapping goes through its bounding rect). One-shot
// actions — confirm/launch/fire, pause, mute — are queued as bit flags
// and drained once per frame by the caller.

import { FIELD } from './config.js';

export const ACTION_ACTION = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

export function createInput(canvas) {
  const held = new Set();
  let pointerX = null;
  let queued = 0;

  function toFieldX(clientX) {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0) return null;
    // The renderer letterboxes the 1280x720 field inside the canvas.
    const scale = Math.min(rect.width / FIELD.width, rect.height / FIELD.height);
    const offsetX = (rect.width - FIELD.width * scale) / 2;
    return (clientX - rect.left - offsetX) / scale;
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { held.add('left'); e.preventDefault(); }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') { held.add('right'); e.preventDefault(); }
    if (e.code === 'Space') { queued |= ACTION_ACTION; e.preventDefault(); }
    if (e.code === 'Enter') queued |= ACTION_ACTION;
    if (e.code === 'KeyP' || e.code === 'Escape') queued |= ACTION_PAUSE;
    if (e.code === 'KeyM') queued |= ACTION_MUTE;
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') held.delete('left');
    if (e.code === 'ArrowRight' || e.code === 'KeyD') held.delete('right');
  });
  canvas.addEventListener('pointermove', (e) => { pointerX = toFieldX(e.clientX); });
  canvas.addEventListener('pointerdown', (e) => { pointerX = toFieldX(e.clientX); queued |= ACTION_ACTION; });
  window.addEventListener('blur', () => held.clear());

  return {
    direction() {
      return (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
    },
    targetX() {
      // Keyboard input overrides the pointer until the pointer moves again.
      return this.direction() !== 0 ? null : pointerX;
    },
    takeActions() {
      const out = queued;
      queued = 0;
      return out;
    },
  };
}
