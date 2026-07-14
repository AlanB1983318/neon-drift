import { clamp, dist, rand, pick, angleTo, lerp } from './utils.js';
import { traitWeight } from './mind.js';

const KINDS = [
  { kind: 'thought', weight: 34, value: 8, r: 9 },
  { kind: 'locked', weight: 16, value: 18, r: 11 },
  { kind: 'echo', weight: 0, value: 22, r: 10 }, // handled via NPC
  { kind: 'core', weight: 8, value: 40, r: 14 },
  { kind: 'spark', weight: 12, value: 28, r: 8 },
];

export class Simulation {
  constructor(mind, width, height) {
    this.mind = mind;
    this.radius = 520;
    this.duration = 75;
    this.timeLeft = this.duration;
    this.energy = 100;
    this.score = 0;
    this.collected = { thought: 0, locked: 0, echo: 0, core: 0, spark: 0 };
    this.bonds = 0;
    this.logs = [];
    this.finished = false;
    this.result = null;

    this.agent = {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      angle: 0,
      speed: 0,
      trail: [],
      target: null,
      solveTimer: 0,
      solving: null,
    };

    this.camera = { x: 0, y: 0 };
    this.nudge = { x: 0, y: 0, until: 0 };
    this.nodes = [];
    this.echoes = [];
    this._spawnWorld();
    this.log(`${mind.name} awakens as ${mind.archetype.name}.`);
  }

  log(msg) {
    this.logs.unshift(msg);
    if (this.logs.length > 6) this.logs.pop();
  }

  _spawnWorld() {
    const count = 42;
    for (let i = 0; i < count; i++) {
      const kindDef = this._weightedKind();
      const pos = this._randInRadius(this.radius * 0.88);
      this.nodes.push({
        id: i,
        kind: kindDef.kind,
        x: pos.x,
        y: pos.y,
        r: kindDef.r,
        value: kindDef.value,
        taken: false,
        phase: rand(0, Math.PI * 2),
        lockProgress: 0,
      });
    }

    for (let i = 0; i < 5; i++) {
      const pos = this._randInRadius(this.radius * 0.75);
      this.echoes.push({
        x: pos.x,
        y: pos.y,
        phase: rand(0, Math.PI * 2),
        bonded: false,
        ox: pos.x,
        oy: pos.y,
      });
    }
  }

  _weightedKind() {
    const pool = KINDS.filter((k) => k.kind !== 'echo');
    const total = pool.reduce((s, k) => s + k.weight, 0);
    let r = Math.random() * total;
    for (const k of pool) {
      r -= k.weight;
      if (r <= 0) return k;
    }
    return pool[0];
  }

  _randInRadius(r) {
    const a = Math.random() * Math.PI * 2;
    const d = Math.sqrt(Math.random()) * r;
    return { x: Math.cos(a) * d, y: Math.sin(a) * d };
  }

  setNudge(worldX, worldY) {
    this.nudge.x = worldX;
    this.nudge.y = worldY;
    this.nudge.until = 1.8;
    this.agent.target = null;
    this.log('Creator nudge received.');
  }

  update(dt) {
    if (this.finished) return;

    this.timeLeft -= dt;
    const t = this.mind.traits;
    const w = {
      curiosity: traitWeight(t, 'curiosity'),
      logic: traitWeight(t, 'logic'),
      empathy: traitWeight(t, 'empathy'),
      ambition: traitWeight(t, 'ambition'),
      chaos: traitWeight(t, 'chaos'),
      focus: traitWeight(t, 'focus'),
    };

    // energy drain — logic reduces waste
    const drain = (4.2 - w.logic * 1.6) * dt;
    this.energy = Math.max(0, this.energy - drain);

    this._updateEchoes(dt);
    this._steerAgent(dt, w);
    this._moveAgent(dt, w);
    this._tryCollect(w);
    this._updateCamera(dt);

    if (this.timeLeft <= 0 || this.energy <= 0) {
      this._finish(this.energy <= 0 ? 'energy' : 'time');
    }
  }

  _updateEchoes(dt) {
    for (const e of this.echoes) {
      e.phase += dt;
      e.x = e.ox + Math.cos(e.phase * 0.7) * 28;
      e.y = e.oy + Math.sin(e.phase * 0.55) * 22;
    }
  }

  _steerAgent(dt, w) {
    const a = this.agent;

    if (this.nudge.until > 0) {
      this.nudge.until -= dt;
      a.target = { x: this.nudge.x, y: this.nudge.y, kind: 'nudge', value: 0 };
      return;
    }

    if (a.solving) {
      return;
    }

    // Retarget occasionally; focus keeps target longer
    const retargetChance = (0.018 + w.chaos * 0.025 - w.focus * 0.012) * (60 * dt);
    if (!a.target || a.target.taken || Math.random() < retargetChance) {
      a.target = this._pickTarget(w);
    }
  }

  _pickTarget(w) {
    const a = this.agent;
    let best = null;
    let bestScore = -Infinity;

    for (const n of this.nodes) {
      if (n.taken) continue;
      const d = dist(a.x, a.y, n.x, n.y);
      let desire = n.value;

      if (n.kind === 'thought') desire *= 0.7 + w.curiosity * 0.8;
      if (n.kind === 'locked') desire *= 0.5 + w.logic * 1.2;
      if (n.kind === 'core') desire *= 0.6 + w.ambition * 1.4;
      if (n.kind === 'spark') desire *= 0.4 + w.chaos * 1.5 + w.curiosity * 0.4;

      // distance penalty softened by curiosity, hardened by focus
      const distPenalty = d * (0.035 + w.focus * 0.02 - w.curiosity * 0.012);
      let score = desire - distPenalty;

      // chaos adds noise
      score += (Math.random() - 0.5) * 40 * w.chaos;

      if (score > bestScore) {
        bestScore = score;
        best = n;
      }
    }

    // empathy may prefer nearby unbonded echo
    if (w.empathy > 0.35) {
      for (const e of this.echoes) {
        if (e.bonded) continue;
        const d = dist(a.x, a.y, e.x, e.y);
        const score = 30 * w.empathy - d * 0.04 + rand(-5, 5);
        if (score > bestScore) {
          bestScore = score;
          best = { x: e.x, y: e.y, kind: 'echo-target', echo: e, value: 22, taken: false };
        }
      }
    }

    return best;
  }

  _moveAgent(dt, w) {
    const a = this.agent;
    const maxSpeed = 110 + w.ambition * 55 + w.focus * 20 - w.chaos * 15;

    if (a.solving) {
      a.vx *= 0.9;
      a.vy *= 0.9;
      a.solveTimer -= dt;
      const need = 1.1 - w.logic * 0.55;
      a.solving.lockProgress = clamp(1 - a.solveTimer / Math.max(need, 0.25), 0, 1);
      if (a.solveTimer <= 0) {
        this._collectNode(a.solving, w);
        a.solving = null;
      }
      this._applyVelocity(a, dt);
      return;
    }

    if (!a.target) {
      a.vx *= 0.95;
      a.vy *= 0.95;
      this._applyVelocity(a, dt);
      return;
    }

    const tx = a.target.x;
    const ty = a.target.y;
    const ang = angleTo(a.x, a.y, tx, ty);
    // chaos wobble
    const wobble = (Math.sin(performance.now() / 200) * 0.35 + (Math.random() - 0.5) * 0.2) * w.chaos;
    const steer = ang + wobble;
    const accel = 320 + w.focus * 120;

    a.vx += Math.cos(steer) * accel * dt;
    a.vy += Math.sin(steer) * accel * dt;

    const sp = Math.hypot(a.vx, a.vy);
    if (sp > maxSpeed) {
      a.vx = (a.vx / sp) * maxSpeed;
      a.vy = (a.vy / sp) * maxSpeed;
    }

    a.angle = lerp(a.angle, Math.atan2(a.vy, a.vx), 0.2);
    this._applyVelocity(a, dt);

    a.trail.push({ x: a.x, y: a.y });
    if (a.trail.length > 18) a.trail.shift();
  }

  _applyVelocity(a, dt) {
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    const d = Math.hypot(a.x, a.y);
    if (d > this.radius - 20) {
      const push = (d - (this.radius - 20)) / d;
      a.x -= a.x * push;
      a.y -= a.y * push;
      a.vx *= -0.4;
      a.vy *= -0.4;
    }
  }

  _tryCollect(w) {
    const a = this.agent;
    if (a.solving) return;

    // nodes
    for (const n of this.nodes) {
      if (n.taken) continue;
      if (dist(a.x, a.y, n.x, n.y) < n.r + 14) {
        if (n.kind === 'locked') {
          const need = 1.15 - w.logic * 0.55;
          a.solving = n;
          a.solveTimer = need;
          this.log('Decrypting locked thought…');
          return;
        }
        this._collectNode(n, w);
        return;
      }
    }

    // echoes
    for (const e of this.echoes) {
      if (e.bonded) continue;
      if (dist(a.x, a.y, e.x, e.y) < 28) {
        if (w.empathy < 0.28 && Math.random() > w.empathy) {
          // shy / ignore
          continue;
        }
        e.bonded = true;
        this.bonds += 1;
        this.collected.echo += 1;
        const pts = Math.round(22 * (0.6 + w.empathy));
        this.score += pts;
        this.energy = Math.min(100, this.energy + 8 * w.empathy);
        this.log(`Bonded with an echo mind (+${pts}).`);
        this.onCollect?.('echo', e.x, e.y);
        return;
      }
    }
  }

  _collectNode(n, w) {
    if (n.taken) return;
    n.taken = true;
    this.agent.target = null;

    let mult = 1;
    if (n.kind === 'thought') mult = 0.8 + w.curiosity * 0.5;
    if (n.kind === 'locked') mult = 0.9 + w.logic * 0.6;
    if (n.kind === 'core') mult = 0.85 + w.ambition * 0.7;
    if (n.kind === 'spark') mult = 0.75 + w.chaos * 0.8;

    const pts = Math.round(n.value * mult);
    this.score += pts;
    this.collected[n.kind] = (this.collected[n.kind] || 0) + 1;
    this.energy = Math.min(100, this.energy + (n.kind === 'core' ? 12 : 5));

    const labels = {
      thought: 'Absorbed a thought',
      locked: 'Cracked a locked node',
      core: 'Claimed an ambition core',
      spark: 'Caught a chaos spark',
    };
    this.log(`${labels[n.kind] || 'Collected signal'} (+${pts}).`);
    this.onCollect?.(n.kind, n.x, n.y);
  }

  _updateCamera(dt) {
    this.camera.x = lerp(this.camera.x, this.agent.x, 1 - Math.pow(0.001, dt));
    this.camera.y = lerp(this.camera.y, this.agent.y, 1 - Math.pow(0.001, dt));
  }

  screenToWorld(sx, sy, viewW, viewH) {
    return {
      x: sx - viewW / 2 + this.camera.x,
      y: sy - viewH / 2 + this.camera.y,
    };
  }

  _finish(reason) {
    this.finished = true;
    const diversity = Object.values(this.collected).filter((v) => v > 0).length;
    const bonus = this.bonds * 15 + diversity * 20;
    const finalScore = this.score + bonus;
    const insight = Math.max(1, Math.round(finalScore / 12) + this.bonds);

    const verdict = this._verdict(reason, finalScore);
    this.result = {
      name: this.mind.name,
      archetype: this.mind.archetype.name,
      score: finalScore,
      insightGained: insight,
      collected: { ...this.collected },
      bonds: this.bonds,
      reason,
      verdict,
    };
  }

  _verdict(reason, score) {
    const arch = this.mind.archetype.name;
    if (score >= 380) {
      return `${this.mind.name} exceeded design expectations. ${arch} behavior produced a brilliant run.`;
    }
    if (score >= 220) {
      return `${this.mind.name} found a coherent identity. ${arch} tendencies shaped a solid awakening.`;
    }
    if (reason === 'energy') {
      return `${this.mind.name} burned out early. Try more Logic or Focus next time.`;
    }
    return `${this.mind.name} wandered without peaking. Rebalance traits and awaken again.`;
  }
}
