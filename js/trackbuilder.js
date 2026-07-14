import * as THREE from 'three';
import { SURFACE, CANVAS_W, CANVAS_H } from './utils.js?v=11';
import { getSurfaceAt } from './tracks.js?v=11';

const SCALE = 0.12;
const CX = CANVAS_W / 2;
const CY = CANVAS_H / 2;

function gx(x) { return (x - CX) * SCALE; }
function gz(y) { return (y - CY) * SCALE; }

const MAT_CACHE = {};
function mat(key, factory) {
  if (!MAT_CACHE[key]) MAT_CACHE[key] = factory();
  return MAT_CACHE[key];
}

function noise2(x, y) {
  return Math.sin(x * 0.08) * Math.cos(y * 0.07) * 0.5
    + Math.sin(x * 0.15 + 1.3) * Math.cos(y * 0.12 + 0.7) * 0.3
    + Math.sin(x * 0.03 + y * 0.04) * 0.2;
}

function getSurfaceHeight(type, x, y) {
  const n = noise2(x * 0.05, y * 0.05);
  switch (type) {
    case 'DIRT': return 0.12 + n * 0.04;
    case 'MUD': return 0.04 + n * 0.02;
    case 'WATER': return -0.08;
    case 'ASPHALT': return 0.14 + n * 0.01;
    default: return 0.02 + n * 0.12;
  }
}

function ellipseDist(cx, cy, rx, ry, x, y) {
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  return Math.sqrt(dx * dx + dy * dy);
}

export function buildTerrain(track, textures) {
  const segX = 48;
  const segZ = 32;
  const geo = new THREE.PlaneGeometry(CANVAS_W * SCALE, CANVAS_H * SCALE, segX, segZ);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const dirtSurf = track.surfaces.find((s) => s.type === 'DIRT' && s.shape === 'ellipse');

  for (let i = 0; i < pos.count; i++) {
    const wx = pos.getX(i) / SCALE + CX;
    const wy = CY - pos.getY(i) / SCALE;
    const type = getSurfaceAt(track, wx, wy);
    let h = getSurfaceHeight(type, wx, wy);

    if (dirtSurf && type === 'DIRT') {
      const d = ellipseDist(dirtSurf.cx, dirtSurf.cy, dirtSurf.rx, dirtSurf.ry, wx, wy);
      h += (1 - d) * 0.06;
    }

    pos.setZ(i, h);

    const col = new THREE.Color(SURFACE[type]?.color || SURFACE.GRASS.color);
    if (type === 'DIRT' && dirtSurf) {
      const wear = Math.max(0, 1 - ellipseDist(dirtSurf.cx, dirtSurf.cy, dirtSurf.rx * 0.6, dirtSurf.ry * 0.6, wx, wy)) * 0.15;
      col.offsetHSL(0, 0, -wear);
    }
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, mat('terrain', () => new THREE.MeshStandardMaterial({
    map: textures.grass,
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.02,
  })));
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  return mesh;
}

export function buildTrackOverlay(track, textures) {
  const group = new THREE.Group();

  for (const surf of track.surfaces) {
    if (surf.type === 'GRASS' || surf.type === 'WATER') continue;

    const texKey = { DIRT: 'dirt', MUD: 'mud', ASPHALT: 'asphalt' }[surf.type];
    const surfaceMat = mat(`surf-${surf.type}`, () => new THREE.MeshStandardMaterial({
      color: new THREE.Color(SURFACE[surf.type].color),
      map: texKey ? textures[texKey] : null,
      roughness: 0.88,
      metalness: 0.04,
    }));

    if (surf.shape === 'ellipse') {
      const segments = 48;
      const innerRx = (surf.rx - 18) * SCALE;
      const innerRy = (surf.ry - 18) * SCALE;
      const outerRx = surf.rx * SCALE;
      const outerRy = surf.ry * SCALE;

      if (surf.type === 'DIRT') {
        group.add(buildBankedRing(gx(surf.cx), gz(surf.cy), innerRx, innerRy, outerRx, outerRy, segments, surfaceMat, 0.14));

        const gravelMat = mat('gravel', () => new THREE.MeshStandardMaterial({
          color: 0x8a7858,
          map: textures.gravel || textures.dirt,
          roughness: 0.95,
        }));
        group.add(buildBankedRing(gx(surf.cx), gz(surf.cy), outerRx, outerRy, outerRx + 1.8, outerRy + 1.8, segments, gravelMat, 0.1));
        group.add(buildCurbs(gx(surf.cx), gz(surf.cy), outerRx + 1.8, outerRy + 1.8, segments));
      } else {
        const mesh = new THREE.Mesh(new THREE.CircleGeometry(1, 24), surfaceMat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(gx(surf.cx), 0.1, gz(surf.cy));
        mesh.scale.set(surf.rx * SCALE, surf.ry * SCALE, 1);
        mesh.receiveShadow = true;
        group.add(mesh);
      }
    } else {
      group.add(buildRectSurface(surf, surfaceMat));
      if (surf.type === 'DIRT') group.add(buildRectBerm(surf, textures));
      if (surf.type === 'ASPHALT') group.add(buildAsphaltMarkings(surf));
    }
  }

  return group;
}

function buildRectSurface(surf, material) {
  const segW = Math.max(2, Math.floor(surf.w * SCALE / 4));
  const segH = Math.max(2, Math.floor(surf.h * SCALE / 4));
  const geo = new THREE.PlaneGeometry(surf.w * SCALE, surf.h * SCALE, segW, segH);
  const pos = geo.attributes.position;
  const cx = surf.x + surf.w / 2;
  const cy = surf.y + surf.h / 2;

  for (let i = 0; i < pos.count; i++) {
    const wx = pos.getX(i) / SCALE + cx;
    const wy = cy - pos.getY(i) / SCALE;
    const edgeX = Math.min(wx - surf.x, surf.x + surf.w - wx) / surf.w;
    const edgeY = Math.min(wy - surf.y, surf.y + surf.h - wy) / surf.h;
    const edge = Math.min(edgeX, edgeY);
    const rut = Math.sin(wx * 0.12) * Math.cos(wy * 0.1) * 0.015;
    pos.setZ(i, 0.12 + edge * 0.06 + rut);
  }
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(gx(cx), 0.1, gz(cy));
  mesh.receiveShadow = true;
  return mesh;
}

function buildRectBerm(surf, textures) {
  const group = new THREE.Group();
  const bermMat = mat('berm', () => new THREE.MeshStandardMaterial({
    color: 0x7a6030,
    map: textures.dirt,
    roughness: 0.96,
  }));
  const bermW = 1.4;
  const cx = surf.x + surf.w / 2;
  const cy = surf.y + surf.h / 2;
  const sides = [
    { w: surf.w * SCALE + bermW * 2, h: bermW, ox: 0, oz: -(surf.h * SCALE / 2 + bermW / 2) },
    { w: surf.w * SCALE + bermW * 2, h: bermW, ox: 0, oz: surf.h * SCALE / 2 + bermW / 2 },
    { w: bermW, h: surf.h * SCALE, ox: -(surf.w * SCALE / 2 + bermW / 2), oz: 0 },
    { w: bermW, h: surf.h * SCALE, ox: surf.w * SCALE / 2 + bermW / 2, oz: 0 },
  ];
  for (const side of sides) {
    const berm = new THREE.Mesh(new THREE.BoxGeometry(side.w, 0.14, side.h), bermMat);
    berm.position.set(gx(cx) + side.ox, 0.08, gz(cy) + side.oz);
    berm.receiveShadow = true;
    group.add(berm);
  }
  return group;
}

function buildAsphaltMarkings(surf) {
  const lineMat = mat('asphalt-line', () => new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.5 }));
  const cx = surf.x + surf.w / 2;
  const cy = surf.y + surf.h / 2;
  const dash = new THREE.Mesh(
    new THREE.BoxGeometry(surf.w * SCALE * 0.6, 0.02, 0.12),
    lineMat
  );
  dash.position.set(gx(cx), 0.18, gz(cy));
  dash.receiveShadow = true;
  return dash;
}

function buildBankedRing(cx, cz, innerRx, innerRy, outerRx, outerRy, segments, material, baseHeight) {
  const geo = new THREE.BufferGeometry();
  const verts = [];
  const uvs = [];

  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const cos = Math.cos(t);
    const sin = Math.sin(t);
    const curvature = Math.abs(Math.sin(t * 2)) * 0.08;
    const bankH = baseHeight + curvature;
    const crown = Math.cos(t * 2) * 0.03;
    verts.push(
      cx + cos * innerRx, bankH + crown, cz + sin * innerRy,
      cx + cos * outerRx, bankH + crown * 0.5, cz + sin * outerRy
    );
    uvs.push(i / segments, 0, i / segments, 1);
  }

  const indices = [];
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  return mesh;
}

function buildCurbs(cx, cz, rx, ry, segments) {
  const redMat = mat('curb-red', () => new THREE.MeshStandardMaterial({ color: 0xdd2222, roughness: 0.6 }));
  const whiteMat = mat('curb-white', () => new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.6 }));
  const geo = new THREE.BoxGeometry(0.55, 0.18, 0.35);
  const redMesh = new THREE.InstancedMesh(geo, redMat, segments);
  const whiteMesh = new THREE.InstancedMesh(geo, whiteMat, segments);
  const dummy = new THREE.Object3D();
  let ri = 0;
  let wi = 0;

  for (let i = 0; i < segments; i += 4) {
    const t = (i / segments) * Math.PI * 2;
    dummy.position.set(cx + Math.cos(t) * rx, 0.2, cz + Math.sin(t) * ry);
    dummy.rotation.set(0, -t + Math.PI / 2, 0);
    dummy.updateMatrix();
    if (i % 8 < 4) redMesh.setMatrixAt(ri++, dummy.matrix);
    else whiteMesh.setMatrixAt(wi++, dummy.matrix);
  }

  redMesh.count = ri;
  whiteMesh.count = wi;
  redMesh.instanceMatrix.needsUpdate = true;
  whiteMesh.instanceMatrix.needsUpdate = true;

  const group = new THREE.Group();
  group.add(redMesh, whiteMesh);
  return group;
}

const TIRE_GEO = new THREE.TorusGeometry(0.32, 0.12, 6, 10);

export function buildTireBarrier(wall) {
  const w = wall.w * SCALE;
  const h = wall.h * SCALE;
  const cx = gx(wall.x + wall.w / 2);
  const cz = gz(wall.y + wall.h / 2);
  const isHoriz = w > h;
  const length = isHoriz ? w : h;
  const count = Math.min(20, Math.max(3, Math.floor(length / 1.0)));
  const rows = 2;
  const tireMat = mat('tire', () => new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95 }));
  const inst = new THREE.InstancedMesh(TIRE_GEO, tireMat, count * rows);
  const dummy = new THREE.Object3D();
  let idx = 0;

  for (let i = 0; i < count; i++) {
    const offset = -length / 2 + (i + 0.5) * (length / count);
    for (let row = 0; row < rows; row++) {
      dummy.position.set(
        isHoriz ? cx + offset : cx,
        0.28 + row * 0.22,
        isHoriz ? cz : cz + offset
      );
      dummy.rotation.set(Math.PI / 2, 0, 0);
      dummy.updateMatrix();
      inst.setMatrixAt(idx++, dummy.matrix);
    }
  }

  inst.count = idx;
  inst.instanceMatrix.needsUpdate = true;
  return inst;
}

export function buildStartGrid(start) {
  const angle = -start.angle + Math.PI / 2;
  const tileW = 1.35;
  const tileD = 0.6;
  const verts = [];
  const indices = [];
  const colors = [];

  for (let i = 0; i < 12; i++) {
    const offset = (i - 5.5) * 0.68;
    const cx = gx(start.x) + Math.sin(angle) * offset;
    const cz = gz(start.y) + Math.cos(angle) * offset;
    const hw = tileW / 2;
    const hd = tileD / 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const base = verts.length / 3;
    const corners = [
      [-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd],
    ];
    const isWhite = i % 2 === 0;
    const c = isWhite ? 1 : 0.07;

    for (const [lx, lz] of corners) {
      verts.push(
        cx + lx * cos - lz * sin,
        0.16,
        cz + lx * sin + lz * cos
      );
      colors.push(c, c, c);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  return new THREE.Mesh(geo, mat('start-grid', () => new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.55,
  })));
}

export function buildFenceAlongEllipse(cx, cy, rx, ry) {
  const segments = 24;
  const fenceRx = (rx + 55) * SCALE;
  const fenceRy = (ry + 55) * SCALE;
  const postMat = mat('fence-post', () => new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.4, roughness: 0.55 }));
  const wireMat = mat('fence-wire', () => new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.5, roughness: 0.45 }));
  const postGeo = new THREE.CylinderGeometry(0.04, 0.05, 1.2, 5);
  const posts = new THREE.InstancedMesh(postGeo, postMat, segments);
  const dummy = new THREE.Object3D();
  const rails = new THREE.Group();

  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const x = gx(cx) + Math.cos(t) * fenceRx;
    const z = gz(cy) + Math.sin(t) * fenceRy;
    dummy.position.set(x, 0.6, z);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    posts.setMatrixAt(i, dummy.matrix);

    if (i % 2 === 0) {
      const next = ((i + 2) / segments) * Math.PI * 2;
      const x2 = gx(cx) + Math.cos(next) * fenceRx;
      const z2 = gz(cy) + Math.sin(next) * fenceRy;
      const len = Math.sqrt((x2 - x) ** 2 + (z2 - z) ** 2);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.04, 0.04), wireMat);
      rail.position.set((x + x2) / 2, 0.9, (z + z2) / 2);
      rail.rotation.y = Math.atan2(z2 - z, x2 - x);
      rails.add(rail);
      const rail2 = rail.clone();
      rail2.position.y = 0.5;
      rails.add(rail2);
    }
  }

  posts.instanceMatrix.needsUpdate = true;
  const group = new THREE.Group();
  group.add(posts, rails);
  return group;
}

export function buildWaterPool(surf) {
  const geo = new THREE.CircleGeometry(1, 16);
  const waterMat = mat('water', () => new THREE.MeshStandardMaterial({
    color: 0x3a78a8,
    metalness: 0.35,
    roughness: 0.2,
    transparent: true,
    opacity: 0.82,
  }));
  const surface = new THREE.Mesh(geo, waterMat);
  surface.rotation.x = -Math.PI / 2;
  surface.position.set(gx(surf.cx || surf.x + surf.w / 2), 0.02, gz(surf.cy || surf.y + surf.h / 2));
  if (surf.shape === 'ellipse') {
    surface.scale.set(surf.rx * SCALE, surf.ry * SCALE, 1);
  } else {
    surface.scale.set(surf.w * SCALE * 0.5, surf.h * SCALE * 0.5, 1);
  }
  return surface;
}
