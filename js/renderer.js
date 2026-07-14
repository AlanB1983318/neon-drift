import { SURFACE, CANVAS_W, CANVAS_H } from './utils.js';

export class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
    this.frame = 0;
    this.stars = this._generateStars(120);
  }

  _generateStars(count) {
    const stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * CANVAS_W,
        y: Math.random() * CANVAS_H,
        size: Math.random() * 1.5 + 0.5,
        brightness: Math.random(),
        speed: Math.random() * 0.3 + 0.1,
      });
    }
    return stars;
  }

  clear() {
    const ctx = this.ctx;
    this.frame++;

    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, '#050510');
    grad.addColorStop(0.5, '#0a0a20');
    grad.addColorStop(1, '#080818');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    this._drawStarfield();
    this._drawGrid();
  }

  _drawStarfield() {
    const ctx = this.ctx;
    for (const star of this.stars) {
      star.brightness += (Math.random() - 0.5) * 0.05;
      star.brightness = Math.max(0.2, Math.min(1, star.brightness));
      ctx.globalAlpha = star.brightness * 0.7;
      ctx.fillStyle = star.brightness > 0.7 ? '#aaddff' : '#ffffff';
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _drawGrid() {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 1;
    const spacing = 40;
    const offset = (this.frame * 0.5) % spacing;
    for (let x = -offset; x < CANVAS_W; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_H);
      ctx.stroke();
    }
    for (let y = -offset; y < CANVAS_H; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_W, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawTrack(track) {
    const ctx = this.ctx;

    ctx.fillStyle = SURFACE.GRASS.color;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    for (const surf of track.surfaces) {
      const s = SURFACE[surf.type];
      ctx.fillStyle = s.color;
      ctx.fillRect(surf.x, surf.y, surf.w, surf.h);

      ctx.strokeStyle = s.glow;
      ctx.globalAlpha = 0.15;
      ctx.lineWidth = 1;
      ctx.strokeRect(surf.x, surf.y, surf.w, surf.h);
      ctx.globalAlpha = 1;

      if (surf.type === 'MUD' || surf.type === 'WATER') {
        this._drawHazardField(surf, s);
      }

      if (surf.type === 'ASPHALT') {
        this._drawBoostLanes(surf, s);
      }

      if (surf.type === 'DIRT') {
        this._drawTrackLanes(surf, s);
      }
    }

    for (const wall of track.walls) {
      this._drawEnergyBarrier(wall);
    }

    for (const dec of track.decorations || []) {
      this._drawDecoration(dec);
    }

    this._drawCheckpoints(track);
    this._drawStartLine(track);
  }

  _drawHazardField(surf, s) {
    const ctx = this.ctx;
    const pulse = Math.sin(this.frame * 0.08) * 0.5 + 0.5;
    ctx.save();
    ctx.globalAlpha = 0.2 + pulse * 0.15;
    for (let i = 0; i < 12; i++) {
      const bx = surf.x + (i * 47 % surf.w);
      const by = surf.y + (i * 63 % surf.h);
      const r = 4 + Math.sin(this.frame * 0.1 + i) * 2;
      ctx.fillStyle = s.glow;
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _drawBoostLanes(surf, s) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = s.glow;
    ctx.globalAlpha = 0.4 + Math.sin(this.frame * 0.12) * 0.2;
    ctx.lineWidth = 2;
    ctx.setLineDash([16, 12]);
    const offset = (this.frame * 2) % 28;
    ctx.lineDashOffset = -offset;
    ctx.beginPath();
    ctx.moveTo(surf.x, surf.y + surf.h / 2);
    ctx.lineTo(surf.x + surf.w, surf.y + surf.h / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  _drawTrackLanes(surf, s) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = s.glow;
    ctx.globalAlpha = 0.08;
    ctx.lineWidth = 1;
    const cx = surf.x + surf.w / 2;
    const cy = surf.y + surf.h / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, surf.w / 2 - 10, surf.h / 2 - 10, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  _drawEnergyBarrier(wall) {
    const ctx = this.ctx;
    const pulse = Math.sin(this.frame * 0.15 + wall.x * 0.01) * 0.3 + 0.7;

    ctx.save();
    ctx.fillStyle = `rgba(20, 0, 60, 0.8)`;
    ctx.fillRect(wall.x, wall.y, wall.w, wall.h);

    ctx.strokeStyle = '#ff00ff';
    ctx.globalAlpha = 0.6 * pulse;
    ctx.lineWidth = 2;
    ctx.shadowColor = '#ff00ff';
    ctx.shadowBlur = 8;
    ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);

    ctx.globalAlpha = 0.3 * pulse;
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(wall.x + 2, wall.y + 2, wall.w - 4, wall.h - 4);
    ctx.restore();
  }

  _drawCheckpoints(track) {
    const ctx = this.ctx;
    track.checkpoints.forEach((cp, i) => {
      const pulse = Math.sin(this.frame * 0.1 + i * 1.5) * 0.3 + 0.7;
      const color = i === 0 ? '#00ff88' : '#00ffff';

      ctx.save();
      ctx.globalAlpha = 0.15 * pulse;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, cp.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.5 * pulse;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 10]);
      ctx.lineDashOffset = -(this.frame * 1.5) % 16;
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, cp.radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = 0.8;
      ctx.fillStyle = color;
      ctx.font = '10px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`CP${i + 1}`, cp.x, cp.y + 3);
      ctx.restore();
    });
  }

  _drawStartLine(track) {
    const start = track.starts[0];
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(start.x, start.y);
    ctx.rotate(start.angle + Math.PI / 2);

    for (let i = 0; i < 8; i++) {
      const hue = i % 2 === 0 ? '#00ffff' : '#ff00ff';
      ctx.fillStyle = hue;
      ctx.globalAlpha = 0.6 + Math.sin(this.frame * 0.1 + i) * 0.2;
      ctx.shadowColor = hue;
      ctx.shadowBlur = 6;
      ctx.fillRect(-60, -4 + i * 8, 120, 8);
    }
    ctx.restore();
  }

  _drawDecoration(dec) {
    const ctx = this.ctx;
    const pulse = Math.sin(this.frame * 0.08 + dec.x) * 0.3 + 0.7;
    ctx.save();
    ctx.translate(dec.x, dec.y);

    if (dec.type === 'beacon') {
      ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.arc(0, 0, 12 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#00ffff';
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#00ffff';
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.lineTo(0, 20);
      ctx.moveTo(-20, 0);
      ctx.lineTo(20, 0);
      ctx.stroke();
    } else if (dec.type === 'hologram') {
      ctx.globalAlpha = 0.5 + pulse * 0.3;
      ctx.strokeStyle = '#ff00ff';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#ff00ff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(-15, 10);
      ctx.lineTo(0, -20);
      ctx.lineTo(15, 10);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 0, 255, 0.15)';
      ctx.fill();
    } else if (dec.type === 'energy_node') {
      const rings = 3;
      for (let r = 0; r < rings; r++) {
        ctx.globalAlpha = (0.4 - r * 0.1) * pulse;
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2 - r * 0.5;
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, 0, 10 + r * 8 + Math.sin(this.frame * 0.05) * 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  drawCar(car, camera) {
    const ctx = this.ctx;
    const sx = car.x - camera.x;
    const sy = car.y - camera.y;

    if (sx < -60 || sx > CANVAS_W + 60 || sy < -60 || sy > CANVAS_H + 60) return;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(car.angle);

    const glow = car.color.glow || car.color.body;

    if (car.nitroActive) {
      this._drawNitroFlame(ctx, glow);
    }

    ctx.shadowColor = glow;
    ctx.shadowBlur = car.nitroActive ? 25 : 12;

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-8, -10);
    ctx.lineTo(-12, 0);
    ctx.lineTo(-8, 10);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = car.color.body;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-6, -8);
    ctx.lineTo(-10, 0);
    ctx.lineTo(-6, 8);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = car.color.trim;
    ctx.globalAlpha = 0.7;
    ctx.fillRect(-4, -5, 8, 10);
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(6, 0, 2, 0, Math.PI * 2);
    ctx.fill();

    if (car.isPlayer) {
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.6 + Math.sin(this.frame * 0.15) * 0.3;
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-8, -10);
      ctx.lineTo(-12, 0);
      ctx.lineTo(-8, 10);
      ctx.closePath();
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  _drawNitroFlame(ctx, glow) {
    const flicker = Math.random() * 4;
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = 0.5 - i * 0.12;
      ctx.fillStyle = i === 0 ? '#ff00ff' : i === 1 ? glow : '#00ffff';
      const len = 10 + flicker + i * 4;
      const spread = 4 + i * 2;
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.lineTo(-10 - len, -spread);
      ctx.lineTo(-10 - len - 4, 0);
      ctx.lineTo(-10 - len, spread);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawParticles(particles, camera) {
    const ctx = this.ctx;
    ctx.save();
    for (const p of particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(p.x - camera.x, p.y - camera.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawGlowTrails(trails) {
    const ctx = this.ctx;
    ctx.save();
    for (const t of trails) {
      ctx.globalAlpha = t.alpha;
      ctx.fillStyle = t.color;
      ctx.shadowColor = t.color;
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawMinimap(track, cars, x, y, w, h) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = 'rgba(5, 10, 30, 0.85)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 4;
    ctx.strokeRect(x, y, w, h);

    const scaleX = w / CANVAS_W;
    const scaleY = h / CANVAS_H;

    for (const surf of track.surfaces) {
      const s = SURFACE[surf.type];
      ctx.fillStyle = s.color;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(
        x + surf.x * scaleX,
        y + surf.y * scaleY,
        surf.w * scaleX,
        surf.h * scaleY
      );
    }

    for (const car of cars) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = car.isPlayer ? '#00ffff' : car.color.glow || car.color.body;
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = car.isPlayer ? 6 : 3;
      ctx.beginPath();
      ctx.arc(
        x + car.x * scaleX,
        y + car.y * scaleY,
        car.isPlayer ? 4 : 3,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    ctx.font = '8px Orbitron, sans-serif';
    ctx.fillStyle = 'rgba(0, 255, 255, 0.6)';
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.fillText('RADAR', x + 4, y + h - 4);

    ctx.restore();
  }
}
