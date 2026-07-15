export const CANVAS_W = 960;
export const CANVAS_H = 640;

export const SURFACE = {
  DIRT: { color: '#c8a858', detail: '#a08038', friction: 0.94, maxMult: 1.0, name: 'track' },
  GRASS: { color: '#4a9a40', detail: '#2d7028', friction: 0.90, maxMult: 0.6, name: 'grass' },
  MUD: { color: '#7a5030', detail: '#4a3018', friction: 0.86, maxMult: 0.52, name: 'mud' },
  ASPHALT: { color: '#808080', detail: '#606060', friction: 0.97, maxMult: 1.15, name: 'boost' },
  WATER: { color: '#4a88b8', detail: '#2a5888', friction: 0.65, maxMult: 0.25, name: 'water' },
};

export const UPGRADE_COSTS = [0, 200, 400, 700, 1100, 1600];
export const MAX_UPGRADE_LEVEL = 5;

export const TRUCK_COLORS = [
  { body: '#e83030', trim: '#c01818', dark: '#901010', accent: '#ff8080', wheel: '#111', name: 'RED' },
  { body: '#3060e0', trim: '#1840c0', dark: '#102890', accent: '#80a0ff', wheel: '#111', name: 'BLUE' },
  { body: '#e8c818', trim: '#c0a000', dark: '#907800', accent: '#ffe060', wheel: '#111', name: 'YELLOW' },
  { body: '#30b050', trim: '#189038', dark: '#106820', accent: '#70e090', wheel: '#111', name: 'GREEN' },
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
