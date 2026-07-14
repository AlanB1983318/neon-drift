import * as THREE from 'three';
import { SURFACE, CANVAS_W, CANVAS_H } from './utils.js?v=16';

const SCALE = 0.12;
const CX = CANVAS_W / 2;
const CY = CANVAS_H / 2;

function gx(x) { return (x - CX) * SCALE; }
function gz(y) { return (y - CY) * SCALE; }

const MAT_CACHE = {};
export function clearMatCache() {
  for (const m of Object.values(MAT_CACHE)) m.dispose?.();
  for (const k of Object.keys(MAT_CACHE)) delete MAT_CACHE[k];
}

function mat(key, factory) {
  if (!MAT_CACHE[key]) MAT_CACHE[key] = factory();
  return MAT_CACHE[key];
}

function roadDeckMaterial() {
  return mat('road-deck', () => new THREE.MeshBasicMaterial({
    color: 0x7a7a7a,
    side: THREE.DoubleSide,
  }));
}

function shoulderMaterial() {
  return mat('shoulder', () => new THREE.MeshLambertMaterial({ color: 0x8a7a58 }));
}

export function buildGrassBase(textures) {
  const geo = new THREE.PlaneGeometry(CANVAS_W * SCALE, CANVAS_H * SCALE, 1, 1);
  const mesh = new THREE.Mesh(geo, mat('grass', () => new THREE.MeshLambertMaterial({
    color: 0x2d6b28,
    map: textures.grass,
  })));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -0.02;
  return mesh;
}

function subdividePath(wps, closed, spacing = 14) {
  const pts = [];
  const n = wps.length;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = wps[i];
    const b = wps[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const steps = Math.max(2, Math.ceil(len / spacing));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      pts.push({ x: a.x + dx * t, y: a.y + dy * t });
    }
  }
  if (!closed) pts.push({ x: wps[n - 1].x, y: wps[n - 1].y });
  return pts;
}

function tangentAt(points, i) {
  const p = points[i];
  let tx, ty;
  if (i < points.length - 1) {
    tx = points[i + 1].x - p.x;
    ty = points[i + 1].y - p.y;
  } else {
    tx = p.x - points[i - 1].x;
    ty = p.y - points[i - 1].y;
  }
  const len = Math.sqrt(tx * tx + ty * ty) || 1;
  return { tx: tx / len, ty: ty / len, nx: -ty / len, ny: tx / len };
}

function buildStripMesh(points, halfOffset, width, y, material) {
  const verts = [];
  const indices = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const { nx, ny } = tangentAt(points, i);
    const ox = p.x + nx * halfOffset;
    const oy = p.y + ny * halfOffset;
    const px = -ny * width * 0.5;
    const py = nx * width * 0.5;
    const base = verts.length / 3;
    verts.push(gx(ox - px), y, gz(oy - py));
    verts.push(gx(ox + px), y, gz(oy + py));
    if (i > 0) {
      const prev = base - 2;
      indices.push(prev, prev + 1, base + 1, prev, base + 1, base);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

function buildRibbonMesh(points, halfRoad, halfShoulder, textures) {
  const group = new THREE.Group();
  const totalHalf = halfRoad + halfShoulder;
  const deckVerts = [];
  const deckUvs = [];
  const deckIndices = [];
  const shoulderVerts = [];
  const shoulderIndices = [];
  let distU = 0;
  const uScale = 0.05;
  const deckY = 0.22;
  const shoulderY = 0.14;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const { nx, ny, tx, ty } = tangentAt(points, i);
    const segLen = Math.sqrt(tx * tx + ty * ty) || 1;

    const leftOut = { x: p.x + nx * totalHalf, y: p.y + ny * totalHalf };
    const leftEdge = { x: p.x + nx * halfRoad, y: p.y + ny * halfRoad };
    const rightEdge = { x: p.x - nx * halfRoad, y: p.y - ny * halfRoad };
    const rightOut = { x: p.x - nx * totalHalf, y: p.y - ny * totalHalf };

    const deckBase = deckVerts.length / 3;
    deckVerts.push(gx(leftEdge.x), deckY, gz(leftEdge.y));
    deckVerts.push(gx(rightEdge.x), deckY, gz(rightEdge.y));
    deckUvs.push(distU * uScale, 0, distU * uScale, 1);

    const shBase = shoulderVerts.length / 3;
    shoulderVerts.push(gx(leftOut.x), shoulderY, gz(leftOut.y));
    shoulderVerts.push(gx(leftEdge.x), shoulderY, gz(leftEdge.y));
    shoulderVerts.push(gx(rightEdge.x), shoulderY, gz(rightEdge.y));
    shoulderVerts.push(gx(rightOut.x), shoulderY, gz(rightOut.y));

    if (i > 0) distU += segLen;

    if (i > 0) {
      const prev = deckBase - 2;
      deckIndices.push(prev, prev + 1, deckBase + 1, prev, deckBase + 1, deckBase);
      const sp = shBase - 4;
      shoulderIndices.push(sp, sp + 1, shBase + 1, sp, shBase + 1, shBase);
      shoulderIndices.push(sp + 2, sp + 3, shBase + 3, sp + 2, shBase + 3, shBase + 2);
    }
  }

  const deckGeo = new THREE.BufferGeometry();
  deckGeo.setAttribute('position', new THREE.Float32BufferAttribute(deckVerts, 3));
  deckGeo.setAttribute('uv', new THREE.Float32BufferAttribute(deckUvs, 2));
  deckGeo.setIndex(deckIndices);
  deckGeo.computeVertexNormals();
  group.add(new THREE.Mesh(deckGeo, roadDeckMaterial()));

  const shoulderGeo = new THREE.BufferGeometry();
  shoulderGeo.setAttribute('position', new THREE.Float32BufferAttribute(shoulderVerts, 3));
  shoulderGeo.setIndex(shoulderIndices);
  shoulderGeo.computeVertexNormals();
  group.add(new THREE.Mesh(shoulderGeo, shoulderMaterial()));

  return group;
}

export function buildRoad(track, textures) {
  const wps = track.waypoints;
  if (!wps || wps.length < 2) return new THREE.Group();

  const halfRoad = (track.roadWidth || 58) / 2;
  const halfShoulder = track.shoulderWidth || 14;
  const closed = track.roadClosed !== false;
  const points = subdividePath(wps, closed, 8);
  return buildRibbonMesh(points, halfRoad, halfShoulder, textures);
}

export function buildRoadMarkings(track) {
  const group = new THREE.Group();
  const wps = track.waypoints;
  if (!wps || wps.length < 2) return group;

  const halfRoad = (track.roadWidth || 58) / 2;
  const closed = track.roadClosed !== false;
  const points = subdividePath(wps, closed, 10);
  const lineY = 0.235;
  const lineW = 0.28;

  const whiteMat = mat('line-white', () => new THREE.MeshLambertMaterial({ color: 0xffffff }));
  const yellowMat = mat('line-yellow', () => new THREE.MeshLambertMaterial({ color: 0xf5d020 }));
  const curbRed = mat('curb-red', () => new THREE.MeshLambertMaterial({ color: 0xdd2222 }));
  const curbWhite = mat('curb-white', () => new THREE.MeshLambertMaterial({ color: 0xeeeeee }));

  group.add(buildStripMesh(points, halfRoad - 1.5, lineW, lineY, whiteMat));
  group.add(buildStripMesh(points, -(halfRoad - 1.5), lineW, lineY, whiteMat));

  for (let i = 0; i < points.length; i += 12) {
    const p = points[i];
    const { tx, ty } = tangentAt(points, i);
    const dash = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.04, lineW * 0.9),
      yellowMat
    );
    dash.position.set(gx(p.x), lineY, gz(p.y));
    dash.rotation.y = Math.atan2(tx, ty);
    group.add(dash);
  }

  for (let i = 0; i < points.length; i += 4) {
    const p = points[i];
    const { nx, ny, tx, ty } = tangentAt(points, i);
    const angle = Math.atan2(tx, ty);
    const isRed = Math.floor(i / 4) % 2 === 0;
    const curbMat = isRed ? curbRed : curbWhite;

    for (const side of [1, -1]) {
      const offset = side * (halfRoad + 5);
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.16, 0.32), curbMat);
      curb.position.set(gx(p.x + nx * offset), 0.19, gz(p.y + ny * offset));
      curb.rotation.y = angle;
      group.add(curb);
    }
  }

  return group;
}

export function buildHazardPatches(track, textures) {
  const group = new THREE.Group();
  for (const surf of track.surfaces) {
    if (surf.type !== 'MUD' && surf.type !== 'ASPHALT') continue;
    const texKey = surf.type === 'MUD' ? 'mud' : 'tarmac';
    const surfaceMat = mat(`hazard-${surf.type}`, () => new THREE.MeshLambertMaterial({
      color: SURFACE[surf.type].color,
      map: textures[texKey] || textures.asphalt,
    }));

    if (surf.shape === 'ellipse') {
      const mesh = new THREE.Mesh(new THREE.CircleGeometry(1, 16), surfaceMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(gx(surf.cx), 0.205, gz(surf.cy));
      mesh.scale.set(surf.rx * SCALE, surf.ry * SCALE, 1);
      group.add(mesh);
    } else {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(surf.w * SCALE, surf.h * SCALE),
        surfaceMat
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(gx(surf.x + surf.w / 2), 0.205, gz(surf.y + surf.h / 2));
      group.add(mesh);
    }
  }
  return group;
}

export function buildSimpleBarrier(wall) {
  const w = wall.w * SCALE;
  const h = wall.h * SCALE;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, 1.0, h),
    mat('barrier', () => new THREE.MeshLambertMaterial({ color: 0x3a3a3a }))
  );
  mesh.position.set(gx(wall.x + wall.w / 2), 0.5, gz(wall.y + wall.h / 2));
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(w * 1.02, 0.95, h * 1.02),
    mat('barrier-stripe', () => new THREE.MeshLambertMaterial({ color: 0xcc2222 }))
  );
  stripe.position.copy(mesh.position);
  stripe.position.y = 0.55;
  const group = new THREE.Group();
  group.add(mesh, stripe);
  return group;
}

export function buildStartGrid(start) {
  const angle = -start.angle + Math.PI / 2;
  const verts = [];
  const indices = [];
  const colors = [];

  for (let i = 0; i < 12; i++) {
    const offset = (i - 5.5) * 0.68;
    const cx = gx(start.x) + Math.sin(angle) * offset;
    const cz = gz(start.y) + Math.cos(angle) * offset;
    const hw = 0.675;
    const hd = 0.3;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const base = verts.length / 3;
    const c = i % 2 === 0 ? 1 : 0.07;
    for (const [lx, lz] of [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]]) {
      verts.push(cx + lx * cos - lz * sin, 0.22, cz + lx * sin + lz * cos);
      colors.push(c, c, c);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat('grid', () => new THREE.MeshLambertMaterial({ vertexColors: true })));
}

export function buildWaterPool(surf) {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(1, 10),
    mat('water', () => new THREE.MeshLambertMaterial({
      color: 0x3a78a8,
      transparent: true,
      opacity: 0.75,
    }))
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(gx(surf.cx || surf.x + surf.w / 2), 0.04, gz(surf.cy || surf.y + surf.h / 2));
  if (surf.shape === 'ellipse') {
    mesh.scale.set(surf.rx * SCALE, surf.ry * SCALE, 1);
  } else {
    mesh.scale.set(surf.w * SCALE * 0.5, surf.h * SCALE * 0.5, 1);
  }
  return mesh;
}

export const buildTerrain = buildGrassBase;
export const buildTrackOverlay = buildRoad;
export const buildRacingLine = buildRoadMarkings;
export const buildRacingSurfaces = buildHazardPatches;
export const buildTireBarrier = buildSimpleBarrier;
export function buildFenceAlongEllipse() { return new THREE.Group(); }
