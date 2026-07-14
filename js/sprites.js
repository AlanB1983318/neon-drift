export function drawArcadeTruck(ctx, car, frame) {
  const bob = Math.sin(frame * 0.4 + car.x * 0.07) * Math.min(Math.abs(car.speed) * 0.25, 2.5);

  ctx.save();
  ctx.translate(0, bob);
  ctx.scale(1, 0.72);
  ctx.rotate(car.angle);

  if (car.nitroActive) drawNitroBurst(ctx, frame);

  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(2, 4, 24, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  drawTire(ctx, -16, -20, 10, frame, car.speed);
  drawTire(ctx, -16, 20, 10, frame, car.speed);

  ctx.fillStyle = car.color.dark;
  ctx.fillRect(-18, -14, 34, 28);

  ctx.fillStyle = car.color.body;
  ctx.fillRect(-16, -12, 30, 24);

  ctx.fillStyle = car.color.trim;
  ctx.fillRect(2, -11, 12, 22);

  ctx.fillStyle = car.color.dark;
  ctx.fillRect(-16, -12, 10, 24);

  ctx.fillStyle = '#b8dff8';
  ctx.fillRect(6, -8, 8, 16);

  ctx.fillStyle = '#ffee88';
  ctx.fillRect(12, -6, 4, 4);
  ctx.fillRect(12, 2, 4, 4);

  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-4, -10);
  ctx.lineTo(-4, 10);
  ctx.moveTo(-12, -9);
  ctx.lineTo(-12, 9);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(car.number), -6, 0);

  ctx.fillStyle = car.color.accent || '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(0, 0, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#444';
  ctx.fillRect(-19, -3, 3, 6);
  ctx.fillRect(-19, -3, 3, 6);

  drawTire(ctx, 14, -14, 7, frame, car.speed);
  drawTire(ctx, 14, 14, 7, frame, car.speed);

  if (car.isPlayer) {
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.75 + Math.sin(frame * 0.18) * 0.25;
    ctx.strokeRect(-17, -13, 32, 26);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

function drawTire(ctx, x, y, r, frame, speed) {
  const spin = frame * Math.abs(speed) * 0.55;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);

  ctx.fillStyle = '#0a0a0a';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#3a3a3a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r - 2, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#2a2a2a';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI * 2) / 6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * (r - 1), Math.sin(a) * (r - 1));
    ctx.stroke();
  }
  ctx.restore();
}

function drawNitroBurst(ctx, frame) {
  const flicker = Math.random() * 6;
  for (let i = 0; i < 5; i++) {
    ctx.globalAlpha = 0.9 - i * 0.14;
    ctx.fillStyle = i < 2 ? '#ff4400' : '#ffaa00';
    const len = 16 + flicker + i * 5;
    const spread = 6 + i * 2;
    ctx.beginPath();
    ctx.moveTo(-20, -5);
    ctx.lineTo(-20 - len, -spread);
    ctx.lineTo(-20 - len - 6, 0);
    ctx.lineTo(-20 - len, spread);
    ctx.lineTo(-20, 5);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
