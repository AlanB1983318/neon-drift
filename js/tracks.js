import { SURFACE } from './utils.js?v=16';
import { boxesFromWaypoints, coinsFromWaypoints } from './items.js?v=16';

function makeTrack(config) {
  const waypoints = config.waypoints;
  return {
    name: config.name,
    description: config.description,
    surfaces: config.surfaces,
    walls: config.walls,
    checkpoints: config.checkpoints,
    waypoints,
    starts: config.starts,
    decorations: config.decorations || [],
    itemBoxes: config.itemBoxes || boxesFromWaypoints(waypoints, 3),
    coins: config.coins || coinsFromWaypoints(waypoints, 2),
    roadWidth: config.roadWidth || 58,
    shoulderWidth: config.shoulderWidth || 10,
    roadType: config.roadType || 'DIRT',
    roadClosed: config.roadClosed !== false,
    roadShape: config.roadShape || null,
  };
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function isOnWaypointRoad(track, x, y) {
  const wps = track.waypoints;
  if (!wps || wps.length < 2) return false;
  const half = (track.roadWidth || 58) / 2 + (track.shoulderWidth || 10);
  const closed = track.roadClosed !== false;
  const segs = closed ? wps.length : wps.length - 1;
  let minD = Infinity;
  for (let i = 0; i < segs; i++) {
    const a = wps[i];
    const b = wps[(i + 1) % wps.length];
    minD = Math.min(minD, distToSegment(x, y, a.x, a.y, b.x, b.y));
  }
  return minD <= half;
}

function isOnOvalRoad(track, x, y) {
  const e = track.surfaces?.find((s) => s.shape === 'ellipse' && s.type === 'DIRT')
    || (track.roadShape === 'oval' ? { cx: 480, cy: 320, rx: 310, ry: 210 } : null);
  if (!e) return false;
  const roadW = track.roadWidth || 64;
  const outer = ((x - e.cx) / e.rx) ** 2 + ((y - e.cy) / e.ry) ** 2;
  const innerRx = e.rx - roadW;
  const innerRy = e.ry - roadW * (e.ry / e.rx);
  const inner = ((x - e.cx) / innerRx) ** 2 + ((y - e.cy) / innerRy) ** 2;
  return outer <= 1 && inner >= 1;
}

export const TRACKS = [
  makeTrack({
    name: 'Dirt Oval',
    description: 'Learn the ropes on this classic oval track.',
    roadShape: 'oval',
    roadWidth: 72,
    surfaces: [
      { type: 'GRASS', x: 0, y: 0, w: 960, h: 640 },
      { type: 'DIRT', shape: 'ellipse', cx: 480, cy: 320, rx: 310, ry: 210 },
      { type: 'MUD', shape: 'ellipse', cx: 480, cy: 320, rx: 70, ry: 45 },
    ],
    walls: [
      { x: 280, y: 240, w: 80, h: 24 },
      { x: 600, y: 380, w: 80, h: 24 },
    ],
    checkpoints: [
      { x: 480, y: 510, radius: 55 },
      { x: 200, y: 320, radius: 55 },
      { x: 760, y: 320, radius: 55 },
      { x: 480, y: 130, radius: 55 },
    ],
    waypoints: [
      { x: 480, y: 490 }, { x: 250, y: 400 }, { x: 190, y: 320 },
      { x: 250, y: 220 }, { x: 480, y: 140 }, { x: 710, y: 220 },
      { x: 770, y: 320 }, { x: 710, y: 420 }, { x: 480, y: 490 },
    ],
    starts: [
      { x: 430, y: 470, angle: -Math.PI / 2 },
      { x: 455, y: 485, angle: -Math.PI / 2 },
      { x: 480, y: 495, angle: -Math.PI / 2 },
      { x: 505, y: 485, angle: -Math.PI / 2 },
    ],
    decorations: [
      { type: 'grandstand', x: 480, y: 70, scale: 1.3 },
      { type: 'cone', x: 120, y: 160 }, { type: 'cone', x: 840, y: 160 },
      { type: 'tire', x: 150, y: 540, scale: 1.2 }, { type: 'tire', x: 810, y: 540, scale: 1.2 },
      { type: 'tree', x: 50, y: 250 }, { type: 'tree', x: 910, y: 250 },
    ],
  }),

  makeTrack({
    name: 'Mud Bog',
    description: 'Watch out — the swamp will slow you right down.',
    roadWidth: 62,
    surfaces: [
      { type: 'GRASS', x: 0, y: 0, w: 960, h: 640 },
      { type: 'MUD', x: 380, y: 240, w: 200, h: 160 },
      { type: 'WATER', x: 430, y: 290, w: 100, h: 60 },
      { type: 'ASPHALT', x: 120, y: 280, w: 80, h: 80 },
      { type: 'ASPHALT', x: 760, y: 280, w: 80, h: 80 },
    ],
    walls: [
      { x: 100, y: 60, w: 760, h: 20 },
      { x: 100, y: 560, w: 760, h: 20 },
      { x: 100, y: 60, w: 20, h: 520 },
      { x: 840, y: 60, w: 20, h: 520 },
      { x: 340, y: 200, w: 20, h: 80 },
      { x: 600, y: 360, w: 20, h: 80 },
      { x: 340, y: 360, w: 280, h: 20 },
    ],
    checkpoints: [
      { x: 480, y: 520, radius: 55 },
      { x: 160, y: 320, radius: 50 },
      { x: 480, y: 160, radius: 55 },
      { x: 800, y: 320, radius: 50 },
    ],
    waypoints: [
      { x: 480, y: 500 }, { x: 180, y: 450 }, { x: 160, y: 320 },
      { x: 180, y: 180 }, { x: 480, y: 140 }, { x: 780, y: 180 },
      { x: 800, y: 320 }, { x: 780, y: 460 }, { x: 480, y: 500 },
    ],
    starts: [
      { x: 420, y: 490, angle: -Math.PI / 2 },
      { x: 445, y: 500, angle: -Math.PI / 2 },
      { x: 470, y: 510, angle: -Math.PI / 2 },
      { x: 495, y: 500, angle: -Math.PI / 2 },
    ],
    decorations: [
      { type: 'tree', x: 60, y: 120 }, { type: 'tree', x: 900, y: 120 },
      { type: 'rock', x: 350, y: 180 }, { type: 'rock', x: 610, y: 420 },
    ],
  }),

  makeTrack({
    name: 'Crossover',
    description: 'Hit the bridge at full throttle.',
    roadWidth: 54,
    surfaces: [
      { type: 'GRASS', x: 0, y: 0, w: 960, h: 640 },
      { type: 'ASPHALT', x: 420, y: 280, w: 120, h: 80 },
      { type: 'MUD', x: 200, y: 420, w: 100, h: 80 },
      { type: 'MUD', x: 660, y: 140, w: 100, h: 80 },
    ],
    walls: [
      { x: 60, y: 40, w: 420, h: 20 }, { x: 480, y: 40, w: 420, h: 20 },
      { x: 60, y: 300, w: 420, h: 20 }, { x: 480, y: 300, w: 420, h: 20 },
      { x: 60, y: 560, w: 420, h: 20 }, { x: 480, y: 560, w: 420, h: 20 },
      { x: 60, y: 40, w: 20, h: 280 }, { x: 60, y: 300, w: 20, h: 280 },
      { x: 880, y: 40, w: 20, h: 280 }, { x: 880, y: 300, w: 20, h: 280 },
      { x: 460, y: 40, w: 20, h: 240 }, { x: 460, y: 360, w: 20, h: 240 },
    ],
    checkpoints: [
      { x: 260, y: 500, radius: 50 },
      { x: 700, y: 500, radius: 50 },
      { x: 700, y: 140, radius: 50 },
      { x: 260, y: 140, radius: 50 },
      { x: 480, y: 320, radius: 45 },
    ],
    waypoints: [
      { x: 260, y: 480 }, { x: 260, y: 340 }, { x: 260, y: 160 },
      { x: 480, y: 160 }, { x: 700, y: 160 }, { x: 700, y: 340 },
      { x: 700, y: 480 }, { x: 480, y: 480 }, { x: 260, y: 480 },
    ],
    starts: [
      { x: 220, y: 470, angle: -Math.PI / 2 },
      { x: 245, y: 480, angle: -Math.PI / 2 },
      { x: 270, y: 490, angle: -Math.PI / 2 },
      { x: 295, y: 480, angle: -Math.PI / 2 },
    ],
    decorations: [
      { type: 'flag', x: 480, y: 320 },
      { type: 'cone', x: 480, y: 250 },
      { type: 'tree', x: 30, y: 320 },
    ],
  }),

  makeTrack({
    name: 'Canyon Run',
    description: 'Tight turns and a long straight — hold on tight.',
    roadWidth: 56,
    surfaces: [
      { type: 'GRASS', x: 0, y: 0, w: 960, h: 640 },
      { type: 'ASPHALT', x: 100, y: 280, w: 300, h: 80 },
      { type: 'MUD', x: 500, y: 220, w: 80, h: 200 },
      { type: 'MUD', x: 680, y: 220, w: 80, h: 200 },
    ],
    walls: [
      { x: 80, y: 180, w: 800, h: 20 },
      { x: 80, y: 440, w: 800, h: 20 },
      { x: 80, y: 180, w: 20, h: 280 },
      { x: 860, y: 180, w: 20, h: 280 },
      { x: 400, y: 200, w: 20, h: 60 },
      { x: 540, y: 380, w: 20, h: 60 },
    ],
    checkpoints: [
      { x: 140, y: 320, radius: 50 },
      { x: 420, y: 320, radius: 50 },
      { x: 820, y: 320, radius: 50 },
      { x: 500, y: 220, radius: 45 },
    ],
    waypoints: [
      { x: 140, y: 320 }, { x: 300, y: 320 }, { x: 420, y: 320 },
      { x: 560, y: 300 }, { x: 720, y: 320 }, { x: 820, y: 320 },
      { x: 720, y: 320 }, { x: 560, y: 340 }, { x: 420, y: 320 },
      { x: 300, y: 320 }, { x: 140, y: 320 },
    ],
    starts: [
      { x: 120, y: 350, angle: 0 },
      { x: 120, y: 330, angle: 0 },
      { x: 120, y: 310, angle: 0 },
      { x: 120, y: 290, angle: 0 },
    ],
    decorations: [
      { type: 'rock', x: 500, y: 160 },
      { type: 'grandstand', x: 480, y: 150 },
      { type: 'tire', x: 90, y: 180 },
    ],
  }),

  makeTrack({
    name: 'Grand Prix',
    description: 'The championship finale. Every hazard, one winner.',
    roadWidth: 60,
    surfaces: [
      { type: 'GRASS', x: 0, y: 0, w: 960, h: 640 },
      { type: 'ASPHALT', x: 140, y: 280, w: 200, h: 80 },
      { type: 'ASPHALT', x: 620, y: 280, w: 200, h: 80 },
      { type: 'MUD', x: 400, y: 160, w: 160, h: 100 },
      { type: 'MUD', x: 400, y: 380, w: 160, h: 100 },
      { type: 'WATER', x: 440, y: 280, w: 80, h: 80 },
    ],
    walls: [
      { x: 120, y: 80, w: 720, h: 20 },
      { x: 120, y: 540, w: 720, h: 20 },
      { x: 120, y: 80, w: 20, h: 480 },
      { x: 820, y: 80, w: 20, h: 480 },
      { x: 360, y: 140, w: 20, h: 80 },
      { x: 580, y: 140, w: 20, h: 80 },
    ],
    checkpoints: [
      { x: 480, y: 510, radius: 55 },
      { x: 180, y: 320, radius: 50 },
      { x: 480, y: 130, radius: 55 },
      { x: 780, y: 320, radius: 50 },
      { x: 480, y: 320, radius: 40 },
    ],
    waypoints: [
      { x: 480, y: 490 }, { x: 200, y: 420 }, { x: 180, y: 320 },
      { x: 200, y: 200 }, { x: 400, y: 150 }, { x: 560, y: 150 },
      { x: 760, y: 200 }, { x: 780, y: 320 }, { x: 760, y: 440 },
      { x: 560, y: 490 }, { x: 400, y: 490 }, { x: 480, y: 490 },
    ],
    starts: [
      { x: 440, y: 470, angle: -Math.PI / 2 },
      { x: 460, y: 480, angle: -Math.PI / 2 },
      { x: 480, y: 490, angle: -Math.PI / 2 },
      { x: 500, y: 480, angle: -Math.PI / 2 },
    ],
    decorations: [
      { type: 'grandstand', x: 480, y: 60 },
      { type: 'flag', x: 480, y: 60 },
      { type: 'tire', x: 130, y: 530 },
      { type: 'tree', x: 50, y: 320 },
    ],
  }),
];

export function getSurfaceAt(track, x, y) {
  for (let i = track.surfaces.length - 1; i >= 0; i--) {
    const s = track.surfaces[i];
    if (s.type === 'GRASS' || s.type === 'DIRT') continue;
    if (s.shape === 'ellipse') {
      const dx = (x - s.cx) / s.rx;
      const dy = (y - s.cy) / s.ry;
      if (dx * dx + dy * dy <= 1) return s.type;
    } else if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) {
      return s.type;
    }
  }

  if (track.roadShape === 'oval' || track.surfaces?.some((s) => s.shape === 'ellipse' && s.type === 'DIRT')) {
    if (isOnOvalRoad(track, x, y)) return track.roadType || 'DIRT';
  } else if (isOnWaypointRoad(track, x, y)) {
    return track.roadType || 'DIRT';
  }

  return 'GRASS';
}

export function getRoadPointsForMinimap(track) {
  if (track.roadShape === 'oval' || track.surfaces?.some((s) => s.shape === 'ellipse' && s.type === 'DIRT')) {
    const e = track.surfaces?.find((s) => s.shape === 'ellipse' && s.type === 'DIRT')
      || { cx: 480, cy: 320, rx: 310, ry: 210 };
    const roadW = track.roadWidth || 64;
    const midRx = e.rx - roadW / 2;
    const midRy = e.ry - roadW / 2 * (e.ry / e.rx);
    const pts = [];
    for (let i = 0; i <= 32; i++) {
      const t = (i / 32) * Math.PI * 2;
      pts.push({ x: e.cx + Math.cos(t) * midRx, y: e.cy + Math.sin(t) * midRy });
    }
    return pts;
  }
  return track.waypoints || [];
}
