export const CANVAS_W = 960;
export const CANVAS_H = 640;

export const SURFACE = {
  DIRT: { color: '#c4a060', detail: '#b08d4a', friction: 0.96, maxMult: 1.0, name: 'track' },
  GRASS: { color: '#3d7a3d', detail: '#2d602d', friction: 0.92, maxMult: 0.65, name: 'grass' },
  MUD: { color: '#6b4423', detail: '#4a2f18', friction: 0.85, maxMult: 0.45, name: 'mud' },
  ASPHALT: { color: '#6a6a6a', detail: '#888888', friction: 0.97, maxMult: 1.1, name: 'boost' },
  WATER: { color: '#3a7ab8', detail: '#2a5a8a', friction: 0.7, maxMult: 0.3, name: 'water' },
};

export const UPGRADE_COSTS = [0, 200, 400, 700, 1100, 1600];
export const MAX_UPGRADE_LEVEL = 5;

export const TRUCK_COLORS = [
  { body: '#e03030', trim: '#aa1010', dark: '#801010', wheel: '#222222', name: 'Red Racer' },
  { body: '#3060e0', trim: '#1030aa', dark: '#0a2080', wheel: '#222222', name: 'Blue Bolt' },
  { body: '#e0c020', trim: '#aa8800', dark: '#806600', wheel: '#222222', name: 'Yellow Thunder' },
  { body: '#30b050', trim: '#108030', dark: '#0a6020', wheel: '#222222', name: 'Green Machine' },
];

export const LAPS_PER_RACE = 3;
export const RACE_PRIZE = [500, 350, 200, 100];

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function pointInRect(px, py, rx, ry, rw, rh) {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}
