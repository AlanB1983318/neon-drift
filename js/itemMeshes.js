import * as THREE from 'three';

const MATS = {};
const GEOS = {};

function mat(key, factory) {
  if (!MATS[key]) MATS[key] = factory();
  return MATS[key];
}

function geo(key, factory) {
  if (!GEOS[key]) GEOS[key] = factory();
  return GEOS[key];
}

function makeQuestionTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#e8a020';
  ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = '#8b5a10';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 60, 60);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 44px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', 32, 34);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeCoinTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createRadialGradient(32, 28, 4, 32, 32, 30);
  grad.addColorStop(0, '#fff4a8');
  grad.addColorStop(0.5, '#ffc830');
  grad.addColorStop(1, '#c88610');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(32, 32, 28, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#a06808';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = '#8b5a08';
  ctx.font = 'bold 28px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('$', 32, 34);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildItemBoxGroup() {
  const group = new THREE.Group();
  const wood = mat('crate-wood', () => new THREE.MeshLambertMaterial({ color: 0x7a5a28 }));
  const metal = mat('crate-metal', () => new THREE.MeshLambertMaterial({ color: 0x4a4a4a }));
  const qMat = mat('crate-q', () => new THREE.MeshLambertMaterial({
    map: makeQuestionTexture(),
    color: 0xffffff,
  }));
  const glowMat = mat('crate-glow', () => new THREE.MeshBasicMaterial({
    color: 0xff66cc,
    transparent: true,
    opacity: 0.55,
  }));

  const body = new THREE.Mesh(geo('crate-body', () => new THREE.BoxGeometry(0.95, 0.95, 0.95)), wood);
  body.position.y = 0.52;
  group.add(body);

  for (const [px, py, pz, sx, sy, sz] of [
    [0, 0.52, 0.48, 0.9, 0.9, 0.06],
    [0, 0.52, -0.48, 0.9, 0.9, 0.06],
    [0.48, 0.52, 0, 0.06, 0.9, 0.9],
    [-0.48, 0.52, 0, 0.06, 0.9, 0.9],
  ]) {
    const panel = new THREE.Mesh(geo('crate-panel', () => new THREE.BoxGeometry(1, 1, 1)), qMat);
    panel.position.set(px, py, pz);
    panel.scale.set(sx, sy, sz);
    group.add(panel);
  }

  for (const y of [0.12, 0.92]) {
    const band = new THREE.Mesh(geo('crate-band', () => new THREE.BoxGeometry(1.02, 0.08, 1.02)), metal);
    band.position.y = y;
    group.add(band);
  }

  const postGeo = geo('crate-post', () => new THREE.BoxGeometry(0.1, 1.02, 0.1));
  for (const [x, z] of [[0.46, 0.46], [-0.46, 0.46], [0.46, -0.46], [-0.46, -0.46]]) {
    const post = new THREE.Mesh(postGeo, metal);
    post.position.set(x, 0.52, z);
    group.add(post);
  }

  const glow = new THREE.Mesh(geo('crate-glow', () => new THREE.SphereGeometry(0.18, 8, 8)), glowMat);
  glow.position.y = 1.12;
  glow.name = 'glow';
  group.add(glow);

  const ring = new THREE.Mesh(
    geo('crate-ring', () => new THREE.TorusGeometry(0.55, 0.04, 6, 16)),
    mat('crate-ring', () => new THREE.MeshBasicMaterial({ color: 0xffaadd, transparent: true, opacity: 0.35 }))
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.08;
  group.add(ring);

  return group;
}

export function buildCoinGroup() {
  const group = new THREE.Group();
  const faceMat = mat('coin-face', () => new THREE.MeshLambertMaterial({
    map: makeCoinTexture(),
    color: 0xffffff,
  }));
  const edgeMat = mat('coin-edge', () => new THREE.MeshLambertMaterial({ color: 0xb87810 }));

  const coin = new THREE.Mesh(
    geo('coin-disc', () => new THREE.CylinderGeometry(0.3, 0.3, 0.07, 20)),
    faceMat
  );
  coin.position.y = 0.38;
  group.add(coin);

  const edge = new THREE.Mesh(
    geo('coin-edge-geo', () => new THREE.TorusGeometry(0.3, 0.035, 6, 20)),
    edgeMat
  );
  edge.rotation.x = Math.PI / 2;
  edge.position.y = 0.38;
  group.add(edge);

  return group;
}

export function buildShellGroup() {
  const group = new THREE.Group();
  const shellMat = mat('shell-green', () => new THREE.MeshLambertMaterial({ color: 0x2d7a32 }));
  const rimMat = mat('shell-rim', () => new THREE.MeshLambertMaterial({ color: 0x1e5522 }));
  const bellyMat = mat('shell-belly', () => new THREE.MeshLambertMaterial({ color: 0xf2e2b8 }));

  const dome = new THREE.Mesh(
    geo('shell-dome', () => new THREE.SphereGeometry(0.32, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.52)),
    shellMat
  );
  dome.position.y = 0.18;
  group.add(dome);

  const belly = new THREE.Mesh(
    geo('shell-belly', () => new THREE.CylinderGeometry(0.27, 0.3, 0.1, 12)),
    bellyMat
  );
  belly.position.y = 0.1;
  group.add(belly);

  const segGeo = geo('shell-seg', () => new THREE.BoxGeometry(0.06, 0.22, 0.34));
  for (let i = 0; i < 6; i++) {
    const seg = new THREE.Mesh(segGeo, rimMat);
    const a = (i / 6) * Math.PI * 2;
    seg.position.set(Math.cos(a) * 0.2, 0.22, Math.sin(a) * 0.2);
    seg.rotation.y = -a;
    group.add(seg);
  }

  return group;
}

export function buildBananaGroup() {
  const group = new THREE.Group();
  const peelOut = mat('banana-peel', () => new THREE.MeshLambertMaterial({ color: 0xf2d018 }));
  const peelIn = mat('banana-inner', () => new THREE.MeshLambertMaterial({ color: 0xe8c848 }));
  const fruitMat = mat('banana-fruit', () => new THREE.MeshLambertMaterial({ color: 0xffee66 }));

  const fruit = new THREE.Mesh(
    geo('banana-fruit', () => new THREE.CylinderGeometry(0.07, 0.09, 0.42, 8)),
    fruitMat
  );
  fruit.rotation.z = Math.PI / 2;
  fruit.position.set(0, 0.07, 0);
  group.add(fruit);

  const peelGeo = geo('banana-peel-geo', () => new THREE.BoxGeometry(0.22, 0.03, 0.5));
  for (const side of [-1, 1]) {
    const outer = new THREE.Mesh(peelGeo, peelOut);
    outer.position.set(side * 0.2, 0.04, 0);
    outer.rotation.y = side * 0.55;
    outer.rotation.z = side * 0.35;
    group.add(outer);

    const inner = new THREE.Mesh(
      geo('banana-peel-inner', () => new THREE.BoxGeometry(0.18, 0.02, 0.42)),
      peelIn
    );
    inner.position.set(side * 0.14, 0.055, 0);
    inner.rotation.y = side * 0.45;
    inner.rotation.z = side * 0.2;
    group.add(inner);
  }

  const stem = new THREE.Mesh(
    geo('banana-stem', () => new THREE.CylinderGeometry(0.03, 0.04, 0.08, 6)),
    mat('banana-stem', () => new THREE.MeshLambertMaterial({ color: 0x6a5020 }))
  );
  stem.position.set(-0.24, 0.08, 0);
  stem.rotation.z = Math.PI / 2;
  group.add(stem);

  return group;
}
