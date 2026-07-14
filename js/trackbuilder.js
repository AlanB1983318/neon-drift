import * as THREE from 'three';
import { SURFACE, CANVAS_W, CANVAS_H } from './utils.js?v=12';
import { getSurfaceAt } from './tracks.js?v=12';

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

export function buildGrassBase(textures) {
  const geo = new THREE.PlaneGeometry(CANVAS_W * SCALE, CANVAS_H * SCALE, 1, 1);
  const mesh = new THREE.Mesh(geo, mat('grass', () => new THREE.MeshLambertMaterial({
    color: 0x3d7a35,
    map: textures.grass,
  })));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0;
  return mesh;
}

export function buildRacingSurfaces(track, textures) {
  const group = new THREE.Group();

  for (const surf of track.surfaces) {
    if (surf.type === 'GRASS' || surf.type === 'WATER') continue;

    const texKey = { DIRT: 'dirt', MUD: 'mud', ASPHALT: 'asphalt' }[surf.type];
    const surfaceMat = mat(`surf-${surf.type}`, () => new THREE.MeshLambertMaterial({
      color: SURFACE[surf.type].color,
      map: texKey ? textures[texKey] : null,
    }));

    if (surf.shape === 'ellipse') {
      if (surf.type === 'DIRT') {
        const segments = 40;
        const innerRx = (surf.rx - 20) * SCALE;
        const innerRy = (surf.ry - 20) * SCALE;
        const outerRx = surf.rx * SCALE;
        const outerRy = surf.ry * SCALE;
        group.add(buildBankedRing(
          gx(surf.cx), gz(surf.cy),
          innerRx, innerRy, outerRx, outerRy,
          segments, surfaceMat, 0.16
        ));
      } else {
        const mesh = new THREE.Mesh(new THREE.CircleGeometry(1, 20), surfaceMat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(gx(surf.cx), 0.14, gz(surf.cy));
        mesh.scale.set(surf.rx * SCALE, surf.ry * SCALE, 1);
        group.add(mesh);
      }
    } else {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(surf.w * SCALE, surf.h * SCALE),
        surfaceMat
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(gx(surf.x + surf.w / 2), 0.14, gz(surf.y + surf.h / 2));
      group.add(mesh);
    }
  }

  return group;
}

function buildBankedRing(cx, cz, innerRx, innerRy, outerRx, outerRy, segments, material, baseHeight) {
  const verts = [];
  const uvs = [];

  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const cos = Math.cos(t);
    const sin = Math.sin(t);
    const bank = Math.abs(Math.sin(t * 2)) * 0.06;
    const crown = Math.cos(t * 2) * 0.025;
    const h = baseHeight + bank;
    verts.push(
      cx + cos * innerRx, h + crown, cz + sin * innerRy,
      cx + cos * outerRx, h + crown * 0.5, cz + sin * outerRy
    );
    uvs.push(i / segments, 0, i / segments, 1);
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

export function buildRacingLine(track) {
  const group = new THREE.Group();
  const wps = track.waypoints;
  if (!wps || wps.length < 2) return group;

  const lineMat = mat('line', () => new THREE.MeshLambertMaterial({ color: 0xf0f0f0 }));
  const curbRed = mat('curb-r', () => new THREE.MeshLambertMaterial({ color: 0xdd2222 }));
  const curbWhite = mat('curb-w', () => new THREE.MeshLambertMaterial({ color: 0xeeeeee }));
  const edgeMat = mat('edge', () => new THREE.MeshLambertMaterial({ color: 0xcccccc }));

  const trackWidth = track.trackWidth || 58;

  for (let i = 0; i < wps.length; i++) {
    const a = wps[i];
    const b = wps[(i + 1) % wps.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const steps = Math.max(2, Math.floor(len / 28));
    const px = -dy / len;
    const py = dx / len;
    const angle = Math.atan2(dy, dx);

    for (let s = 0; s < steps; s++) {
      const t = (s + 0.5) / steps;
      const wx = a.x + dx * t;
      const wy = a.y + dy * t;

      if (s % 2 === 0) {
        const dash = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 0.1), lineMat);
        dash.position.set(gx(wx), 0.17, gz(wy));
        dash.rotation.y = angle;
        group.add(dash);
      }

      if (s === Math.floor(steps / 2) && i % 2 === 0) {
        const offset = trackWidth * 0.46;
        for (const [side, cMat] of [[-1, curbRed], [1, curbWhite]]) {
          const curb = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 0.22), cMat);
          curb.position.set(gx(wx + px * offset * side), 0.16, gz(wy + py * offset * side));
          curb.rotation.y = angle;
          group.add(curb);
        }
      }
    }

    if (i % 2 === 0) {
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const edgeOff = trackWidth * 0.48;
      for (const side of [-1, 1]) {
        const edge = new THREE.Mesh(new THREE.BoxGeometry(len * SCALE * 0.95, 0.06, 0.14), edgeMat);
        edge.position.set(gx(mx + px * edgeOff * side), 0.155, gz(my + py * edgeOff * side));
        edge.rotation.y = angle;
        group.add(edge);
      }
    }
  }

  return group;
}

export function buildSimpleBarrier(wall) {
  const w = wall.w * SCALE;
  const h = wall.h * SCALE;
  const isHoriz = w > h;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.9, h),
    mat('barrier', () => new THREE.MeshLambertMaterial({ color: 0x2a2a2a }))
  );
  mesh.position.set(gx(wall.x + wall.w / 2), 0.45, gz(wall.y + wall.h / 2));
  return mesh;
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
    const corners = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
    for (const [lx, lz] of corners) {
      verts.push(cx + lx * cos - lz * sin, 0.17, cz + lx * sin + lz * cos);
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
    new THREE.CircleGeometry(1, 12),
    mat('water', () => new THREE.MeshLambertMaterial({
      color: 0x3a78a8,
      transparent: true,
      opacity: 0.75,
    }))
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(gx(surf.cx || surf.x + surf.w / 2), 0.03, gz(surf.cy || surf.y + surf.h / 2));
  if (surf.shape === 'ellipse') {
    mesh.scale.set(surf.rx * SCALE, surf.ry * SCALE, 1);
  } else {
    mesh.scale.set(surf.w * SCALE * 0.5, surf.h * SCALE * 0.5, 1);
  }
  return mesh;
}

// Legacy exports for compatibility
export const buildTerrain = buildGrassBase;
export const buildTrackOverlay = buildRacingSurfaces;
export const buildTireBarrier = buildSimpleBarrier;
export function buildFenceAlongEllipse() { return new THREE.Group(); }
