import * as THREE from 'three';
import { SURFACE, CANVAS_W, CANVAS_H } from './utils.js?v=14';

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

function roadMaterial(textures, key = 'road') {
  const tex = textures[key] || textures.road || textures.dirt;
  return mat(`road-mat-${key}`, () => new THREE.MeshLambertMaterial({
    map: tex,
    color: 0xffffff,
  }));
}

export function buildGrassBase(textures) {
  const geo = new THREE.PlaneGeometry(CANVAS_W * SCALE, CANVAS_H * SCALE, 1, 1);
  const mesh = new THREE.Mesh(geo, mat('grass', () => new THREE.MeshLambertMaterial({
    color: 0x3a7535,
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

function buildRibbonMesh(points, halfRoad, halfShoulder, textures) {
  const totalHalf = halfRoad + halfShoulder;
  const verts = [];
  const uvs = [];
  const indices = [];
  let distU = 0;
  const uScale = 0.035;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    let tx, ty;
    if (i < points.length - 1) {
      tx = points[i + 1].x - p.x;
      ty = points[i + 1].y - p.y;
    } else {
      tx = p.x - points[i - 1].x;
      ty = p.y - points[i - 1].y;
    }
    const segLen = Math.sqrt(tx * tx + ty * ty) || 1;
    const nx = -ty / segLen;
    const ny = tx / segLen;

    const leftOut = { x: p.x + nx * totalHalf, y: p.y + ny * totalHalf };
    const leftEdge = { x: p.x + nx * halfRoad, y: p.y + ny * halfRoad };
    const rightEdge = { x: p.x - nx * halfRoad, y: p.y - ny * halfRoad };
    const rightOut = { x: p.x - nx * totalHalf, y: p.y - ny * totalHalf };

    const push = (gp, v, y) => {
      verts.push(gx(gp.x), y, gz(gp.y));
      uvs.push(distU * uScale, v);
    };

    const base = verts.length / 3;
    push(leftOut, 0.02, 0.11);
    push(leftEdge, 0.14, 0.16);
    push(rightEdge, 0.86, 0.16);
    push(rightOut, 0.98, 0.11);

    if (i > 0) distU += segLen;

    if (i > 0) {
      const prev = base - 4;
      indices.push(prev, prev + 1, base + 1, prev, base + 1, base);
      indices.push(prev + 1, prev + 2, base + 2, prev + 1, base + 2, base + 1);
      indices.push(prev + 2, prev + 3, base + 3, prev + 2, base + 3, base + 2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, roadMaterial(textures));
}

function buildBankedRing(cx, cz, innerRx, innerRy, outerRx, outerRy, segments, material, baseHeight) {
  const verts = [];
  const uvs = [];
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const cos = Math.cos(t);
    const sin = Math.sin(t);
    const bank = Math.abs(Math.sin(t * 2)) * 0.05;
    const crown = Math.cos(t * 2) * 0.02;
    const h = baseHeight + bank;
    verts.push(
      cx + cos * innerRx, h + crown, cz + sin * innerRy,
      cx + cos * outerRx, h + crown * 0.5, cz + sin * outerRy
    );
    uvs.push(i / segments * 6, 0.14, i / segments * 6, 0.86);
  }
  const indices = [];
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

function buildEllipticalRoad(surf, track, textures) {
  const roadW = track.roadWidth || 64;
  const shoulder = track.shoulderWidth || 12;
  const innerRx = (surf.rx - roadW - shoulder) * SCALE;
  const innerRy = (surf.ry - (roadW + shoulder) * (surf.ry / surf.rx)) * SCALE;
  const outerRx = (surf.rx - 4) * SCALE;
  const outerRy = (surf.ry - 4 * (surf.ry / surf.rx)) * SCALE;
  const segments = 48;
  return buildBankedRing(
    gx(surf.cx), gz(surf.cy),
    innerRx, innerRy, outerRx, outerRy,
    segments, roadMaterial(textures), 0.16
  );
}

export function buildRoad(track, textures) {
  const ellipse = track.surfaces?.find((s) => s.type === 'DIRT' && s.shape === 'ellipse');
  if (ellipse || track.roadShape === 'oval') {
    const surf = ellipse || { cx: 480, cy: 320, rx: 310, ry: 210 };
    return buildEllipticalRoad(surf, track, textures);
  }

  const wps = track.waypoints;
  if (!wps || wps.length < 2) return new THREE.Group();

  const halfRoad = (track.roadWidth || 58) / 2;
  const halfShoulder = track.shoulderWidth || 12;
  const closed = track.roadClosed !== false;
  const points = subdividePath(wps, closed, 10);
  return buildRibbonMesh(points, halfRoad, halfShoulder, textures);
}

function buildMarkingStrip(points, halfOffset, y, width, height, material, flipV = false) {
  const verts = [];
  const uvs = [];
  const indices = [];
  let distU = 0;

  for (let i = 0; i < points.length; i++) {
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
    const nx = -ty / len;
    const ny = tx / len;
    const ox = p.x + nx * halfOffset;
    const oy = p.y + ny * halfOffset;
    const px = -ny * width * 0.5;
    const py = nx * width * 0.5;

    const base = verts.length / 3;
    verts.push(gx(ox - px), y, gz(oy - py));
    verts.push(gx(ox + px), y, gz(oy + py));
    uvs.push(distU * 0.04, flipV ? 1 : 0, distU * 0.04, flipV ? 0 : 1);
    if (i > 0) distU += len;
    if (i > 0) {
      const prev = base - 2;
      indices.push(prev, prev + 1, base + 1, prev, base + 1, base);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

export function buildRoadMarkings(track) {
  const group = new THREE.Group();
  const wps = track.waypoints;
  if (!wps || wps.length < 2) return group;

  const halfRoad = (track.roadWidth || 58) / 2;
  const closed = track.roadClosed !== false;
  const points = subdividePath(wps, closed, 16);
  const curbMat = mat('curb', () => new THREE.MeshLambertMaterial({ color: 0xdd2222 }));
  const curbH = 0.14;

  const ellipse = track.surfaces?.find((s) => s.type === 'DIRT' && s.shape === 'ellipse');
  if (ellipse || track.roadShape === 'oval') {
    const surf = ellipse || { cx: 480, cy: 320, rx: 310, ry: 210 };
    const curbRx = (surf.rx - 2) * SCALE;
    const curbRy = (surf.ry - 2) * SCALE;
    const segments = 48;
    for (let i = 0; i < segments; i += 3) {
      const t = (i / segments) * Math.PI * 2;
      const curb = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, curbH, 0.28),
        i % 6 < 3 ? curbMat : mat('curb-w', () => new THREE.MeshLambertMaterial({ color: 0xeeeeee }))
      );
      curb.position.set(
        gx(surf.cx) + Math.cos(t) * curbRx,
        0.17,
        gz(surf.cy) + Math.sin(t) * curbRy
      );
      curb.rotation.y = -t + Math.PI / 2;
      group.add(curb);
    }
    return group;
  }

  group.add(buildMarkingStrip(points, halfRoad + 2, 0.17, 0.35, 0.12, curbMat));
  group.add(buildMarkingStrip(points, -(halfRoad + 2), 0.17, 0.35, 0.12, curbMat, true));

  for (let i = 0; i < points.length; i += 18) {
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
    const nx = -ty / len;
    const ny = tx / len;
    const angle = Math.atan2(ty, tx);
    const curb = new THREE.Mesh(new THREE.BoxGeometry(0.55, curbH, 0.3), curbMat);
    curb.position.set(gx(p.x + nx * (halfRoad + 4)), 0.17, gz(p.y + ny * (halfRoad + 4)));
    curb.rotation.y = angle;
    group.add(curb);
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
      mesh.position.set(gx(surf.cx), 0.165, gz(surf.cy));
      mesh.scale.set(surf.rx * SCALE, surf.ry * SCALE, 1);
      group.add(mesh);
    } else {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(surf.w * SCALE, surf.h * SCALE),
        surfaceMat
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(gx(surf.x + surf.w / 2), 0.165, gz(surf.y + surf.h / 2));
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
      verts.push(cx + lx * cos - lz * sin, 0.19, cz + lx * sin + lz * cos);
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
