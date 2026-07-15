import * as THREE from 'three';
import { SURFACE, CANVAS_W, CANVAS_H } from './utils.js?v=35';
import { getRoadPointsForMinimap } from './tracks.js?v=35';
import {
  buildItemBoxGroup,
  buildCoinGroup,
  buildShellGroup,
  buildBananaGroup,
} from './itemMeshes.js?v=35';
import {
  buildGrassBase,
  buildRoad,
  buildRoadMarkings,
  buildRouteArrows,
  buildHazardPatches,
  buildSimpleBarrier,
  buildStartGrid,
  buildWaterPool,
  clearMatCache,
} from './trackbuilder.js?v=35';

const SCALE = 0.12;
const CX = CANVAS_W / 2;
const CY = CANVAS_H / 2;

function makeRoadLaneTexture() {
  const cw = 64;
  const ch = 64;
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(0, 0, cw, ch);

  for (let i = 0; i < 500; i++) {
    const g = 38 + Math.random() * 22;
    ctx.fillStyle = `rgb(${g},${g},${g})`;
    ctx.fillRect(Math.random() * cw, Math.random() * ch, 2 + Math.random() * 3, 1);
  }

  for (let y = 0; y < ch; y += 8) {
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(0, y, cw, 1);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

function makeRoadTexture() {
  return makeRoadLaneTexture();
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
    if (!this.renderer.getContext()) {
      throw new Error('WebGL is not available on this device. Try another browser or enable hardware acceleration.');
    }
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
    this._initItemPool();
    this._initMinimap();
    this._setupResize();
  }

  _initTextures() {
    this.textures.grass = makeNoiseTexture(128, 128, '#2d6b28', 0.06, 20);
    this.textures.road = makeRoadLaneTexture();
    this.textures.tarmac = this.textures.road;
    this.textures.dirt = this.textures.road;
    this.textures.mud = makeNoiseTexture(64, 64, '#5a3820', 0.06, 10);
    this.textures.asphalt = this.textures.road;
  }

  _initItemPool() {
    this._pool = { boxes: [], coins: [], shells: [], bananas: [] };
    const addGroup = (arr, factory, n) => {
      for (let i = 0; i < n; i++) {
        const g = factory();
        g.visible = false;
        this.itemGroup.add(g);
        arr.push(g);
      }
    };
    addGroup(this._pool.boxes, buildItemBoxGroup, 6);
    addGroup(this._pool.coins, buildCoinGroup, 8);
    addGroup(this._pool.shells, buildShellGroup, 6);
    addGroup(this._pool.bananas, buildBananaGroup, 8);
  }

  _initSky() {
    // Background color only — no sky mesh
  }

  _setupResize() {
    const app = document.getElementById('app');
    const resize = () => {
      const mobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 900;
      const pad = mobile ? 0 : 40;
      const touchBar = mobile ? 96 : 0;
      const maxW = window.innerWidth - pad;
      const maxH = window.innerHeight - pad - touchBar;
      const s = Math.min(maxW / CANVAS_W, maxH / CANVAS_H, mobile ? 2 : 1);
      const w = CANVAS_W * s;
      const h = CANVAS_H * s;
      this.renderer.domElement.style.width = `${w}px`;
      this.renderer.domElement.style.height = `${h}px`;
      if (this.minimap) {
        const mmScale = mobile ? 0.75 : 1;
        this.minimap.style.transform = `scale(${mmScale})`;
        this.minimap.style.transformOrigin = 'bottom right';
        this.minimap.style.right = mobile ? '8px' : '20px';
        this.minimap.style.bottom = mobile ? `${touchBar + 6}px` : '20px';
      }
      if (app && mobile) {
        app.style.width = '100%';
        app.style.height = '100%';
      }
    };
    window.addEventListener('resize', resize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', resize);
    }
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
    this.trackGroup.add(buildRouteArrows(track));
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
    } else if (dec.type === 'pine') {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08 * s, 0.12 * s, 1.0 * s, 5),
        new THREE.MeshLambertMaterial({ color: 0x3a2818 })
      );
      trunk.position.set(x, 0.5 * s, z);
      const layers = [0x1f5a22, 0x2a6a2c, 0x357a38];
      for (let i = 0; i < 3; i++) {
        const layer = new THREE.Mesh(
          new THREE.ConeGeometry((0.55 - i * 0.1) * s, (0.9 - i * 0.05) * s, 6),
          new THREE.MeshLambertMaterial({ color: layers[i] })
        );
        layer.position.set(x, (1.1 + i * 0.55) * s, z);
        this.trackGroup.add(layer);
      }
      this.trackGroup.add(trunk);
    } else if (dec.type === 'bush') {
      const bush = new THREE.Mesh(
        new THREE.SphereGeometry(0.45 * s, 6, 5),
        new THREE.MeshLambertMaterial({ color: 0x3a7a32 })
      );
      bush.scale.set(1.1, 0.7, 1.1);
      bush.position.set(x, 0.28 * s, z);
      this.trackGroup.add(bush);
    } else if (dec.type === 'mountain') {
      const base = new THREE.Mesh(
        new THREE.ConeGeometry(2.8 * s, 3.6 * s, 7),
        new THREE.MeshLambertMaterial({ color: 0x5a6a58 })
      );
      base.position.set(x, 1.6 * s, z);
      const snow = new THREE.Mesh(
        new THREE.ConeGeometry(1.1 * s, 1.2 * s, 7),
        new THREE.MeshLambertMaterial({ color: 0xd8e8f0 })
      );
      snow.position.set(x, 3.1 * s, z);
      const rock = new THREE.Mesh(
        new THREE.BoxGeometry(3.2 * s, 0.5 * s, 2.4 * s),
        new THREE.MeshLambertMaterial({ color: 0x4a5248 })
      );
      rock.position.set(x, 0.2 * s, z);
      this.trackGroup.add(rock, base, snow);
    } else if (dec.type === 'sign') {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05 * s, 0.06 * s, 1.4 * s, 4),
        new THREE.MeshLambertMaterial({ color: 0x888888 })
      );
      post.position.set(x, 0.7 * s, z);
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(2.2 * s, 0.7 * s, 0.08 * s),
        new THREE.MeshLambertMaterial({ color: 0x22aa44 })
      );
      board.position.set(x, 1.35 * s, z);
      this.trackGroup.add(post, board);
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
    const accent = new THREE.Color(car.color.accent || car.color.trim);
    const paint = (color) => new THREE.MeshLambertMaterial({ color });
    const rubber = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    const chrome = new THREE.MeshLambertMaterial({ color: 0xbbbbcc });
    const glass = new THREE.MeshLambertMaterial({ color: 0x88bbee, transparent: true, opacity: 0.75 });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.28, 4.2), paint(dark));
    chassis.position.y = 0.42;
    group.add(chassis);

    const skid = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.12, 3.6), paint(dark));
    skid.position.set(0, 0.22, 0);
    group.add(skid);

    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.42, 1.85), paint(body));
    bed.position.set(0, 0.68, -1.05);
    group.add(bed);

    const bedRailL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 1.7), paint(trim));
    bedRailL.position.set(0.88, 0.88, -1.05);
    const bedRailR = bedRailL.clone();
    bedRailR.position.x = -0.88;
    group.add(bedRailL, bedRailR);

    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.95, 1.65), paint(body));
    cab.position.set(0, 1.05, 0.85);
    group.add(cab);

    const cabTop = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.35, 1.45), paint(trim));
    cabTop.position.set(0, 1.55, 0.82);
    group.add(cabTop);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.55, 0.08), glass);
    windshield.position.set(0, 1.18, 1.62);
    group.add(windshield);

    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.38, 1.35), paint(trim));
    hood.position.set(0, 0.82, 1.95);
    group.add(hood);

    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.45, 0.12), paint(dark));
    grille.position.set(0, 0.72, 2.62);
    group.add(grille);

    const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.18, 0.22), chrome);
    bumper.position.set(0, 0.38, 2.72);
    group.add(bumper);

    const exhaustL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.9, 5), chrome);
    exhaustL.position.set(0.55, 0.95, -1.75);
    const exhaustR = exhaustL.clone();
    exhaustR.position.x = -0.55;
    group.add(exhaustL, exhaustR);

    const numPlate = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.42, 0.06),
      paint(accent)
    );
    numPlate.position.set(0, 1.02, 2.55);
    group.add(numPlate);

    const lightBar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 0.18), paint(accent));
    lightBar.position.set(0, 1.72, 1.0);
    group.add(lightBar);

    for (const [lx, lz] of [[0.75, 1.0], [-0.75, 1.0], [0.78, -0.9], [-0.78, -0.9]]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.55, 4), chrome);
      strut.position.set(lx, 0.72, lz);
      group.add(strut);
    }

    const wheels = [];
    const wheelOffsets = [
      [0.95, 0.48, 1.4], [-0.95, 0.48, 1.4],
      [0.98, 0.48, -1.2], [-0.98, 0.48, -1.2],
    ];
    for (const [wx, wy, wz] of wheelOffsets) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.38, 10), rubber);
      tire.rotation.z = Math.PI / 2;
      tire.position.set(wx, wy, wz);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.4, 6), chrome);
      hub.rotation.z = Math.PI / 2;
      hub.position.set(wx, wy, wz);
      const tread = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.07, 4, 10), rubber);
      tread.rotation.y = Math.PI / 2;
      tread.position.set(wx, wy, wz);
      group.add(tire, hub, tread);
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
    for (const g of arr) {
      g.visible = false;
      g.scale.setScalar(1);
    }
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
      const g = this._pool.boxes[bi++];
      g.visible = true;
      const bob = Math.sin(box.spin) * 0.08;
      g.position.set(this.gx(box.x), 0.55 + bob, this.gz(box.y));
      g.rotation.y = box.spin;
      g.scale.setScalar(1 + Math.sin(box.spin * 2) * 0.04);
    }
    for (const coin of items.coins) {
      if (!coin.active || ci >= this._pool.coins.length) continue;
      const g = this._pool.coins[ci++];
      g.visible = true;
      g.position.set(this.gx(coin.x), 0.34 + Math.sin(coin.bob) * 0.08, this.gz(coin.y));
      g.rotation.y = coin.bob * 1.6;
      g.rotation.x = Math.sin(coin.bob * 0.5) * 0.25;
    }
    for (const p of items.projectiles) {
      if (si >= this._pool.shells.length) break;
      const g = this._pool.shells[si++];
      g.visible = true;
      g.position.set(this.gx(p.x), 0.22, this.gz(p.y));
      g.rotation.y = -p.angle + Math.PI / 2;
    }
    for (const trap of items.traps) {
      if (ti >= this._pool.bananas.length) break;
      const g = this._pool.bananas[ti++];
      g.visible = true;
      g.position.set(this.gx(trap.x), 0.05, this.gz(trap.y));
      g.rotation.y = this.frame * 0.01;
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
    const roadPts = track.waypoints?.length ? track.waypoints : getRoadPointsForMinimap(track);
    if (roadPts.length > 1) {
      ctx.strokeStyle = 'rgba(30,30,35,0.95)';
      ctx.lineWidth = 8;
      ctx.beginPath();
      roadPts.forEach((wp, i) => {
        if (i === 0) ctx.moveTo(wp.x * sx, wp.y * sy);
        else ctx.lineTo(wp.x * sx, wp.y * sy);
      });
      ctx.closePath();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(50,220,100,0.85)';
      ctx.lineWidth = 3;
      ctx.stroke();
      for (let i = 0; i < roadPts.length; i += 3) {
        const p = roadPts[i];
        const next = roadPts[(i + 1) % roadPts.length];
        const mx = (p.x + next.x) * 0.5 * sx;
        const my = (p.y + next.y) * 0.5 * sy;
        const ang = Math.atan2((next.y - p.y) * sy, (next.x - p.x) * sx);
        ctx.save();
        ctx.translate(mx, my);
        ctx.rotate(ang);
        ctx.fillStyle = 'rgba(80,255,120,0.9)';
        ctx.beginPath();
        ctx.moveTo(4, 0);
        ctx.lineTo(-2, -2.5);
        ctx.lineTo(-2, 2.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
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
      ctx.fillStyle = '#e8a020';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      for (const box of items.boxes) {
        if (box.active) {
          ctx.beginPath();
          ctx.arc(box.x * sx, box.y * sy, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
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
