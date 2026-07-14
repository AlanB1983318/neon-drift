import { clamp, dist, SURFACE, LAPS_PER_RACE } from './utils.js?v=13';

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

    this.heldItem = null;
    this.itemCooldown = 0;
    this.itemUseLock = 0;
    this.starTimer = 0;
    this.shrinkTimer = 0;
    this.boostTimer = 0;
    this.spinTimer = 0;
    this.spinAngle = 0;
    this.driftCharge = 0;
    this.driftBoostTimer = 0;
    this.driftSteer = 0;
    this.coins = 0;
    this.launchBoost = 0;
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
    this.heldItem = null;
    this.itemCooldown = 0;
    this.itemUseLock = 0;
    this.starTimer = 0;
    this.shrinkTimer = 0;
    this.boostTimer = 0;
    this.spinTimer = 0;
    this.driftCharge = 0;
    this.driftBoostTimer = 0;
    this.coins = 0;
    this.launchBoost = 0;
  }

  spinOut(frames = 75) {
    if (this.starTimer > 0) return;
    this.spinTimer = frames;
    this.spinAngle = 0;
    this.speed *= 0.35;
  }

  applyBoost(frames = 90) {
    this.boostTimer = Math.max(this.boostTimer, frames);
  }

  applyStar(frames = 300) {
    this.starTimer = frames;
    this.shrinkTimer = 0;
    this.spinTimer = 0;
    this.applyBoost(frames);
  }

  applyShrink(frames = 180) {
    if (this.starTimer > 0) return;
    this.shrinkTimer = frames;
    this.speed *= 0.55;
  }

  getScale() {
    return this.shrinkTimer > 0 ? 0.72 : 1;
  }

  isInvincible() {
    return this.starTimer > 0;
  }

  _tickStatus() {
    if (this.itemCooldown > 0) this.itemCooldown--;
    if (this.itemUseLock > 0) this.itemUseLock--;
    if (this.starTimer > 0) this.starTimer--;
    if (this.shrinkTimer > 0) this.shrinkTimer--;
    if (this.boostTimer > 0) this.boostTimer--;
    if (this.driftBoostTimer > 0) this.driftBoostTimer--;
    if (this.launchBoost > 0) this.launchBoost--;
    if (this.spinTimer > 0) {
      this.spinTimer--;
      this.spinAngle += 0.35;
      this.speed *= 0.92;
      return true;
    }
    return false;
  }

  _updateDrift(input, surface, maxSpd) {
    if (!this.isPlayer || !input) return;
    const canDrift = (surface === 'DIRT' || surface === 'ASPHALT') && Math.abs(this.speed) > 2.5;
    const steering = (input.left ? -1 : 0) + (input.right ? 1 : 0);

    if (canDrift && steering !== 0 && input.up) {
      if (this.driftSteer === steering) {
        this.driftCharge = Math.min(90, this.driftCharge + 1);
      } else {
        this.driftSteer = steering;
        this.driftCharge = 0;
      }
      if (this.driftCharge >= 75 && this.driftBoostTimer <= 0) {
        this.driftBoostTimer = 50;
        this.driftCharge = 0;
        this.speed = Math.min(maxSpd * 1.2, this.speed + 2.5);
      }
    } else {
      this.driftCharge = Math.max(0, this.driftCharge - 2);
      if (steering === 0) this.driftSteer = 0;
    }
  }

  update(input, surface, dt, raceStarted) {
    if (this.finished || !raceStarted) return;

    this.raceTime += dt;
    if (this._tickStatus()) return;

    const surf = SURFACE[surface] || SURFACE.DIRT;
    let maxSpd = this.stats.maxSpeed * surf.maxMult;
    if (this.shrinkTimer > 0) maxSpd *= 0.7;
    if (this.starTimer > 0) maxSpd *= 1.25;
    if (this.boostTimer > 0 || this.driftBoostTimer > 0 || this.launchBoost > 0) maxSpd *= 1.3;

    const accel = this.stats.accel;
    const turn = this.stats.turnRate * (this.shrinkTimer > 0 ? 1.15 : 1);

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

      this._updateDrift(input, surface, maxSpd);
    }

    this.speed *= surf.friction;
    this.speed = clamp(this.speed, -maxSpd * 0.4, maxSpd);

    if (this.nitroActive || this.boostTimer > 0 || this.starTimer > 0) {
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
    if (this._tickStatus()) return;

    const surf = SURFACE[surface] || SURFACE.DIRT;
    let maxSpd = this.stats.maxSpeed * surf.maxMult * (0.92 + Math.random() * 0.06);
    if (this.shrinkTimer > 0) maxSpd *= 0.7;
    if (this.starTimer > 0) maxSpd *= 1.25;
    if (this.boostTimer > 0) maxSpd *= 1.3;

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
    if (this.starTimer > 0) return;
    for (const wall of walls) {
      const hit = this._circleRect(this.x, this.y, this.radius * this.getScale(), wall);
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
      const minD = (this.radius + other.radius) * (this.getScale() + other.getScale()) * 0.5;
      if (d < minD && d > 0) {
        if (this.starTimer > 0 && other.starTimer <= 0) {
          other.spinOut(60);
          other.speed *= 0.4;
          continue;
        }
        if (other.starTimer > 0 && this.starTimer <= 0) {
          this.spinOut(60);
          this.speed *= 0.4;
          continue;
        }
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
