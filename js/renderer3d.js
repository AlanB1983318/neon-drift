import * as THREE from 'three';
import { SURFACE, CANVAS_W, CANVAS_H } from './utils.js?v=7';

const SCALE = 0.12;
const CX = CANVAS_W / 2;
const CY = CANVAS_H / 2;

export class Renderer3D {
  constructor(container) {
    this.container = container;
    this.carMeshes = new Map();
    this.dustParticles = [];
    this.trackGroup = new THREE.Group();
    this.frame = 0;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8ec8e8);
    this.scene.fog = new THREE.Fog(0x9ecae8, 50, 140);

    this.camera = new THREE.PerspectiveCamera(55, CANVAS_W / CANVAS_H, 0.5, 250);
    this.cameraTarget = new THREE.Vector3();

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(CANVAS_W, CANVAS_H);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    container.appendChild(this.renderer.domElement);

    this._initLights();
    this.scene.add(this.trackGroup);

    this._initMinimap();
    this._setupResize();
  }

  _setupResize() {
    const resize = () => {
      const maxW = window.innerWidth - 40;
      const maxH = window.innerHeight - 40;
      const s = Math.min(maxW / CANVAS_W, maxH / CANVAS_H, 1);
      this.renderer.domElement.style.width = `${CANVAS_W * s}px`;
      this.renderer.domElement.style.height = `${CANVAS_H * s}px`;
      if (this.minimap) {
        this.minimap.style.right = `${20 * s}px`;
        this.minimap.style.bottom = `${20 * s}px`;
      }
    };
    window.addEventListener('resize', resize);
    resize();
  }

  _initLights() {
    const ambient = new THREE.AmbientLight(0x8aadcf, 0.45);
    this.scene.add(ambient);

    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x3d6b2e, 0.55);
    this.scene.add(hemi);

    this.sun = new THREE.DirectionalLight(0xfff4e0, 1.4);
    this.sun.position.set(40, 60, 30);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -60;
    this.sun.shadow.camera.right = 60;
    this.sun.shadow.camera.top = 60;
    this.sun.shadow.camera.bottom = -60;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 150;
    this.sun.target = new THREE.Object3D();
    this.scene.add(this.sun.target);
    this.scene.add(this.sun);
  }

  _initMinimap() {
    this.minimap = document.createElement('canvas');
    this.minimap.width = 120;
    this.minimap.height = 90;
    this.minimap.style.cssText = 'position:absolute;right:20px;bottom:20px;border:2px solid #ff8800;background:rgba(0,0,0,0.7);pointer-events:none;z-index:5';
    this.minimapCtx = this.minimap.getContext('2d');
    this.container.appendChild(this.minimap);
  }

  gx(x) { return (x - CX) * SCALE; }
  gz(y) { return (y - CY) * SCALE; }

  _mat(color, opts = {}) {
    const c = new THREE.Color(color);
    return new THREE.MeshStandardMaterial({
      color: c,
      metalness: opts.metalness ?? 0.15,
      roughness: opts.roughness ?? 0.75,
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

    const grassGeo = new THREE.PlaneGeometry(130, 90, 1, 1);
    const grass = new THREE.Mesh(grassGeo, this._mat(SURFACE.GRASS.color, { roughness: 0.95 }));
    grass.rotation.x = -Math.PI / 2;
    grass.receiveShadow = true;
    this.trackGroup.add(grass);

    for (const surf of track.surfaces) {
      if (surf.type === 'GRASS') continue;
      this._addSurface(surf);
    }

    for (const wall of track.walls) {
      const w = wall.w * SCALE;
      const h = wall.h * SCALE;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, 1.4, h),
        this._mat('#555555', { metalness: 0.3, roughness: 0.6 })
      );
      mesh.position.set(
        this.gx(wall.x + wall.w / 2),
        0.7,
        this.gz(wall.y + wall.h / 2)
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this._addStripes(mesh, w, h);
      this.trackGroup.add(mesh);
    }

    for (const dec of track.decorations || []) {
      this._addDecoration(dec);
    }

    for (const cp of track.checkpoints) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(cp.radius * SCALE * 0.9, 0.08, 8, 32),
        new THREE.MeshStandardMaterial({ color: 0xffff00, transparent: true, opacity: 0.35 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(this.gx(cp.x), 0.15, this.gz(cp.y));
      this.trackGroup.add(ring);
    }

    const start = track.starts[0];
    for (let i = 0; i < 10; i++) {
      const tile = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.06, 0.7),
        this._mat(i % 2 === 0 ? '#ffffff' : '#111111', { roughness: 0.5 })
      );
      tile.position.set(this.gx(start.x), 0.04, this.gz(start.y) + (i - 5) * 0.75);
      tile.rotation.y = -start.angle + Math.PI / 2;
      this.trackGroup.add(tile);
    }
  }

  _addSurface(surf) {
    const s = SURFACE[surf.type];
    const mat = this._mat(s.color, { roughness: surf.type === 'WATER' ? 0.2 : 0.85, metalness: surf.type === 'WATER' ? 0.6 : 0.1 });
    let mesh;

    if (surf.shape === 'ellipse') {
      mesh = new THREE.Mesh(new THREE.CircleGeometry(1, 48), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(this.gx(surf.cx), 0.06, this.gz(surf.cy));
      mesh.scale.set(surf.rx * SCALE, surf.ry * SCALE, 1);
    } else {
      mesh = new THREE.Mesh(
        new THREE.BoxGeometry(surf.w * SCALE, 0.08, surf.h * SCALE),
        mat
      );
      mesh.position.set(
        this.gx(surf.x + surf.w / 2),
        0.06,
        this.gz(surf.y + surf.h / 2)
      );
    }
    mesh.receiveShadow = true;
    this.trackGroup.add(mesh);
  }

  _addStripes(barrier, w, h) {
    const isHoriz = w > h;
    const count = Math.floor((isHoriz ? w : h) / 0.8);
    for (let i = 0; i < count; i++) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(isHoriz ? 0.4 : w * 1.02, 1.42, isHoriz ? h * 1.02 : 0.4),
        this._mat(i % 2 === 0 ? '#cc2222' : '#eeeeee', { roughness: 0.5 })
      );
      stripe.position.copy(barrier.position);
      if (isHoriz) stripe.position.x += -w / 2 + i * 0.8 + 0.2;
      else stripe.position.z += -h / 2 + i * 0.8 + 0.2;
      this.trackGroup.add(stripe);
    }
  }

  _addDecoration(dec) {
    const x = this.gx(dec.x);
    const z = this.gz(dec.y);
    const s = dec.scale || 1;

    if (dec.type === 'tree') {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15 * s, 0.2 * s, 1.2 * s, 8),
        this._mat('#5c3a1a')
      );
      trunk.position.set(x, 0.6 * s, z);
      trunk.castShadow = true;
      const leaves = new THREE.Mesh(
        new THREE.SphereGeometry(0.9 * s, 10, 10),
        this._mat('#2d7a2d', { roughness: 0.9 })
      );
      leaves.position.set(x, 1.8 * s, z);
      leaves.castShadow = true;
      this.trackGroup.add(trunk, leaves);
    } else if (dec.type === 'tire') {
      for (let i = 0; i < 3; i++) {
        const tire = new THREE.Mesh(
          new THREE.TorusGeometry(0.35 * s, 0.14 * s, 8, 16),
          this._mat('#1a1a1a', { roughness: 0.95 })
        );
        tire.rotation.x = Math.PI / 2;
        tire.position.set(x + (i - 1) * 0.9 * s, 0.35 * s, z);
        tire.castShadow = true;
        this.trackGroup.add(tire);
      }
    } else if (dec.type === 'grandstand') {
      const stand = new THREE.Mesh(
        new THREE.BoxGeometry(5 * s, 1.5 * s, 2 * s),
        this._mat('#888888', { roughness: 0.7 })
      );
      stand.position.set(x, 0.75 * s, z);
      stand.castShadow = true;
      this.trackGroup.add(stand);
    } else if (dec.type === 'cone') {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(0.3 * s, 0.8 * s, 8),
        this._mat('#ff6600')
      );
      cone.position.set(x, 0.4 * s, z);
      cone.castShadow = true;
      this.trackGroup.add(cone);
    }
  }

  createTruck(car) {
    const group = new THREE.Group();
    const bodyColor = new THREE.Color(car.color.body);
    const darkColor = new THREE.Color(car.color.dark);
    const trimColor = new THREE.Color(car.color.trim);

    const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, metalness: 0.55, roughness: 0.35 });
    const darkMat = new THREE.MeshStandardMaterial({ color: darkColor, metalness: 0.4, roughness: 0.5 });
    const trimMat = new THREE.MeshStandardMaterial({ color: trimColor, metalness: 0.6, roughness: 0.4 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x88bbdd, metalness: 0.8, roughness: 0.1, transparent: true, opacity: 0.7 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.2 });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.45, 3.8), darkMat);
    chassis.position.y = 0.55;
    chassis.castShadow = true;
    group.add(chassis);

    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 1.6), bodyMat);
    bed.position.set(0, 0.75, -1.0);
    bed.castShadow = true;
    group.add(bed);

    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.85, 1.5), bodyMat);
    cab.position.set(0, 1.05, 0.85);
    cab.castShadow = true;
    group.add(cab);

    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 1.1), trimMat);
    hood.position.set(0, 0.85, 1.85);
    hood.castShadow = true;
    group.add(hood);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.55, 0.08), glassMat);
    windshield.position.set(0, 1.2, 1.35);
    windshield.rotation.x = -0.3;
    group.add(windshield);

    const bumperF = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 0.15), chromeMat);
    bumperF.position.set(0, 0.45, 2.35);
    group.add(bumperF);

    const bumperR = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 0.15), chromeMat);
    bumperR.position.set(0, 0.45, -1.85);
    group.add(bumperR);

    const rollBar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 1.2), chromeMat);
    rollBar.position.set(0, 1.45, 0.3);
    group.add(rollBar);

    const wheels = [];
    const wheelPositions = [
      [0.85, 0.4, 1.3], [-0.85, 0.4, 1.3],
      [0.9, 0.4, -1.2], [-0.9, 0.4, -1.2],
    ];
    for (const [wx, wy, wz] of wheelPositions) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.32, 20), wheelMat);
      tire.rotation.z = Math.PI / 2;
      tire.position.set(wx, wy, wz);
      tire.castShadow = true;
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.34, 12), chromeMat);
      rim.rotation.z = Math.PI / 2;
      rim.position.set(wx, wy, wz);
      group.add(tire, rim);
      wheels.push(tire);
    }

    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 6), chromeMat);
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(0.5, 0.5, -1.9);
    group.add(exhaust);

    if (car.isPlayer) {
      const light = new THREE.PointLight(0xffffcc, 0.3, 8);
      light.position.set(0, 1.5, 2);
      group.add(light);
    }

    group.scale.setScalar(0.55);
    this.scene.add(group);
    this.carMeshes.set(car, { group, wheels, exhaust });
  }

  syncCars(cars) {
    for (const car of cars) {
      if (!this.carMeshes.has(car)) this.createTruck(car);
      const { group, wheels, exhaust } = this.carMeshes.get(car);

      group.position.set(this.gx(car.x), 0, this.gz(car.y));
      group.rotation.y = -car.angle + Math.PI / 2;

      const roll = this.frame * Math.abs(car.speed) * 0.15;
      for (const w of wheels) {
        w.rotation.x = roll;
      }

      if (car.nitroActive) {
        exhaust.material.emissive = new THREE.Color(0xff4400);
        exhaust.material.emissiveIntensity = 2;
      } else {
        exhaust.material.emissive = new THREE.Color(0x000000);
        exhaust.material.emissiveIntensity = 0;
      }
    }
  }

  spawnDust(x, y, color) {
    if (this.dustParticles.length > 200) this.dustParticles.shift();
    const geo = new THREE.SphereGeometry(0.15 + Math.random() * 0.2, 6, 6);
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity: 0.6,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(this.gx(x), 0.3 + Math.random() * 0.5, this.gz(y));
    this.scene.add(mesh);
    this.dustParticles.push({ mesh, life: 1.0, vy: 0.02 + Math.random() * 0.03 });
  }

  updateDust() {
    for (let i = this.dustParticles.length - 1; i >= 0; i--) {
      const p = this.dustParticles[i];
      p.life -= 0.03;
      p.mesh.position.y += p.vy;
      p.mesh.material.opacity = p.life * 0.5;
      p.mesh.scale.multiplyScalar(1.02);
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
    const dist = 10;
    const height = 5.5;

    const targetX = px - Math.sin(angle) * dist;
    const targetZ = pz - Math.cos(angle) * dist;

    this.camera.position.lerp(new THREE.Vector3(targetX, height, targetZ), 0.08);
    this.cameraTarget.lerp(new THREE.Vector3(px, 1.2, pz), 0.12);
    this.camera.lookAt(this.cameraTarget);

    this.sun.position.set(px + 30, 50, pz + 20);
    this.sun.target.position.set(px, 0, pz);
    this.sun.target.updateMatrixWorld();
  }

  drawMinimap(track, cars) {
    const ctx = this.minimapCtx;
    const w = 120, h = 90;
    ctx.fillStyle = 'rgba(20,40,15,0.9)';
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
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 9px sans-serif';
    ctx.fillText('MAP', 4, h - 4);
  }

  render(track, cars, player) {
    this.frame++;
    this.syncCars(cars);
    this.updateDust();
    this.updateCamera(player);
    if (track) this.drawMinimap(track, cars);
    this.renderer.render(this.scene, this.camera);
  }

  clear() {}
  drawTrack() {}
  drawCar() {}
  drawParticles() {}
  drawSkidMarks() {}
}
