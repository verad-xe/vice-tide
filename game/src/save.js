// Vice Tide — progress persistence in localStorage.
// Saves cash, story progress, respect, the clock and where the player
// woke up, so "Continue" on the title screen picks the run back up.

import { SAVE_KEY, PLAYER } from './config.js';

export function hasSave() {
  try {
    return !!window.localStorage.getItem(SAVE_KEY);
  } catch (err) {
    return false;
  }
}

export function writeSave(game) {
  try {
    const data = {
      cash: game.player.cash,
      storyIndex: game.storyIndex,
      respect: game.respect,
      day: game.day,
      clockMinutes: game.clockMinutes,
      playerX: game.player.x,
      playerY: game.player.y,
      sideJobsDone: game.sideJobsDone,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (err) {
    // Private mode or a full disk: the run simply is not saved.
  }
}

export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      cash: Number.isFinite(data.cash) ? data.cash : PLAYER.startCash,
      storyIndex: Number.isFinite(data.storyIndex) ? data.storyIndex : 0,
      respect: Number.isFinite(data.respect) ? data.respect : 0,
      day: Number.isFinite(data.day) ? data.day : 1,
      clockMinutes: Number.isFinite(data.clockMinutes) ? data.clockMinutes : 9 * 60,
      playerX: Number.isFinite(data.playerX) ? data.playerX : PLAYER.startX,
      playerY: Number.isFinite(data.playerY) ? data.playerY : PLAYER.startY,
      sideJobsDone: Number.isFinite(data.sideJobsDone) ? data.sideJobsDone : 0,
    };
  } catch (err) {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch (err) {
    // Nothing to clear.
  }
}
