import * as THREE from 'three';
import { SURFACE, CANVAS_W, CANVAS_H } from './utils.js?v=13';
import { getRoadPointsForMinimap } from './tracks.js?v=13';
import {
  buildGrassBase,
  buildRoad,
  buildRoadMarkings,
  buildHazardPatches,
  buildSimpleBarrier,
  buildStartGrid,
  buildWaterPool,
  clearMatCache,
} from './trackbuilder.js?v=13';

const SCALE = 0.12;
const CX = CANVAS_W / 2;
const CY = CANVAS_H / 2;

function makeRoadTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#a08850';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 600; i++) {
    const g = 90 + Math.random() * 50;
    ctx.fillStyle = `rgb(${g},${Math.floor(g * 0.78)},${Math.floor(g * 0.48)})`;
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 1);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  for (let y = 0; y < 128; y += 16) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(128, y);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

function makeNoiseTexture(w, h, base, variation, grain = 40) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  const baseC = new THREE.Color(base);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * variation;
    img.data[i] = Math.min(255, Math.max(0, (baseC.r + n) * 255));
    img.data[i + 1] = Math.min(255, Math.max(0, (baseC.g + n) * 255));
    img.data[i + 2] = Math.min(255, Math.max(0, (baseC.b + n) * 255));
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  for (let i = 0; i < grain; i++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 4, 1);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  return tex;
}

export class Renderer3D {
  constructor(container) {
    this.container = container;
    this.carMeshes = new Map();
    this.dustParticles = [];
    this.dustPool = [];
    this.dustGeo = new THREE.SphereGeometry(0.15, 4, 4);
    this.dustMat = new THREE.MeshBasicMaterial({
      color: 0xa08050,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    this.trackGroup = new THREE.Group();
    this.itemGroup = new THREE.Group();
    this.frame = 0;
    this.textures = {};

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x7eb8d8);
    this.scene.fog = new THREE.Fog(0x8ec4e0, 80, 160);

    this.camera = new THREE.PerspectiveCamera(50, CANVAS_W / CANVAS_H, 0.5, 200);
    this.cameraTarget = new THREE.Vector3();
    this.camPos = new THREE.Vector3();

    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(CANVAS_W, CANVAS_H);
    this.renderer.setPixelRatio(1);
    this.renderer.shadowMap.enabled = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this._initTextures();
    this._initLights();
    this._initSky();
    this.scene.add(this.trackGroup);
    this.scene.add(this.itemGroup);
    this._itemGeos = {
      box: new THREE.BoxGeometry(0.9, 0.9, 0.9),
      coin: new THREE.CylinderGeometry(0.18, 0.18, 0.06, 8),
      shell: new THREE.SphereGeometry(0.22, 6, 6),
      banana: new THREE.CylinderGeometry(0.2, 0.22, 0.08, 8),
    };
    this._itemMats = {
      box: new THREE.MeshLambertMaterial({ color: 0xff66aa }),
      coin: new THREE.MeshLambertMaterial({ color: 0xffdd22 }),
      shell: new THREE.MeshLambertMaterial({ color: 0x44cc44 }),
      banana: new THREE.MeshLambertMaterial({ color: 0xffdd22 }),
    };
    this._initItemPool();
    this._initMinimap();
    this._setupResize();
  }

  _initTextures() {
    this.textures.grass = makeNoiseTexture(128, 128, '#3d7a35', 0.08, 20);
    this.textures.road = makeRoadTexture();
    this.textures.dirt = this.textures.road;
    this.textures.mud = makeNoiseTexture(64, 64, '#5a3820', 0.06, 10);
    this.textures.asphalt = makeNoiseTexture(64, 64, '#555555', 0.04, 10);
  }

  _initItemPool() {
    this._pool = { boxes: [], coins: [], shells: [], bananas: [] };
    const add = (arr, geo, mat, n) => {
      for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(geo, mat);
        m.visible = false;
        this.itemGroup.add(m);
        arr.push(m);
      }
    };
    add(this._pool.boxes, this._itemGeos.box, this._itemMats.box, 6);
    add(this._pool.coins, this._itemGeos.coin, this._itemMats.coin, 8);
    add(this._pool.shells, this._itemGeos.shell, this._itemMats.shell, 6);
    add(this._pool.bananas, this._itemGeos.banana, this._itemMats.banana, 8);
  }

  _initSky() {
    // Background color only — no sky mesh
  }

  _setupResize() {
    const resize = () => {
      const maxW = window.innerWidth - 40;
      const maxH = window.innerHeight - 40;
      const s = Math.min(maxW / CANVAS_W, maxH / CANVAS_H, 1);
      this.renderer.domElement.style.width = `${CANVAS_W * s}px`;
      this.renderer.domElement.style.height = `${CANVAS_H * s}px`;
    };
    window.addEventListener('resize', resize);
    resize();
  }

  _initLights() {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    this.sun = new THREE.DirectionalLight(0xfff8ee, 0.85);
    this.sun.position.set(30, 50, 20);
    this.scene.add(this.sun);
  }

  _initMinimap() {
    this.minimap = document.createElement('canvas');
    this.minimap.width = 120;
    this.minimap.height = 90;
    this.minimap.style.cssText = 'position:absolute;right:20px;bottom:20px;border:2px solid rgba(255,255,255,0.4);background:rgba(0,0,0,0.6);pointer-events:none;z-index:5;border-radius:4px';
    this.minimapCtx = this.minimap.getContext('2d');
    this.container.appendChild(this.minimap);
  }

  gx(x) { return (x - CX) * SCALE; }
  gz(y) { return (y - CY) * SCALE; }

  _surfMat(type, color) {
    const texKey = { DIRT: 'dirt', MUD: 'mud', ASPHALT: 'asphalt', GRASS: 'grass' }[type];
    const map = texKey ? this.textures[texKey] : null;
    const isWater = type === 'WATER';
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      map: map || null,
      metalness: isWater ? 0.7 : type === 'ASPHALT' ? 0.2 : 0.05,
      roughness: isWater ? 0.15 : type === 'DIRT' ? 0.92 : 0.85,
      transparent: isWater,
      opacity: isWater ? 0.85 : 1,
    });
  }

  clearTrack() {
    while (this.trackGroup.children.length) {
      const obj = this.trackGroup.children[0];
      obj.traverse((c) => {
        if (c.geometry) c.geometry.dispose();
      });
      this.trackGroup.remove(obj);
    }
    for (const [, data] of this.carMeshes) {
      this.scene.remove(data.group);
      data.group.traverse((c) => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) c.material.dispose();
      });
    }
    this.carMeshes.clear();
    this.dustParticles = [];
  }

  buildTrack(track) {
    this.clearTrack();
    clearMatCache();

    this.trackGroup.add(buildGrassBase(this.textures));
    this.trackGroup.add(buildRoad(track, this.textures));
    this.trackGroup.add(buildRoadMarkings(track));
    this.trackGroup.add(buildHazardPatches(track, this.textures));

    for (const surf of track.surfaces) {
      if (surf.type === 'WATER') this.trackGroup.add(buildWaterPool(surf));
    }

    for (const wall of track.walls) {
      this.trackGroup.add(buildSimpleBarrier(wall));
    }

    for (const dec of track.decorations || []) {
      this._addDecoration(dec);
    }

    this.trackGroup.add(buildStartGrid(track.starts[0]));
  }

  _addDecoration(dec) {
    const x = this.gx(dec.x);
    const z = this.gz(dec.y);
    const s = dec.scale || 1;

    if (dec.type === 'tree') {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1 * s, 0.14 * s, 1.2 * s, 6),
        new THREE.MeshLambertMaterial({ color: 0x4a3020 })
      );
      trunk.position.set(x, 0.6 * s, z);
      const foliage = new THREE.Mesh(
        new THREE.ConeGeometry(0.7 * s, 1.4 * s, 6),
        new THREE.MeshLambertMaterial({ color: 0x2a6828 })
      );
      foliage.position.set(x, 1.5 * s, z);
      this.trackGroup.add(trunk, foliage);
    } else if (dec.type === 'tire') {
      const tire = new THREE.Mesh(
        new THREE.TorusGeometry(0.35 * s, 0.12 * s, 4, 8),
        new THREE.MeshLambertMaterial({ color: 0x151515 })
      );
      tire.rotation.x = Math.PI / 2;
      tire.position.set(x, 0.35 * s, z);
      this.trackGroup.add(tire);
    } else if (dec.type === 'grandstand') {
      const stand = new THREE.Mesh(
        new THREE.BoxGeometry(7 * s, 2 * s, 2.5 * s),
        new THREE.MeshLambertMaterial({ color: 0x666666 })
      );
      stand.position.set(x, 1 * s, z);
      this.trackGroup.add(stand);
    } else if (dec.type === 'cone') {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.25 * s, 0.7 * s, 6),
        new THREE.MeshLambertMaterial({ color: 0xff5500 })
      );
      cone.position.set(x, 0.35 * s, z);
      this.trackGroup.add(cone);
    } else if (dec.type === 'rock') {
      const rock = new THREE.Mesh(
        new THREE.BoxGeometry(0.9 * s, 0.5 * s, 0.8 * s),
        new THREE.MeshLambertMaterial({ color: 0x6a6a5a })
      );
      rock.position.set(x, 0.25 * s, z);
      this.trackGroup.add(rock);
    } else if (dec.type === 'flag') {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04 * s, 0.04 * s, 2 * s, 4),
        new THREE.MeshLambertMaterial({ color: 0xaaaaaa })
      );
      pole.position.set(x, 1 * s, z);
      this.trackGroup.add(pole);
    }
  }

  createTruck(car) {
    const group = new THREE.Group();
    const body = new THREE.Color(car.color.body);
    const dark = new THREE.Color(car.color.dark);
    const trim = new THREE.Color(car.color.trim);
    const paint = (color) => new THREE.MeshLambertMaterial({ color });
    const rubber = new THREE.MeshLambertMaterial({ color: 0x151515 });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.35, 4.0), paint(dark));
    chassis.position.y = 0.5;
    group.add(chassis);

    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.3, 1.7), paint(body));
    bed.position.set(0, 0.72, -1.05);
    group.add(bed);

    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1.55), paint(body));
    cab.position.set(0, 1.08, 0.9);
    group.add(cab);

    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.45, 1.2), paint(trim));
    hood.position.set(0, 0.88, 1.95);
    group.add(hood);

    const wheels = [];
    for (const [wx, wy, wz] of [[0.88, 0.42, 1.35], [-0.88, 0.42, 1.35], [0.92, 0.42, -1.25], [-0.92, 0.42, -1.25]]) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.34, 8), rubber);
      tire.rotation.z = Math.PI / 2;
      tire.position.set(wx, wy, wz);
      group.add(tire);
      wheels.push(tire);
    }

    group.scale.setScalar(0.58);
    this.scene.add(group);
    this.carMeshes.set(car, { group, wheels });
  }

  syncCars(cars) {
    for (const car of cars) {
      if (!this.carMeshes.has(car)) this.createTruck(car);
      const data = this.carMeshes.get(car);
      const { group, wheels } = data;

      const speed = Math.abs(car.speed);
      const bounce = Math.sin(this.frame * 0.5) * speed * 0.012;
      group.position.set(this.gx(car.x), bounce, this.gz(car.y));
      const spin = car.spinTimer > 0 ? car.spinAngle : 0;
      group.rotation.y = -car.angle + Math.PI / 2 + spin;
      group.scale.setScalar(0.58 * car.getScale());

      if (car.starTimer > 0) {
        group.rotation.z = Math.sin(this.frame * 0.4) * 0.08;
      } else {
        group.rotation.z = 0;
      }

      const roll = this.frame * speed * 0.18;
      for (const w of wheels) w.rotation.x = roll;
    }
  }

  _hidePool(arr) {
    for (const m of arr) m.visible = false;
  }

  _syncItems(items) {
    this._hidePool(this._pool.boxes);
    this._hidePool(this._pool.coins);
    this._hidePool(this._pool.shells);
    this._hidePool(this._pool.bananas);
    if (!items) return;

    let bi = 0, ci = 0, si = 0, ti = 0;
    for (const box of items.boxes) {
      if (!box.active || bi >= this._pool.boxes.length) continue;
      const m = this._pool.boxes[bi++];
      m.visible = true;
      m.position.set(this.gx(box.x), 0.65 + Math.sin(box.spin) * 0.08, this.gz(box.y));
      m.rotation.y = box.spin;
    }
    for (const coin of items.coins) {
      if (!coin.active || ci >= this._pool.coins.length) continue;
      const m = this._pool.coins[ci++];
      m.visible = true;
      m.rotation.x = Math.PI / 2;
      m.position.set(this.gx(coin.x), 0.3 + Math.sin(coin.bob) * 0.06, this.gz(coin.y));
    }
    for (const p of items.projectiles) {
      if (si >= this._pool.shells.length) break;
      const m = this._pool.shells[si++];
      m.visible = true;
      m.position.set(this.gx(p.x), 0.3, this.gz(p.y));
    }
    for (const trap of items.traps) {
      if (ti >= this._pool.bananas.length) break;
      const m = this._pool.bananas[ti++];
      m.visible = true;
      m.position.set(this.gx(trap.x), 0.1, this.gz(trap.y));
    }
  }

  spawnDust(x, y, color) {
    if (this.dustParticles.length >= 25) return;

    let mesh;
    if (this.dustPool.length > 0) {
      mesh = this.dustPool.pop();
      mesh.visible = true;
    } else {
      mesh = new THREE.Mesh(this.dustGeo, this.dustMat.clone());
      this.scene.add(mesh);
    }

    mesh.material.color.set(color);
    const scale = 0.6 + Math.random() * 0.8;
    mesh.scale.setScalar(scale);
    mesh.position.set(
      this.gx(x) + (Math.random() - 0.5) * 0.5,
      0.2 + Math.random() * 0.3,
      this.gz(y) + (Math.random() - 0.5) * 0.5
    );
    this.dustParticles.push({
      mesh,
      life: 1,
      vy: 0.015 + Math.random() * 0.025,
      vx: (Math.random() - 0.5) * 0.04,
      vz: (Math.random() - 0.5) * 0.04,
    });
  }

  updateDust() {
    for (let i = this.dustParticles.length - 1; i >= 0; i--) {
      const p = this.dustParticles[i];
      p.life -= 0.03;
      p.mesh.position.y += p.vy;
      p.mesh.position.x += p.vx;
      p.mesh.position.z += p.vz;
      p.mesh.material.opacity = p.life * 0.45;
      if (p.life <= 0) {
        p.mesh.visible = false;
        this.dustPool.push(p.mesh);
        this.dustParticles.splice(i, 1);
      }
    }
  }

  updateCamera(player) {
    if (!player) return;
    const px = this.gx(player.x);
    const pz = this.gz(player.y);
    const angle = -player.angle + Math.PI / 2;
    const speed = Math.abs(player.speed);
    const dist = 8 + speed * 0.3;
    const height = 3.5 + speed * 0.08;

    const targetX = px - Math.sin(angle) * dist;
    const targetZ = pz - Math.cos(angle) * dist;

    this.camPos.lerp(new THREE.Vector3(targetX, height, targetZ), 0.08);
    this.camera.position.copy(this.camPos);
    this.cameraTarget.lerp(new THREE.Vector3(px, 0.9 + bounce(speed), pz), 0.12);
    this.camera.lookAt(this.cameraTarget);
  }

  drawMinimap(track, cars, items) {
    const ctx = this.minimapCtx;
    const w = 120, h = 90;
    ctx.fillStyle = 'rgba(10,20,8,0.85)';
    ctx.fillRect(0, 0, w, h);
    const sx = w / CANVAS_W, sy = h / CANVAS_H;
    const roadPts = getRoadPointsForMinimap(track);
    if (roadPts.length > 1) {
      ctx.strokeStyle = 'rgba(200,160,80,0.9)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      roadPts.forEach((wp, i) => {
        if (i === 0) ctx.moveTo(wp.x * sx, wp.y * sy);
        else ctx.lineTo(wp.x * sx, wp.y * sy);
      });
      ctx.closePath();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    for (const surf of track.surfaces) {
      if (surf.type === 'GRASS' || surf.type === 'DIRT') continue;
      ctx.fillStyle = SURFACE[surf.type].color;
      if (surf.shape === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(surf.cx * sx, surf.cy * sy, surf.rx * sx, surf.ry * sy, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(surf.x * sx, surf.y * sy, surf.w * sx, surf.h * sy);
      }
    }
    if (items) {
      ctx.fillStyle = '#ff66aa';
      for (const box of items.boxes) {
        if (box.active) {
          ctx.fillRect(box.x * sx - 2, box.y * sy - 2, 4, 4);
        }
      }
    }
    for (const car of cars) {
      ctx.fillStyle = car.isPlayer ? '#ffff00' : car.color.body;
      ctx.beginPath();
      ctx.arc(car.x * sx, car.y * sy, car.isPlayer ? 3 : 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  render(track, cars, player, items) {
    this.frame++;
    this.syncCars(cars);
    if (items) this._syncItems(items);
    if (this.frame % 2 === 0) this.updateDust();
    this.updateCamera(player);
    if (track && this.frame % 8 === 0) this.drawMinimap(track, cars, items);
    this.renderer.render(this.scene, this.camera);
  }
}

function bounce(speed) {
  return Math.min(speed * 0.05, 0.3);
}
