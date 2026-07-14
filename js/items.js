import { dist, clamp } from './utils.js?v=29';

export const ITEMS = {
  BOOST: { name: 'Turbo Mushroom', icon: '🍄', color: '#ff4444' },
  SHELL: { name: 'Racing Shell', icon: '🐢', color: '#44cc44' },
  BANANA: { name: 'Banana Peel', icon: '🍌', color: '#ffdd22' },
  STAR: { name: 'Super Star', icon: '⭐', color: '#ffee44' },
  LIGHTNING: { name: 'Bolt Strike', icon: '⚡', color: '#88ccff' },
};

export function rollItem(position) {
  const r = Math.random();
  if (position >= 4) {
    if (r < 0.32) return 'BOOST';
    if (r < 0.52) return 'STAR';
    if (r < 0.68) return 'LIGHTNING';
    if (r < 0.84) return 'SHELL';
    return 'BANANA';
  }
  if (position === 3) {
    if (r < 0.28) return 'BOOST';
    if (r < 0.48) return 'SHELL';
    if (r < 0.62) return 'STAR';
    if (r < 0.76) return 'BANANA';
    return 'LIGHTNING';
  }
  if (position === 2) {
    if (r < 0.35) return 'BANANA';
    if (r < 0.58) return 'SHELL';
    if (r < 0.74) return 'BOOST';
    return 'LIGHTNING';
  }
  if (r < 0.45) return 'BANANA';
  if (r < 0.75) return 'SHELL';
  return 'BANANA';
}

export class ItemSystem {
  constructor() {
    this.boxes = [];
    this.projectiles = [];
    this.traps = [];
    this.coins = [];
    this.lightningFlash = 0;
    this.frame = 0;
  }

  init(track) {
    this.boxes = (track.itemBoxes || []).map((b) => ({
      x: b.x,
      y: b.y,
      radius: b.radius || 28,
      active: true,
      respawn: 0,
      spin: Math.random() * Math.PI * 2,
    }));
    this.projectiles = [];
    this.traps = [];
    this.coins = (track.coins || []).map((c) => ({
      x: c.x,
      y: c.y,
      radius: c.radius || 14,
      active: true,
      respawn: 0,
      bob: Math.random() * Math.PI * 2,
    }));
    this.lightningFlash = 0;
    this.frame = 0;
  }

  update(cars, getPosition, walls = []) {
    this.frame++;
    for (const box of this.boxes) {
      box.spin += 0.06;
      if (!box.active) {
        box.respawn--;
        if (box.respawn <= 0) box.active = true;
      }
    }
    for (const coin of this.coins) {
      coin.bob += 0.08;
      if (!coin.active) {
        coin.respawn--;
        if (coin.respawn <= 0) coin.active = true;
      }
    }
    if (this.lightningFlash > 0) this.lightningFlash--;

    for (const car of cars) {
      if (car.finished || car.spinTimer > 0) continue;
      this._tryPickupBox(car, getPosition);
      this._tryPickupCoin(car);
    }

    this._updateProjectiles(cars, walls);
    this._updateTraps(cars);
  }

  _tryPickupBox(car, getPosition) {
    if (car.heldItem || car.itemCooldown > 0) return;
    for (const box of this.boxes) {
      if (!box.active) continue;
      if (dist(car.x, car.y, box.x, box.y) < box.radius + car.radius) {
        const pos = getPosition(car);
        car.heldItem = rollItem(pos);
        car.itemCooldown = 90;
        box.active = false;
        box.respawn = 360;
        return;
      }
    }
  }

  _tryPickupCoin(car) {
    for (const coin of this.coins) {
      if (!coin.active) continue;
      if (dist(car.x, car.y, coin.x, coin.y) < coin.radius + car.radius * 0.6) {
        car.coins++;
        coin.active = false;
        coin.respawn = 480;
      }
    }
  }

  useItem(car, cars) {
    if (!car.heldItem || car.spinTimer > 0 || car.itemUseLock > 0) return false;
    const type = car.heldItem;
    car.heldItem = null;
    car.itemUseLock = 20;

    switch (type) {
      case 'BOOST':
        car.applyBoost(90);
        break;
      case 'SHELL':
        this.projectiles.push({
          x: car.x,
          y: car.y,
          angle: car.angle,
          speed: 9,
          owner: car,
          life: 240,
        });
        break;
      case 'BANANA':
        this.traps.push({
          x: car.x - Math.cos(car.angle) * 28,
          y: car.y - Math.sin(car.angle) * 28,
          owner: car,
          life: 900,
        });
        break;
      case 'STAR':
        car.applyStar(300);
        break;
      case 'LIGHTNING':
        this.lightningFlash = 45;
        for (const other of cars) {
          if (other !== car && !other.starTimer) {
            other.applyShrink(180);
          }
        }
        break;
    }
    return true;
  }

  _hitsWall(x, y, walls, pad = 8) {
    for (const wall of walls) {
      if (
        x >= wall.x - pad && x <= wall.x + wall.w + pad
        && y >= wall.y - pad && y <= wall.y + wall.h + pad
      ) {
        return true;
      }
    }
    return false;
  }

  _updateProjectiles(cars, walls = []) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += Math.cos(p.angle) * p.speed;
      p.y += Math.sin(p.angle) * p.speed;
      p.life--;

      let hit = false;
      for (const car of cars) {
        if (car === p.owner || car.finished || car.starTimer > 0) continue;
        if (dist(p.x, p.y, car.x, car.y) < car.radius + 10) {
          car.spinOut(75);
          car.speed *= 0.3;
          hit = true;
          break;
        }
      }
      if (
        hit || p.life <= 0 || p.x < 0 || p.x > 960 || p.y < 0 || p.y > 640
        || this._hitsWall(p.x, p.y, walls)
      ) {
        this.projectiles.splice(i, 1);
      }
    }
  }

  _updateTraps(cars) {
    for (let i = this.traps.length - 1; i >= 0; i--) {
      const trap = this.traps[i];
      trap.life--;
      let removed = false;

      for (const car of cars) {
        if (car.finished || car.starTimer > 0 || car === trap.owner) continue;
        if (dist(car.x, car.y, trap.x, trap.y) < car.radius + 12) {
          car.spinOut(90);
          car.speed *= 0.25;
          this.traps.splice(i, 1);
          removed = true;
          break;
        }
      }

      if (!removed && trap.life <= 0) {
        this.traps.splice(i, 1);
      }
    }
  }

  aiUseItem(car, cars, getPosition) {
    if (!car.heldItem || car.spinTimer > 0 || Math.random() > 0.02) return;
    const pos = getPosition(car);
    const type = car.heldItem;

    if (type === 'BOOST' || type === 'STAR') {
      this.useItem(car, cars);
      return;
    }
    if (type === 'LIGHTNING' && pos >= 3) {
      this.useItem(car, cars);
      return;
    }
    if (type === 'SHELL') {
      const ahead = cars.find((c) => c !== car && !c.finished && getPosition(c) < pos);
      if (ahead && dist(car.x, car.y, ahead.x, ahead.y) < 200) {
        car.angle = Math.atan2(ahead.y - car.y, ahead.x - car.x);
        this.useItem(car, cars);
      }
    }
    if (type === 'BANANA' && pos <= 2) {
      this.useItem(car, cars);
    }
  }
}

export function boxesFromWaypoints(waypoints, step = 3) {
  return waypoints
    .filter((_, i) => i % step === 0)
    .slice(0, 4)
    .map((wp) => ({ x: wp.x, y: wp.y, radius: 30 }));
}

export function coinsFromWaypoints(waypoints, step = 2) {
  return waypoints
    .filter((_, i) => i % step === 1)
    .slice(0, 5)
    .map((wp, i) => ({
      x: wp.x + (i % 2 === 0 ? 18 : -18),
      y: wp.y + (i % 3 === 0 ? 14 : -14),
      radius: 12,
    }));
}
