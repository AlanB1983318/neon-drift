import { SURFACE, CANVAS_W, CANVAS_H } from './utils.js?v=6';
import { drawArcadeTruck } from './sprites.js?v=6';

export class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
    this.frame = 0;
  }

  clear() {
    const ctx = this.ctx;
    this.frame++;
    ctx.fillStyle = '#4a9a40';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = 'rgba(45, 90, 38, 0.3)';
    for (let y = 0; y < CANVAS_H; y += 32) {
      for (let x = (y / 32 % 2) * 16; x < CANVAS_W; x += 32) {
        ctx.fillRect(x, y, 16, 16);
      }
    }
  }

  drawTrack(track) {
    const ctx = this.ctx;
    ctx.fillStyle = SURFACE.GRASS.color;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    for (const surf of track.surfaces) {
      this._drawSurface(surf);
    }

    for (const surf of track.surfaces) {
      if (surf.type === 'DIRT') {
        if (surf.shape === 'ellipse') this._drawEllipseRumble(surf);
        else this._drawTrackBerms(surf);
      }
      if (surf.type === 'ASPHALT') this._drawBridge(surf);
    }

    for (const wall of track.walls) this._drawBarrier(wall);
    for (const dec of track.decorations || []) this._drawDecoration(dec);
    this._drawCheckpoints(track);
    this._drawStartLine(track);
  }

  _drawSurface(surf) {
    const ctx = this.ctx;
    const s = SURFACE[surf.type];

    if (surf.shape === 'ellipse') {
      const grad = ctx.createRadialGradient(surf.cx, surf.cy, 0, surf.cx, surf.cy, Math.max(surf.rx, surf.ry));
      grad.addColorStop(0, s.color);
      grad.addColorStop(1, s.detail);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(surf.cx, surf.cy, surf.rx, surf.ry, 0, 0, Math.PI * 2);
      ctx.fill();
      if (surf.type === 'DIRT') this._drawDirtLanesEllipse(surf);
      else if (surf.type === 'MUD') this._drawMudEllipse(surf, s);
      return;
    }

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

  _drawDirtLanesEllipse(surf) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(140, 100, 50, 0.4)';
    ctx.lineWidth = 3;
    ctx.setLineDash([24, 18]);
    ctx.beginPath();
    ctx.ellipse(surf.cx, surf.cy, surf.rx - 30, surf.ry - 30, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  _drawMudEllipse(surf, s) {
    const ctx = this.ctx;
    ctx.save();
    for (let i = 0; i < 8; i++) {
      const a = i * 0.9;
      const x = surf.cx + Math.cos(a) * surf.rx * 0.4;
      const y = surf.cy + Math.sin(a) * surf.ry * 0.4;
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = s.detail;
      ctx.beginPath();
      ctx.ellipse(x, y, 10, 7, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _drawEllipseRumble(surf) {
    const ctx = this.ctx;
    const steps = 48;
    const block = Math.PI * 2 / steps;
    ctx.save();
    ctx.lineWidth = 14;
    for (let i = 0; i < steps; i++) {
      ctx.strokeStyle = i % 2 === 0 ? '#dd2222' : '#eeeeee';
      ctx.beginPath();
      ctx.ellipse(surf.cx, surf.cy, surf.rx, surf.ry, 0, i * block, (i + 1) * block);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawDirtLanes(surf) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(140, 100, 50, 0.4)';
    ctx.lineWidth = 3;
    ctx.setLineDash([24, 18]);
    ctx.beginPath();
    ctx.ellipse(surf.x + surf.w / 2, surf.y + surf.h / 2, surf.w / 2 - 30, surf.h / 2 - 30, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  _drawTrackBerms(surf) {
    const ctx = this.ctx;
    const berm = 12;
    ctx.save();
    ctx.strokeStyle = '#7a5a28';
    ctx.lineWidth = berm;
    ctx.globalAlpha = 0.55;
    ctx.strokeRect(surf.x + berm / 2, surf.y + berm / 2, surf.w - berm, surf.h - berm);
    ctx.restore();
    this._drawRumbleStrip(surf.x, surf.y, surf.w, surf.h, berm);
  }

  _drawRumbleStrip(x, y, w, h, size) {
    const ctx = this.ctx;
    const block = 14;
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
  }

  _drawBridge(surf) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = '#666';
    ctx.fillRect(surf.x, surf.y, surf.w, surf.h);
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const px = surf.x + 8 + i * (surf.w / 6);
      ctx.beginPath();
      ctx.moveTo(px, surf.y);
      ctx.lineTo(px, surf.y + surf.h);
      ctx.stroke();
    }
    ctx.strokeStyle = '#aa6622';
    ctx.lineWidth = 5;
    ctx.strokeRect(surf.x, surf.y, surf.w, surf.h);
    ctx.restore();
  }

  _drawGrassTexture(surf) {
    const ctx = this.ctx;
    ctx.save();
    for (let i = 0; i < 40; i++) {
      const x = surf.x + (i * 43 % surf.w);
      const y = surf.y + (i * 29 % surf.h);
      ctx.strokeStyle = i % 2 === 0 ? '#2d5528' : '#4a8040';
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y + 6);
      ctx.lineTo(x + (i % 3 - 1) * 2, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawMudTexture(surf, s) {
    const ctx = this.ctx;
    ctx.save();
    for (let i = 0; i < 16; i++) {
      const x = surf.x + (i * 41 % surf.w);
      const y = surf.y + (i * 57 % surf.h);
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = s.detail;
      ctx.beginPath();
      ctx.ellipse(x, y, 8 + (i % 3), 6, i * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _drawWaterTexture(surf, s) {
    const ctx = this.ctx;
    const wave = Math.sin(this.frame * 0.05) * 2;
    ctx.save();
    ctx.strokeStyle = s.detail;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 2;
    for (let row = 0; row < 6; row++) {
      const y = surf.y + 10 + row * 12 + wave;
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
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 4;
    ctx.setLineDash([14, 10]);
    ctx.lineDashOffset = -(this.frame * 2) % 24;
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
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(wall.x - 2, wall.y - 2, wall.w + 4, wall.h + 4);
    const block = 12;
    const count = Math.floor((isHoriz ? wall.w : wall.h) / block);
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#cc2222' : '#eeeeee';
      if (isHoriz) ctx.fillRect(wall.x + i * block, wall.y, block, wall.h);
      else ctx.fillRect(wall.x, wall.y + i * block, wall.w, block);
    }
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);
    ctx.restore();
  }

  _drawCheckpoints(track) {
    const ctx = this.ctx;
    track.checkpoints.forEach((cp, i) => {
      ctx.save();
      const pulse = Math.sin(this.frame * 0.08 + i) * 0.15 + 0.85;
      ctx.globalAlpha = 0.15 * pulse;
      ctx.fillStyle = i === 0 ? '#ffff00' : '#ffffff';
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, cp.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.7 * pulse;
      ctx.strokeStyle = i === 0 ? '#ffcc00' : 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 10]);
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
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#111111';
      ctx.fillRect(-90, -5 + i * 10, 180, 10);
    }
    ctx.restore();
  }

  _drawDecoration(dec) {
    const ctx = this.ctx;
    const scale = dec.scale || 1;
    ctx.save();
    ctx.translate(dec.x, dec.y);
    ctx.scale(scale, scale);

    if (dec.type === 'tire') {
      for (let t = 0; t < 3; t++) {
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(-14 + t * 14, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(-14 + t * 14, 0, 5, 0, Math.PI * 2);
        ctx.strokeStyle = '#333';
        ctx.stroke();
      }
    } else if (dec.type === 'cone') {
      ctx.fillStyle = '#ff5500';
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(-10, 14);
      ctx.lineTo(10, 14);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      for (let s = 0; s < 3; s++) {
        ctx.beginPath();
        ctx.moveTo(-7 + s * 2, -2 + s * 6);
        ctx.lineTo(7 - s * 2, -2 + s * 6);
        ctx.stroke();
      }
    } else if (dec.type === 'flag') {
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -26);
      ctx.lineTo(0, 18);
      ctx.stroke();
      ctx.fillStyle = '#ee2222';
      ctx.fillRect(0, -26, 24, 13);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, -13, 24, 13);
      ctx.fillStyle = '#2244cc';
      ctx.fillRect(0, 0, 24, 13);
    } else if (dec.type === 'tree') {
      ctx.fillStyle = '#5c3a1a';
      ctx.fillRect(-4, 0, 8, 18);
      ctx.fillStyle = '#2a6a2a';
      ctx.beginPath();
      ctx.arc(0, -8, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3a8a3a';
      ctx.beginPath();
      ctx.arc(-5, -12, 10, 0, Math.PI * 2);
      ctx.arc(6, -10, 9, 0, Math.PI * 2);
      ctx.fill();
    } else if (dec.type === 'rock') {
      ctx.fillStyle = '#666';
      ctx.beginPath();
      ctx.ellipse(0, 3, 16, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#999';
      ctx.beginPath();
      ctx.ellipse(-4, -2, 7, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (dec.type === 'grandstand') {
      ctx.fillStyle = '#777';
      ctx.fillRect(-36, -10, 72, 24);
      for (let r = 0; r < 5; r++) {
        ctx.fillStyle = r % 2 === 0 ? '#999' : '#666';
        ctx.fillRect(-34, -8 + r * 5, 68, 4);
      }
      for (let p = 0; p < 10; p++) {
        ctx.fillStyle = `hsl(${p * 36}, 75%, 55%)`;
        ctx.fillRect(-32 + p * 7, -12, 5, 5);
      }
    }

    ctx.restore();
  }

  drawCar(car, camera) {
    const sx = car.x - camera.x;
    const sy = car.y - camera.y;
    if (sx < -100 || sx > CANVAS_W + 100 || sy < -100 || sy > CANVAS_H + 100) return;

    this.ctx.save();
    this.ctx.translate(sx, sy);
    drawArcadeTruck(this.ctx, car, this.frame);
    this.ctx.restore();
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
    ctx.fillStyle = 'rgba(20, 40, 15, 0.92)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#ff8800';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    const scaleX = w / CANVAS_W;
    const scaleY = h / CANVAS_H;

    for (const surf of track.surfaces) {
      ctx.fillStyle = SURFACE[surf.type].color;
      ctx.globalAlpha = 0.85;
      if (surf.shape === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(x + surf.cx * scaleX, y + surf.cy * scaleY, surf.rx * scaleX, surf.ry * scaleY, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(x + surf.x * scaleX, y + surf.y * scaleY, surf.w * scaleX, surf.h * scaleY);
      }
    }

    for (const car of cars) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = car.isPlayer ? '#ffff00' : car.color.body;
      ctx.beginPath();
      ctx.arc(x + car.x * scaleX, y + car.y * scaleY, car.isPlayer ? 4 : 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.font = 'bold 9px sans-serif';
    ctx.fillStyle = '#ffcc00';
    ctx.fillText('MAP', x + 4, y + h - 4);
    ctx.restore();
  }
}
