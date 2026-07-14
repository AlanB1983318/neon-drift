import * as THREE from 'three';
import { SURFACE, CANVAS_W, CANVAS_H } from './utils.js?v=9';
import {
  buildTerrain,
  buildTrackOverlay,
  buildTireBarrier,
  buildStartGrid,
  buildFenceAlongEllipse,
  buildWaterPool,
} from './trackbuilder.js?v=9';

const SCALE = 0.12;
const CX = CANVAS_W / 2;
const CY = CANVAS_H / 2;

function makeDetailedDirtTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#9a7848';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 8000; i++) {
    const shade = 120 + Math.random() * 80;
    ctx.fillStyle = `rgb(${shade},${shade * 0.75},${shade * 0.45})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 3, 1);
  }
  for (let i = 0; i < 30; i++) {
    ctx.strokeStyle = `rgba(60,40,20,${0.1 + Math.random() * 0.15})`;
    ctx.lineWidth = 1 + Math.random() * 3;
    ctx.beginPath();
    ctx.moveTo(Math.random() * 512, Math.random() * 512);
    ctx.lineTo(Math.random() * 512, Math.random() * 512);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
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
    this.trackGroup = new THREE.Group();
    this.frame = 0;
    this.textures = {};

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x7eb8d8);
    this.scene.fog = new THREE.FogExp2(0x9ec8e0, 0.012);

    this.camera = new THREE.PerspectiveCamera(48, CANVAS_W / CANVAS_H, 0.3, 300);
    this.cameraTarget = new THREE.Vector3();
    this.camPos = new THREE.Vector3();

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(CANVAS_W, CANVAS_H);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this._initTextures();
    this._initLights();
    this._initSky();
    this.scene.add(this.trackGroup);
    this._initMinimap();
    this._setupResize();
  }

  _initTextures() {
    this.textures.grass = makeNoiseTexture(512, 512, '#3d7a35', 0.1, 120);
    this.textures.dirt = makeDetailedDirtTexture();
    this.textures.mud = makeNoiseTexture(256, 256, '#5a3820', 0.08, 60);
    this.textures.asphalt = makeNoiseTexture(256, 256, '#555555', 0.05, 40);
    this.textures.gravel = makeNoiseTexture(256, 256, '#8a7858', 0.09, 50);
  }

  _initSky() {
    const skyGeo = new THREE.SphereGeometry(120, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        topColor: { value: new THREE.Color(0x4a90c8) },
        bottomColor: { value: new THREE.Color(0xb8d8f0) },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPosition = wp.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(h, 0.0)), 1.0);
        }
      `,
    });
    this.scene.add(new THREE.Mesh(skyGeo, skyMat));
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
    this.scene.add(new THREE.AmbientLight(0x404060, 0.3));
    this.scene.add(new THREE.HemisphereLight(0x87ceeb, 0x3a6028, 0.6));

    this.sun = new THREE.DirectionalLight(0xfff0d0, 1.6);
    this.sun.position.set(50, 70, 40);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    this.sun.shadow.camera.left = -70;
    this.sun.shadow.camera.right = 70;
    this.sun.shadow.camera.top = 70;
    this.sun.shadow.camera.bottom = -70;
    this.sun.shadow.camera.near = 5;
    this.sun.shadow.camera.far = 200;
    this.sun.shadow.bias = -0.0005;
    this.sun.target = new THREE.Object3D();
    this.scene.add(this.sun.target);
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
        if (c.material) {
          if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
          else c.material.dispose();
        }
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

    this.trackGroup.add(buildTerrain(track, this.textures));
    this.trackGroup.add(buildTrackOverlay(track, this.textures));

    const dirtOval = track.surfaces.find((s) => s.type === 'DIRT' && s.shape === 'ellipse');
    if (dirtOval) {
      this.trackGroup.add(buildFenceAlongEllipse(dirtOval.cx, dirtOval.cy, dirtOval.rx, dirtOval.ry));
    }

    for (const surf of track.surfaces) {
      if (surf.type === 'WATER') {
        this.trackGroup.add(buildWaterPool(surf));
      }
    }

    for (const wall of track.walls) {
      this.trackGroup.add(buildTireBarrier(wall));
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
        new THREE.CylinderGeometry(0.12 * s, 0.18 * s, 1.4 * s, 10),
        new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.95 })
      );
      trunk.position.set(x, 0.7 * s, z);
      trunk.castShadow = true;
      const foliage = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1.0 * s, 1),
        new THREE.MeshStandardMaterial({ color: 0x2a6828, roughness: 0.9 })
      );
      foliage.position.set(x, 2.0 * s, z);
      foliage.castShadow = true;
      this.trackGroup.add(trunk, foliage);
    } else if (dec.type === 'tire') {
      for (let i = 0; i < 3; i++) {
        const tire = new THREE.Mesh(
          new THREE.TorusGeometry(0.38 * s, 0.15 * s, 12, 24),
          new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.95 })
        );
        tire.rotation.x = Math.PI / 2;
        tire.position.set(x + (i - 1) * 0.95 * s, 0.38 * s, z);
        tire.castShadow = true;
        this.trackGroup.add(tire);
      }
    } else if (dec.type === 'grandstand') {
      const stand = new THREE.Group();
      for (let tier = 0; tier < 4; tier++) {
        const row = new THREE.Mesh(
          new THREE.BoxGeometry(7 * s, 0.5 * s, 2.8 * s),
          new THREE.MeshStandardMaterial({ color: 0x666666 + tier * 0x111111, roughness: 0.7 })
        );
        row.position.set(0, (0.5 + tier * 0.55) * s, 0);
        row.castShadow = true;
        stand.add(row);
      }
      stand.position.set(x, 0, z);
      this.trackGroup.add(stand);
    } else if (dec.type === 'cone') {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.28 * s, 0.75 * s, 12),
        new THREE.MeshStandardMaterial({ color: 0xff5500, roughness: 0.6 })
      );
      cone.position.set(x, 0.38 * s, z);
      cone.castShadow = true;
      this.trackGroup.add(cone);
    } else if (dec.type === 'rock') {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.9 * s, 0),
        new THREE.MeshStandardMaterial({ color: 0x6a6a5a, roughness: 0.95 })
      );
      rock.position.set(x, 0.35 * s, z);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.scale.set(1.2 * s, 0.7 * s, 1.1 * s);
      rock.castShadow = true;
      this.trackGroup.add(rock);
    } else if (dec.type === 'flag') {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04 * s, 0.05 * s, 2.2 * s, 8),
        new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.6, roughness: 0.4 })
      );
      pole.position.set(x, 1.1 * s, z);
      pole.castShadow = true;
      const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(0.9 * s, 0.55 * s),
        new THREE.MeshStandardMaterial({ color: 0xdd2222, side: THREE.DoubleSide, roughness: 0.7 })
      );
      flag.position.set(x + 0.45 * s, 1.7 * s, z);
      this.trackGroup.add(pole, flag);
    }
  }

  createTruck(car) {
    const group = new THREE.Group();
    const body = new THREE.Color(car.color.body);
    const dark = new THREE.Color(car.color.dark);
    const trim = new THREE.Color(car.color.trim);

    const paint = (color, metal = 0.65, rough = 0.3) =>
      new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.95 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.95, roughness: 0.15 });
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0x88aacc, metalness: 0.1, roughness: 0.05,
      transmission: 0.3, transparent: true, opacity: 0.8,
    });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.35, 4.0), paint(dark, 0.4, 0.5));
    chassis.position.y = 0.5;
    chassis.castShadow = true;
    group.add(chassis);

    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.3, 1.7), paint(body));
    bed.position.set(0, 0.72, -1.05);
    bed.castShadow = true;
    group.add(bed);

    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1.55), paint(body));
    cab.position.set(0, 1.08, 0.9);
    cab.castShadow = true;
    group.add(cab);

    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.45, 1.2), paint(trim));
    hood.position.set(0, 0.88, 1.95);
    hood.castShadow = true;
    group.add(hood);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 0.06), glass);
    windshield.position.set(0, 1.25, 1.4);
    windshield.rotation.x = -0.35;
    group.add(windshield);

    const grill = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.35, 0.08), chrome);
    grill.position.set(0, 0.65, 2.45);
    group.add(grill);

    const bumperF = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.18, 0.12), chrome);
    bumperF.position.set(0, 0.42, 2.5);
    group.add(bumperF);

    const bumperR = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.18, 0.12), chrome);
    bumperR.position.set(0, 0.42, -1.95);
    group.add(bumperR);

    const wheels = [];
    const positions = [[0.88, 0.42, 1.35], [-0.88, 0.42, 1.35], [0.92, 0.42, -1.25], [-0.92, 0.42, -1.25]];
    for (const [wx, wy, wz] of positions) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.34, 24), rubber);
      tire.rotation.z = Math.PI / 2;
      tire.position.set(wx, wy, wz);
      tire.castShadow = true;
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.36, 16), chrome);
      rim.rotation.z = Math.PI / 2;
      rim.position.set(wx, wy, wz);
      group.add(tire, rim);
      wheels.push(tire);
    }

    const exhaustL = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.5, 8), chrome);
    exhaustL.rotation.x = Math.PI / 2;
    exhaustL.position.set(-0.55, 0.48, -1.95);
    const exhaustR = exhaustL.clone();
    exhaustR.position.x = 0.55;
    group.add(exhaustL, exhaustR);

    const headlightMat = new THREE.MeshStandardMaterial({
      color: 0xffffee, emissive: 0xffffcc, emissiveIntensity: 0.5,
    });
    const hl1 = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), headlightMat);
    hl1.position.set(0.55, 0.7, 2.42);
    const hl2 = hl1.clone();
    hl2.position.x = -0.55;
    group.add(hl1, hl2);

    group.scale.setScalar(0.58);
    this.scene.add(group);
    this.carMeshes.set(car, { group, wheels, exhaustL, exhaustR, headlightMat });
  }

  syncCars(cars) {
    for (const car of cars) {
      if (!this.carMeshes.has(car)) this.createTruck(car);
      const data = this.carMeshes.get(car);
      const { group, wheels, exhaustL, exhaustR } = data;

      const speed = Math.abs(car.speed);
      const bounce = Math.sin(this.frame * 0.5) * speed * 0.015;
      group.position.set(this.gx(car.x), bounce, this.gz(car.y));
      group.rotation.y = -car.angle + Math.PI / 2;

      const roll = this.frame * speed * 0.18;
      for (const w of wheels) {
        w.rotation.x = roll;
      }

      const nitro = car.nitroActive;
      exhaustL.material.emissive = new THREE.Color(nitro ? 0xff4400 : 0x000000);
      exhaustR.material.emissive = new THREE.Color(nitro ? 0xff4400 : 0x000000);
      exhaustL.material.emissiveIntensity = nitro ? 3 : 0;
      exhaustR.material.emissiveIntensity = nitro ? 3 : 0;
    }
  }

  spawnDust(x, y, color) {
    if (this.dustParticles.length > 150) this.dustParticles.shift();
    const size = 0.1 + Math.random() * 0.25;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(size, 6, 6),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: 0.5,
        roughness: 1,
      })
    );
    mesh.position.set(
      this.gx(x) + (Math.random() - 0.5) * 0.5,
      0.2 + Math.random() * 0.3,
      this.gz(y) + (Math.random() - 0.5) * 0.5
    );
    this.scene.add(mesh);
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
      p.life -= 0.025;
      p.mesh.position.y += p.vy;
      p.mesh.position.x += p.vx;
      p.mesh.position.z += p.vz;
      p.mesh.material.opacity = p.life * 0.45;
      p.mesh.scale.multiplyScalar(1.015);
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
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

    this.camPos.lerp(new THREE.Vector3(targetX, height, targetZ), 0.06);
    this.camera.position.copy(this.camPos);
    this.cameraTarget.lerp(new THREE.Vector3(px, 1.0 + bounce(speed), pz), 0.1);
    this.camera.lookAt(this.cameraTarget);

    this.sun.position.set(px + 40, 65, pz + 25);
    this.sun.target.position.set(px, 0, pz);
    this.sun.target.updateMatrixWorld();
  }

  drawMinimap(track, cars) {
    const ctx = this.minimapCtx;
    const w = 120, h = 90;
    ctx.fillStyle = 'rgba(10,20,8,0.85)';
    ctx.fillRect(0, 0, w, h);
    const sx = w / CANVAS_W, sy = h / CANVAS_H;
    for (const surf of track.surfaces) {
      ctx.fillStyle = SURFACE[surf.type].color;
      if (surf.shape === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(surf.cx * sx, surf.cy * sy, surf.rx * sx, surf.ry * sy, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(surf.x * sx, surf.y * sy, surf.w * sx, surf.h * sy);
      }
    }
    for (const car of cars) {
      ctx.fillStyle = car.isPlayer ? '#ffff00' : car.color.body;
      ctx.beginPath();
      ctx.arc(car.x * sx, car.y * sy, car.isPlayer ? 3 : 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  render(track, cars, player) {
    this.frame++;
    this.syncCars(cars);
    this.updateDust();
    this.updateCamera(player);
    if (track) this.drawMinimap(track, cars);
    this.renderer.render(this.scene, this.camera);
  }
}

function bounce(speed) {
  return Math.min(speed * 0.05, 0.3);
}
