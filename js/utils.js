export const CANVAS_W = 960;
export const CANVAS_H = 640;

export const SURFACE = {
  DIRT: { color: '#d4b06a', detail: '#a08040', friction: 0.96, maxMult: 1.0, name: 'track' },
  GRASS: { color: '#4a9a42', detail: '#357830', friction: 0.92, maxMult: 0.65, name: 'grass' },
  MUD: { color: '#7a5030', detail: '#4a3018', friction: 0.85, maxMult: 0.45, name: 'mud' },
  ASPHALT: { color: '#707070', detail: '#505050', friction: 0.97, maxMult: 1.1, name: 'boost' },
  WATER: { color: '#4a90c8', detail: '#2a6098', friction: 0.7, maxMult: 0.3, name: 'water' },
};

export const UPGRADE_COSTS = [0, 200, 400, 700, 1100, 1600];
export const MAX_UPGRADE_LEVEL = 5;

export const TRUCK_COLORS = [
  { body: '#e83838', trim: '#cc2020', dark: '#991818', wheel: '#1a1a1a', name: 'Red Racer' },
  { body: '#3868e8', trim: '#2048cc', dark: '#1030a0', wheel: '#1a1a1a', name: 'Blue Bolt' },
  { body: '#e8c820', trim: '#cca800', dark: '#a08000', wheel: '#1a1a1a', name: 'Yellow Thunder' },
  { body: '#38b058', trim: '#209040', dark: '#107030', wheel: '#1a1a1a', name: 'Green Machine' },
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
