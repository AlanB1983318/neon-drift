export const CANVAS_W = 960;
export const CANVAS_H = 640;

export const SURFACE = {
  DIRT: { color: '#12122e', glow: '#00ffff', friction: 0.96, maxMult: 1.0, name: 'track' },
  GRASS: { color: '#080818', glow: '#330066', friction: 0.92, maxMult: 0.65, name: 'void' },
  MUD: { color: '#1a0828', glow: '#ff00ff', friction: 0.85, maxMult: 0.45, name: 'drain' },
  ASPHALT: { color: '#0a2040', glow: '#00ccff', friction: 0.97, maxMult: 1.1, name: 'boost' },
  WATER: { color: '#100830', glow: '#8800ff', friction: 0.7, maxMult: 0.3, name: 'plasma' },
};

export const UPGRADE_COSTS = [0, 200, 400, 700, 1100, 1600];
export const MAX_UPGRADE_LEVEL = 5;

export const TRUCK_COLORS = [
  { body: '#00ffff', glow: '#00ffff', trim: '#0088aa', name: 'Cyan Phantom' },
  { body: '#ff00ff', glow: '#ff00ff', trim: '#aa00aa', name: 'Magenta Streak' },
  { body: '#4488ff', glow: '#4488ff', trim: '#2244aa', name: 'Ion Drift' },
  { body: '#00ff88', glow: '#00ff88', trim: '#00aa55', name: 'Neon Pulse' },
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
