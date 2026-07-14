import { clamp, dist, SURFACE, LAPS_PER_RACE } from './utils.js?v=9';

export class Car {
  constructor(x, y, angle, stats, color, isPlayer = false, number = 1) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.stats = stats;
    this.color = color;
    this.isPlayer = isPlayer;
    this.number = number;

    this.speed = 0;
    this.vx = 0;
    this.vy = 0;
    this.nitro = stats.nitroMax;
    this.nitroActive = false;

    this.lap = 0;
    this.checkpoint = 0;
    this.finished = false;
    this.finishTime = 0;
    this.raceTime = 0;

    this.width = 30;
    this.height = 42;
    this.radius = 16;
  }

  reset(x, y, angle) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = 0;
    this.vx = 0;
    this.vy = 0;
    this.nitro = this.stats.nitroMax;
    this.nitroActive = false;
    this.lap = 0;
    this.checkpoint = 0;
    this.finished = false;
    this.finishTime = 0;
    this.raceTime = 0;
  }

  update(input, surface, dt, raceStarted) {
    if (this.finished || !raceStarted) return;

    this.raceTime += dt;
    const surf = SURFACE[surface] || SURFACE.DIRT;
    const maxSpd = this.stats.maxSpeed * surf.maxMult;
    const accel = this.stats.accel;
    const turn = this.stats.turnRate;

    if (this.isPlayer && input) {
      if (input.up) this.speed += accel;
      if (input.down) this.speed -= accel * 1.4;
      if (input.left) this.angle -= turn * (0.7 + Math.abs(this.speed) * 0.2);
      if (input.right) this.angle += turn * (0.7 + Math.abs(this.speed) * 0.2);

      this.nitroActive = input.nitro && this.nitro > 0 && this.speed > 0.5;
      if (this.nitroActive) {
        this.nitro -= 0.8;
        this.speed += accel * this.stats.nitroPower;
      }
    }

    this.speed *= surf.friction;
    this.speed = clamp(this.speed, -maxSpd * 0.4, maxSpd);

    if (this.nitroActive) {
      this.speed = clamp(this.speed, -maxSpd * 0.4, maxSpd * 1.35);
    }

    const targetVx = Math.cos(this.angle) * this.speed;
    const targetVy = Math.sin(this.angle) * this.speed;
    const drift = surf.name === 'track' ? 0.18 : surf.name === 'mud' ? 0.12 : 0.24;
    this.vx = this.vx * (1 - drift) + targetVx * drift;
    this.vy = this.vy * (1 - drift) + targetVy * drift;

    this.x += this.vx;
    this.y += this.vy;
  }

  applyAI(steerInput, throttle, surface, dt, raceStarted) {
    if (this.finished || !raceStarted) return;

    this.raceTime += dt;
    const surf = SURFACE[surface] || SURFACE.DIRT;
    const maxSpd = this.stats.maxSpeed * surf.maxMult * (0.92 + Math.random() * 0.06);
    const accel = this.stats.accel;

    this.angle += steerInput * this.stats.turnRate * (0.6 + Math.abs(this.speed) * 0.12);
    this.speed += throttle * accel;

    this.speed *= surf.friction;
    this.speed = clamp(this.speed, 0, maxSpd);

    const targetVx = Math.cos(this.angle) * this.speed;
    const targetVy = Math.sin(this.angle) * this.speed;
    const drift = 0.14;
    this.vx = this.vx * (1 - drift) + targetVx * drift;
    this.vy = this.vy * (1 - drift) + targetVy * drift;

    this.x += this.vx;
    this.y += this.vy;
  }

  collideWalls(walls) {
    for (const wall of walls) {
      const hit = this._circleRect(this.x, this.y, this.radius, wall);
      if (hit) {
        this.x += hit.nx * hit.overlap;
        this.y += hit.ny * hit.overlap;
        const dot = this.vx * hit.nx + this.vy * hit.ny;
        if (dot < 0) {
          this.vx -= dot * hit.nx * 1.4;
          this.vy -= dot * hit.ny * 1.4;
        }
        this.speed *= 0.6;
      }
    }
  }

  collideCars(others) {
    for (const other of others) {
      if (other === this) continue;
      const d = dist(this.x, this.y, other.x, other.y);
      const minD = this.radius + other.radius;
      if (d < minD && d > 0) {
        const nx = (this.x - other.x) / d;
        const ny = (this.y - other.y) / d;
        const overlap = minD - d;
        this.x += nx * overlap * 0.5;
        this.y += ny * overlap * 0.5;
        other.x -= nx * overlap * 0.5;
        other.y -= ny * overlap * 0.5;
        this.speed *= 0.85;
        other.speed *= 0.85;
      }
    }
  }

  _circleRect(cx, cy, r, rect) {
    const nearX = clamp(cx, rect.x, rect.x + rect.w);
    const nearY = clamp(cy, rect.y, rect.y + rect.h);
    const dx = cx - nearX;
    const dy = cy - nearY;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d >= r || d === 0) return null;
    return { nx: dx / d, ny: dy / d, overlap: r - d };
  }

  checkCheckpoint(checkpoints) {
    if (this.finished) return;
    const cp = checkpoints[this.checkpoint];
    if (!cp) return;
    if (dist(this.x, this.y, cp.x, cp.y) < cp.radius) {
      this.checkpoint++;
      if (this.checkpoint >= checkpoints.length) {
        this.checkpoint = 0;
        this.lap++;
        if (this.lap >= LAPS_PER_RACE) {
          this.finished = true;
          this.finishTime = this.raceTime;
        }
      }
    }
  }
}
