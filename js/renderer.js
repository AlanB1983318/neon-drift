import { SURFACE, CANVAS_W, CANVAS_H } from './utils.js?v=3';

export class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
    this.frame = 0;
  }

  clear() {
    const ctx = this.ctx;
    this.frame++;

    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, '#6eb5e0');
    grad.addColorStop(0.35, '#8ec8e8');
    grad.addColorStop(1, '#4a8a3a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  drawTrack(track) {
    const ctx = this.ctx;

    ctx.fillStyle = SURFACE.GRASS.color;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    for (const surf of track.surfaces) {
      const s = SURFACE[surf.type];
      ctx.fillStyle = s.color;
      ctx.fillRect(surf.x, surf.y, surf.w, surf.h);

      if (surf.type === 'DIRT') {
        this._drawDirtTexture(surf, s);
      } else if (surf.type === 'GRASS') {
        this._drawGrassTexture(surf);
      } else if (surf.type === 'MUD') {
        this._drawMudTexture(surf, s);
      } else if (surf.type === 'WATER') {
        this._drawWaterTexture(surf, s);
      } else if (surf.type === 'ASPHALT') {
        this._drawBoostStrip(surf, s);
      }
    }

    for (const wall of track.walls) {
      this._drawBarrier(wall);
    }

    for (const dec of track.decorations || []) {
      this._drawDecoration(dec);
    }

    this._drawCheckpoints(track);
    this._drawStartLine(track);
  }

  _drawDirtTexture(surf, s) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = s.detail;
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 1;
    for (let i = 0; i < 18; i++) {
      const x = surf.x + (i * 53 % surf.w);
      const y = surf.y + (i * 37 % surf.h);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 8, y + 3);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawGrassTexture(surf) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = '#2a552a';
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = 1;
    for (let i = 0; i < 24; i++) {
      const x = surf.x + (i * 41 % surf.w);
      const y = surf.y + (i * 29 % surf.h);
      ctx.beginPath();
      ctx.moveTo(x, y + 4);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawMudTexture(surf, s) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 10; i++) {
      const x = surf.x + (i * 47 % surf.w);
      const y = surf.y + (i * 63 % surf.h);
      ctx.fillStyle = s.detail;
      ctx.beginPath();
      ctx.ellipse(x, y, 6 + (i % 3) * 2, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _drawWaterTexture(surf, s) {
    const ctx = this.ctx;
    const wave = Math.sin(this.frame * 0.06) * 2;
    ctx.save();
    ctx.strokeStyle = s.detail;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 2;
    for (let row = 0; row < 4; row++) {
      const y = surf.y + 15 + row * 18 + wave;
      ctx.beginPath();
      ctx.moveTo(surf.x + 5, y);
      for (let x = surf.x + 5; x < surf.x + surf.w - 5; x += 12) {
        ctx.lineTo(x + 6, y + (row % 2 === 0 ? 3 : -3));
        ctx.lineTo(x + 12, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawBoostStrip(surf, s) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = '#ffff88';
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 2;
    ctx.setLineDash([14, 10]);
    ctx.lineDashOffset = -(this.frame * 1.5) % 24;
    ctx.beginPath();
    ctx.moveTo(surf.x, surf.y + surf.h / 2);
    ctx.lineTo(surf.x + surf.w, surf.y + surf.h / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  _drawBarrier(wall) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
    ctx.strokeStyle = '#5c3a1a';
    ctx.lineWidth = 2;
    ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);

    ctx.strokeStyle = '#a07040';
    ctx.lineWidth = 1;
    const isHoriz = wall.w > wall.h;
    if (isHoriz) {
      for (let x = wall.x + 8; x < wall.x + wall.w; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, wall.y + 2);
        ctx.lineTo(x, wall.y + wall.h - 2);
        ctx.stroke();
      }
    } else {
      for (let y = wall.y + 8; y < wall.y + wall.h; y += 16) {
        ctx.beginPath();
        ctx.moveTo(wall.x + 2, y);
        ctx.lineTo(wall.x + wall.w - 2, y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  _drawCheckpoints(track) {
    const ctx = this.ctx;
    track.checkpoints.forEach((cp, i) => {
      ctx.save();
      ctx.strokeStyle = i === 0 ? '#ffff00' : 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, cp.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
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
      ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#222222';
      ctx.fillRect(-70, -4 + i * 8, 140, 8);
    }
    ctx.restore();
  }

  _drawDecoration(dec) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(dec.x, dec.y);

    if (dec.type === 'tire') {
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = '#333';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.stroke();
    } else if (dec.type === 'cone') {
      ctx.fillStyle = '#ff6600';
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(-8, 10);
      ctx.lineTo(8, 10);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-5, 2);
      ctx.lineTo(5, 2);
      ctx.stroke();
    } else if (dec.type === 'flag') {
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(0, 14);
      ctx.stroke();
      ctx.fillStyle = '#ff2222';
      ctx.fillRect(0, -18, 16, 10);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, -8, 16, 10);
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

    if (car.nitroActive) {
      this._drawNitroFlame(ctx, car.color);
    }

    const w = 11;
    const h = 18;
    const wheelR = 3.5;
    const wheelOffsets = [
      [w - 2, -h + 5],
      [w - 2, h - 5],
      [-w + 2, -h + 5],
      [-w + 2, h - 5],
    ];

    for (const [wx, wy] of wheelOffsets) {
      ctx.fillStyle = car.color.wheel;
      ctx.beginPath();
      ctx.arc(wx, wy, wheelR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(-w + 1, -h + 1, w * 2 - 2, h * 2 - 2);

    ctx.fillStyle = car.color.body;
    ctx.fillRect(-w, -h, w * 2, h * 2);

    ctx.fillStyle = car.color.trim;
    ctx.fillRect(-w + 2, -h + 2, w * 2 - 4, 8);

    ctx.fillStyle = car.color.dark;
    ctx.fillRect(-w + 2, h - 10, w * 2 - 4, 8);

    ctx.fillStyle = '#88ccff';
    ctx.globalAlpha = 0.7;
    ctx.fillRect(w - 4, -5, 3, 10);
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.15;
    ctx.fillRect(-w + 3, -h + 10, w - 2, h * 2 - 20);
    ctx.globalAlpha = 1;

    if (car.isPlayer) {
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 2;
      ctx.strokeRect(-w - 1, -h - 1, w * 2 + 2, h * 2 + 2);
    }

    ctx.restore();
  }

  _drawNitroFlame(ctx, color) {
    const flicker = Math.random() * 3;
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = 0.7 - i * 0.15;
      ctx.fillStyle = i === 0 ? '#ffaa00' : i === 1 ? '#ff4400' : '#ffcc00';
      const len = 8 + flicker + i * 3;
      const spread = 3 + i * 2;
      ctx.beginPath();
      ctx.moveTo(-18, 0);
      ctx.lineTo(-18 - len, -spread);
      ctx.lineTo(-18 - len - 3, 0);
      ctx.lineTo(-18 - len, spread);
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
      ctx.beginPath();
      ctx.arc(p.x - camera.x, p.y - camera.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawSkidMarks(trails) {
    const ctx = this.ctx;
    ctx.save();
    for (const t of trails) {
      ctx.globalAlpha = t.alpha;
      ctx.fillStyle = t.color;
      ctx.beginPath();
      ctx.ellipse(t.x, t.y, t.w, t.h, t.angle, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawMinimap(track, cars, x, y, w, h) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(30, 50, 20, 0.85)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#ff8800';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    const scaleX = w / CANVAS_W;
    const scaleY = h / CANVAS_H;

    for (const surf of track.surfaces) {
      const s = SURFACE[surf.type];
      ctx.fillStyle = s.color;
      ctx.globalAlpha = 0.8;
      ctx.fillRect(
        x + surf.x * scaleX,
        y + surf.y * scaleY,
        surf.w * scaleX,
        surf.h * scaleY
      );
    }

    for (const car of cars) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = car.isPlayer ? '#ffff00' : car.color.body;
      ctx.save();
      ctx.translate(x + car.x * scaleX, y + car.y * scaleY);
      ctx.rotate(car.angle);
      ctx.fillRect(-2, -4, 4, 8);
      ctx.restore();
    }

    ctx.font = 'bold 9px sans-serif';
    ctx.fillStyle = '#ffcc00';
    ctx.globalAlpha = 1;
    ctx.fillText('MAP', x + 4, y + h - 4);

    ctx.restore();
  }
}
