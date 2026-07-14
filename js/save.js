import { UPGRADE_COSTS, MAX_UPGRADE_LEVEL } from './utils.js?v=6';

const SAVE_KEY = 'offroad-spinoff-save';

const DEFAULT_SAVE = {
  credits: 0,
  upgrades: { speed: 0, accel: 0, handling: 0, nitro: 0 },
  tracksUnlocked: 1,
  championshipsWon: 0,
};

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return structuredClone(DEFAULT_SAVE);
    return { ...DEFAULT_SAVE, ...JSON.parse(raw) };
  } catch {
    return structuredClone(DEFAULT_SAVE);
  }
}

export function writeSave(data) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

export function getStats(upgrades) {
  return {
    maxSpeed: 4.5 + upgrades.speed * 0.6,
    accel: 0.08 + upgrades.accel * 0.015,
    turnRate: 0.045 + upgrades.handling * 0.008,
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
  if (trackIndex + 1 > save.tracksUnlocked && trackIndex + 1 <= 5) {
    save.tracksUnlocked = trackIndex + 1;
    writeSave(save);
  }
}

export function resetSave() {
  writeSave(structuredClone(DEFAULT_SAVE));
  return loadSave();
}
