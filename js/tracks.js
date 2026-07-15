import { SURFACE, dist, clamp, CANVAS_W, CANVAS_H } from './utils.js?v=38';
import { boxesFromWaypoints, coinsFromWaypoints } from './items.js?v=38';

function distToWaypointRoad(waypoints, x, y, roadWidth = 58) {
  if (!waypoints?.length) return Infinity;
  const half = roadWidth / 2 + 18;
  const closed = true;
  const segs = waypoints.length;
  let minD = Infinity;
  for (let i = 0; i < segs; i++) {
    const a = waypoints[i];
    const b = waypoints[(i + 1) % waypoints.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) {
      minD = Math.min(minD, dist(x, y, a.x, a.y));
      continue;
    }
    let t = ((x - a.x) * dx + (y - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    minD = Math.min(minD, dist(x, y, a.x + t * dx, a.y + t * dy));
  }
  return minD - half;
}

function scatterForest(waypoints, count = 36, roadWidth = 58) {
  const decorations = [];
  let attempts = 0;
  while (decorations.length < count && attempts < count * 12) {
    attempts++;
    const x = 24 + Math.random() * (CANVAS_W - 48);
    const y = 24 + Math.random() * (CANVAS_H - 48);
    if (distToWaypointRoad(waypoints, x, y, roadWidth) < 12) continue;
    const roll = Math.random();
    const type = roll < 0.55 ? 'pine' : roll < 0.85 ? 'tree' : 'bush';
    decorations.push({
      type,
      x,
      y,
      scale: 0.55 + Math.random() * 0.75,
    });
  }
  return decorations;
}

function ringMountains() {
  return [
    { type: 'mountain', x: 70, y: 120, scale: 2.2 },
    { type: 'mountain', x: 180, y: 55, scale: 1.8 },
    { type: 'mountain', x: 480, y: 35, scale: 2.6 },
    { type: 'mountain', x: 780, y: 55, scale: 2.0 },
    { type: 'mountain', x: 890, y: 130, scale: 2.4 },
    { type: 'mountain', x: 900, y: 480, scale: 2.1 },
    { type: 'mountain', x: 820, y: 580, scale: 1.7 },
    { type: 'mountain', x: 480, y: 610, scale: 2.3 },
    { type: 'mountain', x: 140, y: 580, scale: 1.9 },
    { type: 'mountain', x: 50, y: 460, scale: 2.5 },
    { type: 'mountain', x: 60, y: 280, scale: 1.6 },
    { type: 'mountain', x: 880, y: 300, scale: 1.8 },
  ];
}

function makeTrack(config) {
  const waypoints = config.waypoints;
  const checkpoints = config.checkpointIndices
    ? checkpointsAlongWaypoints(waypoints, config.checkpointIndices, config.checkpointRadii)
    : config.checkpoints;
  const manualDecor = config.decorations || [];
  const autoDecor = config.autoScenery === false
    ? []
    : scatterForest(waypoints, config.sceneryCount ?? 34, config.roadWidth || 58);
  return {
    name: config.name,
    description: config.description,
    surfaces: config.surfaces,
    walls: config.walls,
    checkpoints,
    waypoints,
    starts: config.starts,
    decorations: [...ringMountains(), ...manualDecor, ...autoDecor],
    itemBoxes: config.itemBoxes || boxesFromWaypoints(waypoints, 3),
    coins: config.coins || coinsFromWaypoints(waypoints, 2),
    roadWidth: config.roadWidth || 58,
    shoulderWidth: config.shoulderWidth || 10,
    roadType: config.roadType || 'DIRT',
    roadClosed: config.roadClosed !== false,
    roadShape: config.roadShape || null,
    showRouteArrows: config.showRouteArrows !== false,
  };
}

function checkpointsAlongWaypoints(waypoints, indices, radii = []) {
  return indices.map((i, idx) => {
    const wp = waypoints[i];
    if (!wp) {
      throw new Error(`Track checkpoint index ${i} is missing (only ${waypoints.length} waypoints).`);
    }
    return {
      x: wp.x,
      y: wp.y,
      radius: radii[idx] ?? 55,
    };
  });
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
    description: 'Long winding circuit — plenty of corners to master.',
    roadWidth: 62,
    roadType: 'DIRT',
    surfaces: [
      { type: 'GRASS', x: 0, y: 0, w: 960, h: 640 },
      { type: 'MUD', x: 420, y: 280, w: 120, h: 90 },
      { type: 'ASPHALT', x: 130, y: 380, w: 90, h: 60 },
      { type: 'ASPHALT', x: 740, y: 180, w: 90, h: 60 },
    ],
    walls: [
      { x: 350, y: 250, w: 70, h: 22 },
      { x: 540, y: 400, w: 70, h: 22 },
      { x: 200, y: 160, w: 22, h: 60 },
    ],
    checkpointIndices: [0, 5, 10, 15, 18],
    waypoints: [
      { x: 480, y: 510 }, { x: 400, y: 495 }, { x: 310, y: 460 }, { x: 220, y: 400 },
      { x: 160, y: 320 }, { x: 140, y: 240 }, { x: 160, y: 170 }, { x: 230, y: 120 },
      { x: 330, y: 90 }, { x: 440, y: 80 }, { x: 550, y: 90 }, { x: 660, y: 120 },
      { x: 750, y: 175 }, { x: 810, y: 250 }, { x: 820, y: 340 }, { x: 780, y: 420 },
      { x: 690, y: 480 }, { x: 590, y: 510 }, { x: 480, y: 510 },
    ],
    starts: [
      { x: 430, y: 485, angle: -Math.PI / 2 },
      { x: 455, y: 498, angle: -Math.PI / 2 },
      { x: 480, y: 505, angle: -Math.PI / 2 },
      { x: 505, y: 498, angle: -Math.PI / 2 },
    ],
    decorations: [
      { type: 'grandstand', x: 480, y: 55, scale: 1.3 },
      { type: 'cone', x: 100, y: 140 }, { type: 'cone', x: 860, y: 140 },
      { type: 'tire', x: 140, y: 530, scale: 1.2 }, { type: 'tire', x: 820, y: 530, scale: 1.2 },
      { type: 'tree', x: 50, y: 280 }, { type: 'tree', x: 910, y: 280 },
    ],
  }),

  makeTrack({
    name: 'Mud Bog',
    description: 'Follow the roadside signs — stay on the outer loop around the swamp.',
    roadWidth: 60,
    sceneryCount: 42,
    surfaces: [
      { type: 'GRASS', x: 0, y: 0, w: 960, h: 640 },
      { type: 'MUD', x: 380, y: 280, w: 200, h: 120 },
      { type: 'WATER', x: 440, y: 310, w: 80, h: 50 },
      { type: 'ASPHALT', x: 120, y: 250, w: 70, h: 60 },
      { type: 'ASPHALT', x: 770, y: 250, w: 70, h: 60 },
    ],
    walls: [
      { x: 100, y: 60, w: 760, h: 20 },
      { x: 100, y: 560, w: 760, h: 20 },
      { x: 100, y: 60, w: 20, h: 520 },
      { x: 840, y: 60, w: 20, h: 520 },
      { x: 300, y: 180, w: 22, h: 70 },
      { x: 640, y: 380, w: 22, h: 70 },
      { x: 350, y: 255, w: 260, h: 18 },
      { x: 350, y: 405, w: 260, h: 18 },
      { x: 340, y: 265, w: 18, h: 150 },
      { x: 602, y: 265, w: 18, h: 150 },
    ],
    checkpointIndices: [0, 4, 8, 12, 16],
    waypoints: [
      { x: 480, y: 520 }, { x: 380, y: 505 }, { x: 280, y: 470 }, { x: 200, y: 410 },
      { x: 150, y: 330 }, { x: 155, y: 250 }, { x: 200, y: 180 }, { x: 290, y: 130 },
      { x: 400, y: 105 }, { x: 520, y: 100 }, { x: 640, y: 120 }, { x: 730, y: 170 },
      { x: 790, y: 250 }, { x: 800, y: 330 }, { x: 760, y: 410 }, { x: 680, y: 470 },
      { x: 580, y: 510 }, { x: 480, y: 520 },
    ],
    starts: [
      { x: 420, y: 500, angle: -Math.PI / 2 },
      { x: 445, y: 510, angle: -Math.PI / 2 },
      { x: 470, y: 518, angle: -Math.PI / 2 },
      { x: 495, y: 510, angle: -Math.PI / 2 },
    ],
    decorations: [
      { type: 'cone', x: 500, y: 450 }, { type: 'cone', x: 460, y: 450 },
      { type: 'rock', x: 330, y: 170 }, { type: 'rock', x: 630, y: 420 },
    ],
  }),

  makeTrack({
    name: 'Crossover',
    description: 'Classic figure-eight — cross the bridge at centre, loop top then bottom.',
    roadWidth: 56,
    roadType: 'DIRT',
    surfaces: [
      { type: 'GRASS', x: 0, y: 0, w: 960, h: 640 },
      { type: 'ASPHALT', x: 430, y: 285, w: 100, h: 70 },
      { type: 'MUD', x: 130, y: 400, w: 70, h: 60 },
      { type: 'MUD', x: 760, y: 400, w: 70, h: 60 },
    ],
    walls: [
      { x: 60, y: 40, w: 820, h: 20 },
      { x: 60, y: 560, w: 820, h: 20 },
      { x: 60, y: 40, w: 20, h: 540 },
      { x: 860, y: 40, w: 20, h: 540 },
    ],
    checkpointIndices: [0, 4, 8, 12, 16, 20],
    checkpointRadii: [52, 52, 52, 52, 52, 52],
    waypoints: [
      { x: 480, y: 540 }, { x: 370, y: 520 }, { x: 260, y: 470 }, { x: 210, y: 400 },
      { x: 220, y: 330 }, { x: 300, y: 285 }, { x: 400, y: 305 }, { x: 480, y: 320 },
      { x: 560, y: 305 }, { x: 660, y: 270 }, { x: 740, y: 210 }, { x: 720, y: 140 },
      { x: 620, y: 100 }, { x: 480, y: 95 }, { x: 340, y: 100 }, { x: 240, y: 150 },
      { x: 220, y: 230 }, { x: 300, y: 295 }, { x: 400, y: 315 }, { x: 480, y: 320 },
      { x: 560, y: 335 }, { x: 660, y: 380 }, { x: 720, y: 450 }, { x: 680, y: 510 },
      { x: 580, y: 535 }, { x: 480, y: 540 },
    ],
    starts: [
      { x: 440, y: 525, angle: -Math.PI / 2 },
      { x: 465, y: 532, angle: -Math.PI / 2 },
      { x: 490, y: 538, angle: -Math.PI / 2 },
      { x: 515, y: 532, angle: -Math.PI / 2 },
    ],
    decorations: [
      { type: 'flag', x: 480, y: 320 },
      { type: 'cone', x: 455, y: 305 }, { type: 'cone', x: 505, y: 335 },
    ],
  }),

  makeTrack({
    name: 'Canyon Run',
    description: 'Two long straights linked by hairpins — a simple canyon loop.',
    roadWidth: 54,
    surfaces: [
      { type: 'GRASS', x: 0, y: 0, w: 960, h: 640 },
      { type: 'ASPHALT', x: 160, y: 385, w: 640, h: 55 },
      { type: 'ASPHALT', x: 160, y: 205, w: 640, h: 55 },
      { type: 'MUD', x: 120, y: 250, w: 80, h: 140 },
      { type: 'MUD', x: 760, y: 250, w: 80, h: 140 },
    ],
    walls: [
      { x: 80, y: 160, w: 800, h: 20 },
      { x: 80, y: 460, w: 800, h: 20 },
      { x: 80, y: 160, w: 20, h: 320 },
      { x: 860, y: 160, w: 20, h: 320 },
    ],
    checkpointIndices: [0, 3, 6, 9, 12],
    waypoints: [
      { x: 160, y: 400 }, { x: 300, y: 395 }, { x: 480, y: 398 }, { x: 660, y: 400 },
      { x: 800, y: 400 }, { x: 840, y: 350 }, { x: 810, y: 290 }, { x: 720, y: 230 },
      { x: 560, y: 215 }, { x: 380, y: 218 }, { x: 200, y: 220 }, { x: 140, y: 270 },
      { x: 160, y: 340 }, { x: 160, y: 400 },
    ],
    starts: [
      { x: 140, y: 425, angle: 0 },
      { x: 140, y: 405, angle: 0 },
      { x: 140, y: 385, angle: 0 },
      { x: 140, y: 365, angle: 0 },
    ],
    decorations: [
      { type: 'rock', x: 480, y: 130 },
      { type: 'rock', x: 480, y: 500 },
      { type: 'grandstand', x: 480, y: 155 },
      { type: 'tire', x: 100, y: 390 },
    ],
  }),

  makeTrack({
    name: 'Grand Prix',
    description: 'The finale — fast straights, sweeping esses, full stadium lap.',
    roadWidth: 58,
    surfaces: [
      { type: 'GRASS', x: 0, y: 0, w: 960, h: 640 },
      { type: 'ASPHALT', x: 150, y: 455, w: 660, h: 58 },
      { type: 'ASPHALT', x: 280, y: 112, w: 400, h: 52 },
      { type: 'MUD', x: 130, y: 270, w: 100, h: 110 },
      { type: 'MUD', x: 730, y: 270, w: 100, h: 110 },
    ],
    walls: [
      { x: 120, y: 80, w: 720, h: 20 },
      { x: 120, y: 540, w: 720, h: 20 },
      { x: 120, y: 80, w: 20, h: 480 },
      { x: 820, y: 80, w: 20, h: 480 },
    ],
    checkpointIndices: [0, 4, 8, 12, 16],
    waypoints: [
      { x: 480, y: 500 }, { x: 380, y: 490 }, { x: 280, y: 460 }, { x: 200, y: 410 },
      { x: 160, y: 340 }, { x: 170, y: 260 }, { x: 220, y: 190 }, { x: 300, y: 145 },
      { x: 400, y: 125 }, { x: 520, y: 120 }, { x: 640, y: 135 }, { x: 720, y: 180 },
      { x: 770, y: 250 }, { x: 790, y: 320 }, { x: 760, y: 385 }, { x: 700, y: 430 },
      { x: 620, y: 465 }, { x: 550, y: 488 }, { x: 480, y: 500 },
    ],
    starts: [
      { x: 430, y: 478, angle: -Math.PI / 2 },
      { x: 455, y: 488, angle: -Math.PI / 2 },
      { x: 480, y: 495, angle: -Math.PI / 2 },
      { x: 505, y: 488, angle: -Math.PI / 2 },
    ],
    decorations: [
      { type: 'grandstand', x: 480, y: 60 },
      { type: 'flag', x: 480, y: 60 },
      { type: 'tire', x: 130, y: 530 },
    ],
    sceneryCount: 38,
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

export function getLoopLength(waypoints) {
  if (!waypoints?.length) return 0;
  if (waypoints.length < 2) return waypoints.length;
  const first = waypoints[0];
  const last = waypoints[waypoints.length - 1];
  if (dist(first.x, first.y, last.x, last.y) < 40) {
    return waypoints.length - 1;
  }
  return waypoints.length;
}

export function getRaceProgress(car, track) {
  const wps = track.waypoints;
  const loopLen = getLoopLength(wps);
  if (!loopLen) return car.lap * 1e6;

  const wpIndex = car.waypointIndex ?? car.checkpoint ?? 0;
  const next = wps[(wpIndex + 1) % loopLen];
  const cur = wps[wpIndex];
  const segLen = dist(cur.x, cur.y, next.x, next.y) || 1;
  const distToNext = dist(car.x, car.y, next.x, next.y);
  const segmentProg = clamp(1 - distToNext / segLen, 0, 1);

  return car.lap * 1e6 + wpIndex * 1e4 + segmentProg * 1e4;
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
