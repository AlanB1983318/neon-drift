import { SURFACE, CANVAS_W, CANVAS_H } from './utils.js?v=4';

export class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
    this.frame = 0;
  }

  clear() {
    const ctx = this.ctx;
    this.frame++;

    const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_H * 0.4);
    sky.addColorStop(0, '#5a9fd4');
    sky.addColorStop(1, '#8ec4e8');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H * 0.35);

    const horizon = ctx.createLinearGradient(0, CANVAS_H * 0.3, 0, CANVAS_H);
    horizon.addColorStop(0, '#5a9a48');
    horizon.addColorStop(0.15, '#4a8a3a');
    horizon.addColorStop(1, '#3a7030');
    ctx.fillStyle = horizon;
    ctx.fillRect(0, CANVAS_H * 0.3, CANVAS_W, CANVAS_H * 0.7);
  }

  drawTrack(track) {
    const ctx = this.ctx;

    ctx.fillStyle = SURFACE.GRASS.color;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    for (const surf of track.surfaces) {
      this._drawSurface(surf);
    }

    for (const surf of track.surfaces) {
      if (surf.type === 'DIRT') this._drawTrackBerms(surf);
      if (surf.type === 'ASPHALT') this._drawBridge(surf);
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

  _drawSurface(surf) {
    const ctx = this.ctx;
    const s = SURFACE[surf.type];
    const cx = surf.x + surf.w / 2;
    const cy = surf.y + surf.h / 2;

    const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, Math.max(surf.w, surf.h) * 0.7);
    grad.addColorStop(0, s.color);
    grad.addColorStop(1, s.detail);
    ctx.fillStyle = grad;
    ctx.fillRect(surf.x, surf.y, surf.w, surf.h);

    if (surf.type === 'DIRT') this._drawDirtLanes(surf);
    else if (surf.type === 'GRASS') this._drawGrassTexture(surf);
    else if (surf.type === 'MUD') this._drawMudTexture(surf, s);
    else if (surf.type === 'WATER') this._drawWaterTexture(surf, s);
    else if (surf.type === 'ASPHALT') this._drawBoostStrip(surf);
  }

  _drawDirtLanes(surf) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(160, 120, 60, 0.35)';
    ctx.lineWidth = 2;
    ctx.setLineDash([20, 16]);
    const cx = surf.x + surf.w / 2;
    const cy = surf.y + surf.h / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, surf.w / 2 - 24, surf.h / 2 - 24, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  _drawTrackBerms(surf) {
    const ctx = this.ctx;
    const berm = 10;
    ctx.save();
    ctx.strokeStyle = '#8a6a30';
    ctx.lineWidth = berm;
    ctx.globalAlpha = 0.5;
    ctx.strokeRect(surf.x + berm / 2, surf.y + berm / 2, surf.w - berm, surf.h - berm);
    ctx.restore();

    this._drawRumbleStrip(surf.x, surf.y, surf.w, surf.h, berm);
  }

  _drawRumbleStrip(x, y, w, h, size) {
    const ctx = this.ctx;
    const block = 12;
    ctx.save();

    const drawEdge = (ex, ey, ew, eh, horizontal) => {
      const count = Math.floor((horizontal ? ew : eh) / block);
      for (let i = 0; i < count; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#dd2222' : '#eeeeee';
        if (horizontal) ctx.fillRect(ex + i * block, ey, block, eh);
        else ctx.fillRect(ex, ey + i * block, ew, block);
      }
    };

    drawEdge(x, y, w, size, true);
    drawEdge(x, y + h - size, w, size, true);
    drawEdge(x, y, size, h, false);
    drawEdge(x + w - size, y, size, h, false);
    ctx.restore();
  }

  _drawBridge(surf) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = '#555';
    ctx.fillRect(surf.x, surf.y, surf.w, surf.h);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 3;
    for (let i = 0; i < 5; i++) {
      const px = surf.x + 10 + i * (surf.w / 5);
      ctx.beginPath();
      ctx.moveTo(px, surf.y);
      ctx.lineTo(px, surf.y + surf.h);
      ctx.stroke();
    }
    ctx.strokeStyle = '#aa6622';
    ctx.lineWidth = 4;
    ctx.strokeRect(surf.x, surf.y, surf.w, surf.h);
    ctx.restore();
  }

  _drawGrassTexture(surf) {
    const ctx = this.ctx;
    ctx.save();
    for (let i = 0; i < 30; i++) {
      const x = surf.x + (i * 47 % surf.w);
      const y = surf.y + (i * 31 % surf.h);
      ctx.strokeStyle = i % 3 === 0 ? '#2a552a' : '#3a6a30';
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y + 5);
      ctx.lineTo(x + (i % 2 ? 2 : -2), y);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawMudTexture(surf, s) {
    const ctx = this.ctx;
    ctx.save();
    for (let i = 0; i < 14; i++) {
      const x = surf.x + (i * 41 % surf.w);
      const y = surf.y + (i * 57 % surf.h);
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = s.detail;
      ctx.beginPath();
      ctx.ellipse(x, y, 7 + (i % 3), 5, i * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _drawWaterTexture(surf, s) {
    const ctx = this.ctx;
    const wave = Math.sin(this.frame * 0.05) * 2;
    ctx.save();
    ctx.strokeStyle = s.detail;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 2;
    for (let row = 0; row < 5; row++) {
      const y = surf.y + 12 + row * 14 + wave;
      ctx.beginPath();
      ctx.moveTo(surf.x + 4, y);
      for (let x = surf.x + 4; x < surf.x + surf.w - 4; x += 10) {
        ctx.quadraticCurveTo(x + 5, y + (row % 2 ? 4 : -4), x + 10, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawBoostStrip(surf) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = '#ffff66';
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 8]);
    ctx.lineDashOffset = -(this.frame * 2) % 20;
    ctx.beginPath();
    ctx.moveTo(surf.x + 6, surf.y + surf.h / 2);
    ctx.lineTo(surf.x + surf.w - 6, surf.y + surf.h / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  _drawBarrier(wall) {
    const ctx = this.ctx;
    const isHoriz = wall.w > wall.h;
    ctx.save();

    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(wall.x, wall.y, wall.w, wall.h);

    const block = 10;
    const count = Math.floor((isHoriz ? wall.w : wall.h) / block);
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#cc2222' : '#eeeeee';
      if (isHoriz) {
        ctx.fillRect(wall.x + i * block, wall.y, block, wall.h);
      } else {
        ctx.fillRect(wall.x, wall.y + i * block, wall.w, block);
      }
    }

    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);
    ctx.restore();
  }

  _drawCheckpoints(track) {
    const ctx = this.ctx;
    track.checkpoints.forEach((cp, i) => {
      ctx.save();
      const pulse = Math.sin(this.frame * 0.08 + i) * 0.15 + 0.85;
      ctx.globalAlpha = 0.2 * pulse;
      ctx.fillStyle = i === 0 ? '#ffff00' : '#ffffff';
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, cp.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.6 * pulse;
      ctx.strokeStyle = i === 0 ? '#ffcc00' : 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 8]);
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

    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#111111';
      ctx.fillRect(-80, -4 + i * 8, 160, 8);
    }
    ctx.restore();
  }

  _drawDecoration(dec) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(dec.x, dec.y);

    if (dec.type === 'tire') {
      for (let t = 0; t < 3; t++) {
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.arc(-12 + t * 12, 0, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(-12 + t * 12, 0, 4, 0, Math.PI * 2);
        ctx.strokeStyle = '#333';
        ctx.stroke();
      }
    } else if (dec.type === 'cone') {
      ctx.fillStyle = '#ff6600';
      ctx.beginPath();
      ctx.moveTo(0, -16);
      ctx.lineTo(-9, 12);
      ctx.lineTo(9, 12);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      for (let s = 0; s < 3; s++) {
        ctx.beginPath();
        ctx.moveTo(-6 + s * 2, -2 + s * 5);
        ctx.lineTo(6 - s * 2, -2 + s * 5);
        ctx.stroke();
      }
    } else if (dec.type === 'flag') {
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -22);
      ctx.lineTo(0, 16);
      ctx.stroke();
      ctx.fillStyle = '#ee2222';
      ctx.fillRect(0, -22, 20, 11);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, -11, 20, 11);
      ctx.fillStyle = '#2244cc';
      ctx.fillRect(0, 0, 20, 11);
    } else if (dec.type === 'tree') {
      ctx.fillStyle = '#5c3a1a';
      ctx.fillRect(-3, 0, 6, 14);
      ctx.fillStyle = '#2a6a2a';
      ctx.beginPath();
      ctx.arc(0, -6, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3a8a3a';
      ctx.beginPath();
      ctx.arc(-4, -10, 8, 0, Math.PI * 2);
      ctx.arc(5, -8, 7, 0, Math.PI * 2);
      ctx.fill();
    } else if (dec.type === 'rock') {
      ctx.fillStyle = '#777';
      ctx.beginPath();
      ctx.ellipse(0, 2, 12, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#999';
      ctx.beginPath();
      ctx.ellipse(-3, -2, 5, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (dec.type === 'grandstand') {
      ctx.fillStyle = '#888';
      ctx.fillRect(-30, -8, 60, 20);
      for (let r = 0; r < 4; r++) {
        ctx.fillStyle = r % 2 === 0 ? '#aaa' : '#777';
        ctx.fillRect(-28, -6 + r * 5, 56, 4);
      }
      for (let p = 0; p < 8; p++) {
        ctx.fillStyle = `hsl(${p * 40}, 70%, 55%)`;
        ctx.fillRect(-26 + p * 7, -10, 4, 4);
      }
    }

    ctx.restore();
  }

  drawCar(car, camera) {
    const ctx = this.ctx;
    const sx = car.x - camera.x;
    const sy = car.y - camera.y;

    if (sx < -80 || sx > CANVAS_W + 80 || sy < -80 || sy > CANVAS_H + 80) return;

    const bob = Math.sin(this.frame * 0.3 + car.x * 0.1) * Math.min(Math.abs(car.speed) * 0.15, 1.5);

    ctx.save();
    ctx.translate(sx, sy + bob);
    ctx.rotate(car.angle);

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 16, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    if (car.nitroActive) {
      this._drawNitroFlame(ctx);
    }

    this._drawWheels(ctx, car);

    ctx.fillStyle = car.color.dark;
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(8, -11);
    ctx.lineTo(-14, -9);
    ctx.lineTo(-16, 0);
    ctx.lineTo(-14, 9);
    ctx.lineTo(8, 11);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = car.color.body;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(7, -9);
    ctx.lineTo(-12, -7);
    ctx.lineTo(-14, 0);
    ctx.lineTo(-12, 7);
    ctx.lineTo(7, 9);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = car.color.trim;
    ctx.fillRect(-10, -7, 14, 14);

    const windshield = ctx.createLinearGradient(4, -5, 4, 5);
    windshield.addColorStop(0, '#aaddff');
    windshield.addColorStop(1, '#66aacc');
    ctx.fillStyle = windshield;
    ctx.fillRect(5, -5, 6, 10);

    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-2, -6);
    ctx.lineTo(-2, 6);
    ctx.moveTo(-8, -5);
    ctx.lineTo(-8, 5);
    ctx.stroke();

    ctx.fillStyle = '#ffffaa';
    ctx.fillRect(11, -4, 3, 3);
    ctx.fillRect(11, 1, 3, 3);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(car.number), -4, 0);

    ctx.fillStyle = '#333';
    ctx.fillRect(-13, -3, 2, 6);

    if (car.isPlayer) {
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.7 + Math.sin(this.frame * 0.12) * 0.2;
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(7, -9);
      ctx.lineTo(-12, -7);
      ctx.lineTo(-14, 0);
      ctx.lineTo(-12, 7);
      ctx.lineTo(7, 9);
      ctx.closePath();
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  _drawWheels(ctx, car) {
    const spin = this.frame * Math.abs(car.speed) * 0.4;
    const tires = [
      [10, -12], [10, 12], [-10, -12], [-10, 12],
    ];

    for (const [wx, wy] of tires) {
      ctx.save();
      ctx.translate(wx, wy);
      ctx.rotate(spin);

      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(i * Math.PI / 2) * 5, Math.sin(i * Math.PI / 2) * 5);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  _drawNitroFlame(ctx) {
    const flicker = Math.random() * 4;
    for (let i = 0; i < 4; i++) {
      ctx.globalAlpha = 0.8 - i * 0.15;
      ctx.fillStyle = i < 2 ? '#ff6600' : '#ffcc00';
      const len = 10 + flicker + i * 4;
      const spread = 4 + i * 2;
      ctx.beginPath();
      ctx.moveTo(-16, -3);
      ctx.lineTo(-16 - len, -spread);
      ctx.lineTo(-16 - len - 4, 0);
      ctx.lineTo(-16 - len, spread);
      ctx.lineTo(-16, 3);
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
    ctx.fillStyle = 'rgba(30, 50, 20, 0.9)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#ff8800';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    const scaleX = w / CANVAS_W;
    const scaleY = h / CANVAS_H;

    for (const surf of track.surfaces) {
      ctx.fillStyle = SURFACE[surf.type].color;
      ctx.globalAlpha = 0.85;
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
      ctx.fillRect(-2.5, -5, 5, 10);
      ctx.restore();
    }

    ctx.font = 'bold 9px sans-serif';
    ctx.fillStyle = '#ffcc00';
    ctx.globalAlpha = 1;
    ctx.fillText('MAP', x + 4, y + h - 4);
    ctx.restore();
  }
}
