import * as THREE from 'three';
import { SURFACE, CANVAS_W, CANVAS_H } from './utils.js?v=9';
import { getSurfaceAt } from './tracks.js?v=9';

const SCALE = 0.12;
const CX = CANVAS_W / 2;
const CY = CANVAS_H / 2;

function gx(x) { return (x - CX) * SCALE; }
function gz(y) { return (y - CY) * SCALE; }

function noise2(x, y) {
  return Math.sin(x * 0.08) * Math.cos(y * 0.07) * 0.5
    + Math.sin(x * 0.15 + 1.3) * Math.cos(y * 0.12 + 0.7) * 0.3
    + Math.sin(x * 0.03 + y * 0.04) * 0.2;
}

function pointInEllipse(px, py, cx, cy, rx, ry) {
  const dx = (px - cx) / rx;
  const dy = (py - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

function getSurfaceHeight(type, x, y, track) {
  const n = noise2(x * 0.05, y * 0.05);
  switch (type) {
    case 'DIRT': return 0.12 + n * 0.04;
    case 'MUD': return 0.04 + n * 0.02;
    case 'WATER': return -0.08;
    case 'ASPHALT': return 0.14 + n * 0.01;
    default: return 0.02 + n * 0.12;
  }
}

function getSurfaceColor(type) {
  const c = new THREE.Color(SURFACE[type]?.color || SURFACE.GRASS.color);
  return c;
}

function ellipseDist(cx, cy, rx, ry, x, y) {
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  return Math.sqrt(dx * dx + dy * dy);
}

export function buildTerrain(track, textures) {
  const segX = 120;
  const segZ = 80;
  const geo = new THREE.PlaneGeometry(CANVAS_W * SCALE, CANVAS_H * SCALE, segX, segZ);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  for (let i = 0; i < pos.count; i++) {
    const wx = pos.getX(i) / SCALE + CX;
    const wy = CY - pos.getY(i) / SCALE;
    const type = getSurfaceAt(track, wx, wy);
    let h = getSurfaceHeight(type, wx, wy, track);

    const dirtSurf = track.surfaces.find((s) => s.type === 'DIRT' && s.shape === 'ellipse');
    if (dirtSurf && type === 'DIRT') {
      const d = ellipseDist(dirtSurf.cx, dirtSurf.cy, dirtSurf.rx, dirtSurf.ry, wx, wy);
      const crown = (1 - d) * 0.06;
      h += crown;
    }

    pos.setZ(i, h);

    const col = getSurfaceColor(type);
    if (type === 'DIRT') {
      const wear = dirtSurf ? Math.max(0, 1 - ellipseDist(dirtSurf.cx, dirtSurf.cy, dirtSurf.rx * 0.6, dirtSurf.ry * 0.6, wx, wy)) * 0.15 : 0;
      col.offsetHSL(0, 0, -wear);
    }
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    map: textures.grass,
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.02,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  return mesh;
}

export function buildTrackOverlay(track, textures) {
  const group = new THREE.Group();

  for (const surf of track.surfaces) {
    if (surf.type === 'GRASS' || surf.type === 'WATER') continue;

    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(SURFACE[surf.type].color),
      map: textures[{ DIRT: 'dirt', MUD: 'mud', ASPHALT: 'asphalt' }[surf.type]] || null,
      roughness: surf.type === 'WATER' ? 0.1 : 0.88,
      metalness: surf.type === 'WATER' ? 0.8 : 0.04,
      transparent: surf.type === 'WATER',
      opacity: surf.type === 'WATER' ? 0.9 : 1,
    });

    if (surf.shape === 'ellipse') {
      const segments = 96;
      const innerRx = (surf.rx - 18) * SCALE;
      const innerRy = (surf.ry - 18) * SCALE;
      const outerRx = surf.rx * SCALE;
      const outerRy = surf.ry * SCALE;

      if (surf.type === 'DIRT') {
        const ring = buildBankedRing(
          gx(surf.cx), gz(surf.cy),
          innerRx, innerRy, outerRx, outerRy,
          segments, mat, 0.14
        );
        group.add(ring);

        const gravelMat = new THREE.MeshStandardMaterial({
          color: 0x8a7858,
          map: textures.gravel || textures.dirt,
          roughness: 0.95,
        });
        const gravel = buildBankedRing(
          gx(surf.cx), gz(surf.cy),
          outerRx, outerRy,
          outerRx + 1.8, outerRy + 1.8,
          segments, gravelMat, 0.1
        );
        group.add(gravel);

        group.add(buildCurbs(gx(surf.cx), gz(surf.cy), outerRx + 1.8, outerRy + 1.8, segments));
      } else {
        const geo = new THREE.CircleGeometry(1, 48);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(gx(surf.cx), 0.1, gz(surf.cy));
        mesh.scale.set(surf.rx * SCALE, surf.ry * SCALE, 1);
        mesh.receiveShadow = true;
        group.add(mesh);
      }
    } else if (surf.type !== 'GRASS') {
      const mesh = buildRectSurface(surf, mat);
      group.add(mesh);
      if (surf.type === 'DIRT') {
        group.add(buildRectBerm(surf, textures));
      }
      if (surf.type === 'ASPHALT') {
        group.add(buildAsphaltMarkings(surf));
      }
    }
  }

  return group;
}

function buildRectSurface(surf, material) {
  const segW = Math.max(4, Math.floor(surf.w * SCALE / 2));
  const segH = Math.max(4, Math.floor(surf.h * SCALE / 2));
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
    const crown = edge * 0.06;
    const rut = Math.sin(wx * 0.12) * Math.cos(wy * 0.1) * 0.015;
    pos.setZ(i, 0.12 + crown + rut);
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
  const bermMat = new THREE.MeshStandardMaterial({
    color: 0x7a6030,
    map: textures.dirt,
    roughness: 0.96,
  });
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
    berm.castShadow = true;
    group.add(berm);
  }
  return group;
}

function buildAsphaltMarkings(surf) {
  const group = new THREE.Group();
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.5 });
  const cx = surf.x + surf.w / 2;
  const cy = surf.y + surf.h / 2;
  const dash = new THREE.Mesh(
    new THREE.BoxGeometry(surf.w * SCALE * 0.6, 0.02, 0.12),
    lineMat
  );
  dash.position.set(gx(cx), 0.18, gz(cy));
  dash.receiveShadow = true;
  group.add(dash);
  return group;
}

function buildBankedRing(cx, cz, innerRx, innerRy, outerRx, outerRy, segments, material, baseHeight) {
  const geo = new THREE.BufferGeometry();
  const verts = [];
  const norms = [];
  const uvs = [];

  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const cos = Math.cos(t);
    const sin = Math.sin(t);

    const curvature = Math.abs(Math.sin(t * 2)) * 0.08;
    const bankH = baseHeight + curvature;

    const ix = cx + cos * innerRx;
    const iz = cz + sin * innerRy;
    const ox = cx + cos * outerRx;
    const oz = cz + sin * outerRy;

    const crown = Math.cos(t * 2) * 0.03;
    verts.push(ix, bankH + crown, iz, ox, bankH + crown * 0.5, oz);
    norms.push(0, 1, 0, 0, 1, 0);
    uvs.push(i / segments, 0, i / segments, 1);
  }

  const indices = [];
  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }

  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(norms, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  return mesh;
}

function buildCurbs(cx, cz, rx, ry, segments) {
  const group = new THREE.Group();
  for (let i = 0; i < segments; i++) {
    if (i % 3 !== 0) continue;
    const t = (i / segments) * Math.PI * 2;
    const x = cx + Math.cos(t) * rx;
    const z = cz + Math.sin(t) * ry;
    const curb = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.18, 0.35),
      new THREE.MeshStandardMaterial({
        color: i % 6 < 3 ? 0xdd2222 : 0xeeeeee,
        roughness: 0.6,
      })
    );
    curb.position.set(x, 0.2, z);
    curb.rotation.y = -t + Math.PI / 2;
    curb.castShadow = true;
    curb.receiveShadow = true;
    group.add(curb);
  }
  return group;
}

export function buildTireBarrier(wall) {
  const group = new THREE.Group();
  const w = wall.w * SCALE;
  const h = wall.h * SCALE;
  const cx = gx(wall.x + wall.w / 2);
  const cz = gz(wall.y + wall.h / 2);
  const isHoriz = w > h;
  const length = isHoriz ? w : h;
  const count = Math.max(3, Math.floor(length / 0.65));
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95 });

  for (let i = 0; i < count; i++) {
    const stack = new THREE.Group();
    for (let row = 0; row < 3; row++) {
      const tire = new THREE.Mesh(
        new THREE.TorusGeometry(0.32, 0.12, 10, 20),
        tireMat
      );
      tire.rotation.x = Math.PI / 2;
      tire.position.y = 0.28 + row * 0.22;
      stack.add(tire);
    }
    const offset = -length / 2 + (i + 0.5) * (length / count);
    if (isHoriz) stack.position.set(cx + offset, 0, cz);
    else stack.position.set(cx, 0, cz + offset);
    stack.castShadow = true;
    group.add(stack);
  }
  return group;
}

export function buildStartGrid(start) {
  const group = new THREE.Group();
  const angle = -start.angle + Math.PI / 2;
  for (let i = 0; i < 12; i++) {
    const tile = new THREE.Mesh(
      new THREE.BoxGeometry(1.35, 0.05, 0.6),
      new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? 0xffffff : 0x111111,
        roughness: 0.55,
      })
    );
    const offset = (i - 5.5) * 0.68;
    tile.position.set(
      gx(start.x) + Math.sin(angle) * offset,
      0.16,
      gz(start.y) + Math.cos(angle) * offset
    );
    tile.rotation.y = angle;
    tile.receiveShadow = true;
    group.add(tile);
  }
  return group;
}

export function buildFenceAlongEllipse(cx, cy, rx, ry) {
  const group = new THREE.Group();
  const segments = 48;
  const fenceRx = (rx + 55) * SCALE;
  const fenceRy = (ry + 55) * SCALE;
  const postMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.5, roughness: 0.5 });
  const wireMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.6, roughness: 0.4 });

  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const x = gx(cx) + Math.cos(t) * fenceRx;
    const z = gz(cy) + Math.sin(t) * fenceRy;

    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.2, 6), postMat);
    post.position.set(x, 0.6, z);
    post.castShadow = true;
    group.add(post);

    if (i % 2 === 0) {
      const next = ((i + 2) / segments) * Math.PI * 2;
      const x2 = gx(cx) + Math.cos(next) * fenceRx;
      const z2 = gz(cy) + Math.sin(next) * fenceRy;
      const midX = (x + x2) / 2;
      const midZ = (z + z2) / 2;
      const len = Math.sqrt((x2 - x) ** 2 + (z2 - z) ** 2);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.04, 0.04), wireMat);
      rail.position.set(midX, 0.9, midZ);
      rail.rotation.y = Math.atan2(z2 - z, x2 - x);
      group.add(rail);
      const rail2 = rail.clone();
      rail2.position.y = 0.5;
      group.add(rail2);
    }
  }
  return group;
}

export function buildWaterPool(surf) {
  const group = new THREE.Group();
  const geo = new THREE.CircleGeometry(1, 32);
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x3a78a8,
    metalness: 0.2,
    roughness: 0.05,
    transmission: 0.4,
    transparent: true,
    opacity: 0.85,
    reflectivity: 0.8,
  });
  const surface = new THREE.Mesh(geo, waterMat);
  surface.rotation.x = -Math.PI / 2;
  surface.position.set(gx(surf.cx || surf.x + surf.w / 2), 0.02, gz(surf.cy || surf.y + surf.h / 2));
  if (surf.shape === 'ellipse') {
    surface.scale.set(surf.rx * SCALE, surf.ry * SCALE, 1);
  } else {
    surface.scale.set(surf.w * SCALE * 0.5, surf.h * SCALE * 0.5, 1);
  }
  group.add(surface);

  const bed = new THREE.Mesh(
    geo.clone(),
    new THREE.MeshStandardMaterial({ color: 0x2a4a68, roughness: 1 })
  );
  bed.rotation.x = -Math.PI / 2;
  bed.position.copy(surface.position);
  bed.position.y = -0.12;
  bed.scale.copy(surface.scale);
  group.add(bed);
  return group;
}
