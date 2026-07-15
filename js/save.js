import { UPGRADE_COSTS, MAX_UPGRADE_LEVEL } from './utils.js?v=31';

const SAVE_KEY = 'offroad-spinoff-save';

const DEFAULT_SAVE = {
  credits: 0,
  upgrades: { speed: 0, accel: 0, handling: 0, nitro: 0 },
  tracksUnlocked: 1,
  championshipsWon: 0,
};

function cloneSave(data) {
  return JSON.parse(JSON.stringify(data));
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return cloneSave(DEFAULT_SAVE);
    const data = JSON.parse(raw);
    return {
      ...DEFAULT_SAVE,
      ...data,
      upgrades: { ...DEFAULT_SAVE.upgrades, ...(data.upgrades || {}) },
    };
  } catch {
    return cloneSave(DEFAULT_SAVE);
  }
}

export function writeSave(data) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

export function getStats(upgrades) {
  return {
    maxSpeed: 4.8 + upgrades.speed * 0.65,
    accel: 0.1 + upgrades.accel * 0.018,
    turnRate: 0.058 + upgrades.handling * 0.01,
    nitroMax: 100 + upgrades.nitro * 25,
    nitroPower: 1.4 + upgrades.nitro * 0.15,
  };
}

export function getUpgradeCost(level) {
  if (level >= MAX_UPGRADE_LEVEL) return Infinity;
  return UPGRADE_COSTS[level + 1] ?? Infinity;
}

export function buyUpgrade(save, stat) {
  const level = save.upgrades[stat];
  const cost = getUpgradeCost(level);
  if (level >= MAX_UPGRADE_LEVEL || save.credits < cost) return false;
  save.credits -= cost;
  save.upgrades[stat]++;
  writeSave(save);
  return true;
}

export function awardRaceCredits(save, position) {
  const prizes = [500, 350, 200, 100];
  const earned = prizes[position - 1] ?? 50;
  save.credits += earned;
  writeSave(save);
  return earned;
}

export function unlockNextTrack(save, trackIndex) {
  const nextCount = trackIndex + 2;
  if (nextCount > save.tracksUnlocked && nextCount <= 5) {
    save.tracksUnlocked = nextCount;
    writeSave(save);
    return true;
  }
  return false;
}

export function resetSave() {
  writeSave(cloneSave(DEFAULT_SAVE));
  return loadSave();
}
