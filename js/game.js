import { Car } from './car.js?v=3';
import { AIController } from './ai.js?v=3';
import { Renderer } from './renderer.js?v=3';
import { AudioEngine } from './audio.js?v=3';
import { TRACKS, getSurfaceAt } from './tracks.js?v=3';
import { getStats, awardRaceCredits, unlockNextTrack, writeSave } from './save.js?v=3';
import { TRUCK_COLORS, LAPS_PER_RACE, CANVAS_W, CANVAS_H } from './utils.js?v=3';

export const GameState = {
  MENU: 'menu',
  RACE: 'race',
  RESULTS: 'results',
  UPGRADES: 'upgrades',
  CHAMPIONSHIP: 'championship',
};

export class Game {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.renderer = new Renderer(this.ctx);
    this.audio = new AudioEngine();
    this.ui = ui;

    this.state = GameState.MENU;
    this.save = null;
    this.trackIndex = 0;
    this.track = null;

    this.cars = [];
    this.aiControllers = [];
    this.camera = { x: 0, y: 0 };
    this.input = { up: false, down: false, left: false, right: false, nitro: false };
    this.keys = {};

    this.countdown = 0;
    this.lastCountdownNum = -1;
    this.raceStarted = false;
    this.raceFinished = false;
    this.results = [];
    this.skidTrails = [];
    this.particles = [];

    this._bindInput();
    this._setupCanvasScale();
    this.lastTime = 0;
    requestAnimationFrame((t) => this.loop(t));
  }

  _setupCanvasScale() {
    const resize = () => {
      const maxW = window.innerWidth - 40;
      const maxH = window.innerHeight - 40;
      const scale = Math.min(maxW / CANVAS_W, maxH / CANVAS_H, 1);
      this.canvas.style.width = `${CANVAS_W * scale}px`;
      this.canvas.style.height = `${CANVAS_H * scale}px`;
    };
    window.addEventListener('resize', resize);
    resize();
  }

  setSave(save) {
    this.save = save;
  }

  _bindInput() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      if (this.state === GameState.RACE && !this.audio.ctx) {
        this.audio.init();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });
  }

  _readInput() {
    this.input.up = this.keys['ArrowUp'] || this.keys['KeyW'];
    this.input.down = this.keys['ArrowDown'] || this.keys['KeyS'];
    this.input.left = this.keys['ArrowLeft'] || this.keys['KeyA'];
    this.input.right = this.keys['ArrowRight'] || this.keys['KeyD'];
    this.input.nitro = this.keys['Space'];
  }

  startRace(trackIndex) {
    this.trackIndex = trackIndex;
    this.track = TRACKS[trackIndex];
    this.state = GameState.RACE;
    this.countdown = 180;
    this.lastCountdownNum = -1;
    this.raceStarted = false;
    this.raceFinished = false;
    this.results = [];
    this.skidTrails = [];
    this.particles = [];

    const playerStats = getStats(this.save.upgrades);
    const aiSkills = [0.88, 0.82, 0.78];
    const aiStatMods = [
      { speed: 1, accel: 1, handling: 1, nitro: 0 },
      { speed: 0, accel: 1, handling: 1, nitro: 0 },
      { speed: 1, accel: 0, handling: 1, nitro: 0 },
    ];

    this.cars = [];
    this.aiControllers = [];

    for (let i = 0; i < 4; i++) {
      const start = this.track.starts[i];
      const isPlayer = i === 0;
      let stats = playerStats;

      if (!isPlayer) {
        const mod = aiStatMods[i - 1];
        stats = getStats({
          speed: this.save.upgrades.speed + mod.speed,
          accel: this.save.upgrades.accel + mod.accel,
          handling: this.save.upgrades.handling + mod.handling,
          nitro: 2,
        });
      }

      const car = new Car(start.x, start.y, start.angle, stats, TRUCK_COLORS[i], isPlayer);
      this.cars.push(car);

      if (!isPlayer) {
        const ai = new AIController(car, this.track.waypoints, aiSkills[i - 1]);
        this.aiControllers.push(ai);
      }
    }

    this.audio.init();
    this.ui.hideAllScreens();
    this.ui.showRaceHud();
  }

  _updateCamera() {
    const player = this.cars[0];
    if (!player) return;
    this.camera.x = player.x - CANVAS_W / 2;
    this.camera.y = player.y - CANVAS_H / 2;
    this.camera.x = Math.max(0, Math.min(CANVAS_W, this.camera.x));
    this.camera.y = Math.max(0, Math.min(CANVAS_H, this.camera.y));
  }

  _getPositions() {
    return [...this.cars].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      const aProg = a.lap * 1000 + a.checkpoint;
      const bProg = b.lap * 1000 + b.checkpoint;
      return bProg - aProg;
    });
  }

  _spawnNitroParticles(car) {
    const colors = ['#ffaa00', '#ff6600', '#ffcc44'];
    for (let i = 0; i < 3; i++) {
      this.particles.push({
        x: car.x - Math.cos(car.angle) * 18 + (Math.random() - 0.5) * 6,
        y: car.y - Math.sin(car.angle) * 18 + (Math.random() - 0.5) * 6,
        vx: -Math.cos(car.angle) * (2 + Math.random() * 3),
        vy: -Math.sin(car.angle) * (2 + Math.random() * 3),
        size: 2 + Math.random() * 3,
        life: 1,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  _spawnDustParticles(car) {
    const surface = getSurfaceAt(this.track, car.x, car.y);
    const dustColor = surface === 'MUD' ? '#5c3a1a' : surface === 'GRASS' ? '#3a6a2a' : '#a08050';
    for (let i = 0; i < 2; i++) {
      this.particles.push({
        x: car.x - Math.cos(car.angle) * 12 + (Math.random() - 0.5) * 10,
        y: car.y - Math.sin(car.angle) * 12 + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        size: 2 + Math.random() * 4,
        life: 0.8,
        color: dustColor,
      });
    }
  }

  _updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.04;
      p.size *= 0.97;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  _updateRace() {
    if (this.countdown > 0) {
      this.countdown--;
      const cdNum = Math.ceil(this.countdown / 60);
      if (cdNum !== this.lastCountdownNum) {
        this.lastCountdownNum = cdNum;
        if (this.countdown === 0) {
          this.audio.countdownBeep(0);
        } else {
          this.audio.countdownBeep(cdNum);
        }
      }
      if (this.countdown === 0) {
        this.raceStarted = true;
        this.audio.startEngine();
      }
      return;
    }

    this._readInput();
    const player = this.cars[0];

    for (const car of this.cars) {
      const surface = getSurfaceAt(this.track, car.x, car.y);
      if (car.isPlayer) {
        car.update(this.input, surface, 1, this.raceStarted);
      }
      car.collideWalls(this.track.walls);
      car.collideCars(this.cars);
      car.checkCheckpoint(this.track.checkpoints);

      if (car.nitroActive) {
        this._spawnNitroParticles(car);
      } else if (Math.abs(car.speed) > 2) {
        this._spawnDustParticles(car);
      }

      if (Math.abs(car.speed) > 1.5) {
        const trailColor = car.nitroActive ? '#aa6633' : '#665544';
        this.skidTrails.push({
          x: car.x - this.camera.x,
          y: car.y - this.camera.y,
          w: car.nitroActive ? 4 : 2.5,
          h: car.nitroActive ? 2 : 1.5,
          angle: car.angle,
          alpha: car.nitroActive ? 0.5 : 0.3,
          color: trailColor,
        });
      }
    }

    if (this.skidTrails.length > 400) this.skidTrails.splice(0, this.skidTrails.length - 400);
    for (const t of this.skidTrails) t.alpha *= 0.97;

    this._updateParticles();

    for (const ai of this.aiControllers) {
      ai.update(this.track);
    }

    if (player) {
      this.audio.updateEngine(Math.abs(player.speed), player.nitroActive);
    }

    this._updateCamera();

    if (!this.raceFinished && this.cars.every((c) => c.finished)) {
      this.raceFinished = true;
      this._endRace();
    }
  }

  _endRace() {
    this.audio.stopEngine();
    this.audio.playFinish();

    const sorted = this._getPositions();
    this.results = sorted.map((car, i) => ({
      name: car.isPlayer ? 'YOU' : car.color.name,
      position: i + 1,
      time: car.finishTime,
      isPlayer: car.isPlayer,
    }));

    const playerPos = this.results.find((r) => r.isPlayer).position;
    const earned = awardRaceCredits(this.save, playerPos);

    if (playerPos === 1) {
      unlockNextTrack(this.save, this.trackIndex);
      if (this.trackIndex === 4) {
        this.save.championshipsWon++;
        writeSave(this.save);
      }
    }

    this.state = GameState.RESULTS;
    this.ui.showResults(this.results, earned, this.track.name, this.save);
  }

  _renderRace() {
    this.renderer.clear();

    this.ctx.save();
    this.ctx.translate(-this.camera.x, -this.camera.y);
    this.renderer.drawTrack(this.track);

    this.renderer.drawSkidMarks(this.skidTrails);
    this.renderer.drawParticles(this.particles, { x: 0, y: 0 });

    const sorted = this._getPositions();
    for (let i = sorted.length - 1; i >= 0; i--) {
      this.renderer.drawCar(sorted[i], { x: 0, y: 0 });
    }
    this.ctx.restore();

    const player = this.cars[0];
    const positions = this._getPositions();
    const playerPos = positions.indexOf(player) + 1;

    this.ui.updateRaceHud({
      position: playerPos,
      lap: Math.min(player.lap + 1, LAPS_PER_RACE),
      totalLaps: LAPS_PER_RACE,
      nitro: player.nitro,
      nitroMax: player.stats.nitroMax,
      speed: Math.abs(player.speed),
      trackName: this.track.name,
      countdown: this.countdown > 0 ? Math.ceil(this.countdown / 60) : 0,
    });

    this.renderer.drawMinimap(this.track, this.cars, CANVAS_W - 130, CANVAS_H - 100, 120, 90);
  }

  loop(timestamp) {
    this.lastTime = timestamp;

    if (this.state === GameState.RACE) {
      this._updateRace();
      this._renderRace();
    }

    requestAnimationFrame((t) => this.loop(t));
  }

  showMenu() {
    this.state = GameState.MENU;
    this.ui.showMainMenu(this.save);
  }

  showChampionship() {
    this.state = GameState.CHAMPIONSHIP;
    this.ui.showChampionship(this.save, TRACKS);
  }

  showUpgrades() {
    this.state = GameState.UPGRADES;
    this.ui.showUpgrades(this.save);
  }
}
