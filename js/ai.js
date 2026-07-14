import { angleDiff, dist } from './utils.js?v=27';
import { getSurfaceAt } from './tracks.js?v=27';

export class AIController {
  constructor(car, waypoints, skill = 1) {
    this.car = car;
    this.waypoints = waypoints;
    this.wpIndex = 0;
    this.skill = skill;
    this.reactionDelay = 0;
  }

  reset() {
    this.wpIndex = 0;
    this.reactionDelay = 0;
  }

  update(track) {
    const car = this.car;
    if (car.finished) return;

    const wps = this.waypoints;
    let target = wps[this.wpIndex];
    let d = dist(car.x, car.y, target.x, target.y);

    if (d < 40) {
      this.wpIndex = (this.wpIndex + 1) % wps.length;
      target = wps[this.wpIndex];
      d = dist(car.x, car.y, target.x, target.y);
    }

    const targetAngle = Math.atan2(target.y - car.y, target.x - car.x);
    const diff = angleDiff(car.angle, targetAngle);

    const steer = Math.max(-1, Math.min(1, diff * 2.5 * this.skill));
    const surface = getSurfaceAt(track, car.x, car.y);
    const isSlow = surface === 'mud' || surface === 'water' || surface === 'grass';

    let throttle = 1.0 * this.skill;
    if (Math.abs(diff) > 1.2) throttle = 0.3;
    else if (Math.abs(diff) > 0.6) throttle = 0.6;
    if (isSlow) throttle *= 0.85;

    const variance = (Math.random() - 0.5) * 0.08 * (2 - this.skill);
    throttle = Math.max(0.2, Math.min(1, throttle + variance));

    car.applyAI(steer, throttle, surface, 1, true);
  }
}
