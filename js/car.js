import { clamp, dist, SURFACE, LAPS_PER_RACE } from './utils.js?v=27';

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
    this.checkpointCooldown = 0;
    this.leftStartZone = false;
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
    this.checkpointCooldown = 0;
    this.leftStartZone = false;
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
    const canDrift = (surface === 'DIRT' || surface === 'ASPHALT') && Math.abs(this.speed) > 2;
    const steering = (input.left && !input.right ? -1 : 0) + (input.right && !input.left ? 1 : 0);

    if (canDrift && steering !== 0 && (input.up || !input.down)) {
      if (this.driftSteer === steering) {
        this.driftCharge = Math.min(90, this.driftCharge + 1.4);
      } else {
        this.driftSteer = steering;
        this.driftCharge = 0;
      }
      if (this.driftCharge >= 50 && this.driftBoostTimer <= 0) {
        this.driftBoostTimer = 55;
        this.driftCharge = 0;
        this.speed = Math.min(maxSpd * 1.2, this.speed + 3);
      }
    } else {
      this.driftCharge = Math.max(0, this.driftCharge - 2);
      if (steering === 0) this.driftSteer = 0;
    }
  }

  _playerTraction(surface) {
    const surf = SURFACE[surface] || SURFACE.DIRT;
    if (surf.name === 'track') return 0.4;
    if (surf.name === 'boost') return 0.42;
    if (surf.name === 'grass') return 0.26;
    if (surf.name === 'mud') return 0.18;
    return 0.22;
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
      if (input.down) {
        this.speed -= accel * 1.1;
      } else if (input.up) {
        this.speed += accel;
      } else {
        this.speed += accel * 0.7;
      }

      const steer = (input.left && !input.right ? -1 : 0) + (input.right && !input.left ? 1 : 0);
      const turnMult = 1.15 + Math.abs(this.speed) * 0.08;
      if (steer !== 0) {
        this.angle += steer * turn * turnMult;
      }

      this.nitroActive = input.nitro && this.nitro > 0 && this.speed > 0.3;
      if (this.nitroActive) {
        this.nitro -= 0.7;
        this.speed += accel * this.stats.nitroPower;
      }

      this._updateDrift(input, surface, maxSpd);
    }

    this.speed *= surf.friction;
    this.speed = clamp(this.speed, -maxSpd * 0.35, maxSpd);

    if (this.nitroActive || this.boostTimer > 0 || this.starTimer > 0) {
      this.speed = clamp(this.speed, -maxSpd * 0.35, maxSpd * 1.35);
    }

    const targetVx = Math.cos(this.angle) * this.speed;
    const targetVy = Math.sin(this.angle) * this.speed;
    const drift = this.isPlayer ? this._playerTraction(surface) : (surf.name === 'track' ? 0.18 : surf.name === 'mud' ? 0.12 : 0.24);
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
    const bounce = this.isPlayer ? 0.78 : 0.6;
    for (const wall of walls) {
      const hit = this._circleRect(this.x, this.y, this.radius * this.getScale(), wall);
      if (hit) {
        this.x += hit.nx * hit.overlap;
        this.y += hit.ny * hit.overlap;
        const dot = this.vx * hit.nx + this.vy * hit.ny;
        if (dot < 0) {
          this.vx -= dot * hit.nx * 1.2;
          this.vy -= dot * hit.ny * 1.2;
        }
        this.speed *= bounce;
      }
    }
  }

  collideCars(others) {
    const myR = this.radius * this.getScale();
    for (const other of others) {
      if (other === this) continue;
      const d = dist(this.x, this.y, other.x, other.y);
      const otherR = other.radius * other.getScale();
      const minD = myR + otherR;
      if (d >= minD || d <= 0) continue;

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
      const push = overlap * 0.25;
      this.x += nx * push * 0.5;
      this.y += ny * push * 0.5;
      other.x -= nx * push * 0.5;
      other.y -= ny * push * 0.5;
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
    if (this.checkpointCooldown > 0) {
      this.checkpointCooldown--;
      return;
    }

    const cp = checkpoints[this.checkpoint];
    if (!cp) return;

    const inZone = dist(this.x, this.y, cp.x, cp.y) < cp.radius;

    // Cars spawn inside the start/finish line — wait until they drive out once.
    if (this.checkpoint === 0 && !this.leftStartZone) {
      if (!inZone) this.leftStartZone = true;
      return;
    }

    if (!inZone) return;

    if (Math.abs(this.speed) > 0.3 && checkpoints.length > 1) {
      const next = checkpoints[(this.checkpoint + 1) % checkpoints.length];
      const exitAngle = Math.atan2(next.y - cp.y, next.x - cp.x);
      const forward = Math.cos(this.angle) * Math.cos(exitAngle) + Math.sin(this.angle) * Math.sin(exitAngle);
      if (forward < -0.3) return;
    }

    const passedIndex = this.checkpoint;
    this.checkpoint = (this.checkpoint + 1) % checkpoints.length;
    this.checkpointCooldown = 25;

    // Lap completes when crossing the start/finish line (checkpoint 0).
    if (passedIndex === 0 && this.leftStartZone) {
      this.lap++;
      if (this.lap >= LAPS_PER_RACE) {
        this.finished = true;
        this.finishTime = this.raceTime;
      }
    }
  }
}
