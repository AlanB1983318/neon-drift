import { Car } from './car.js?v=23';
import { AIController } from './ai.js?v=23';
import { Renderer3D } from './renderer3d.js?v=23';
import { AudioEngine } from './audio.js?v=23';
import { TRACKS, getSurfaceAt } from './tracks.js?v=23';
import { getStats, awardRaceCredits, unlockNextTrack, writeSave, loadSave } from './save.js?v=23';
import { TRUCK_COLORS, LAPS_PER_RACE } from './utils.js?v=23';
import { ItemSystem, ITEMS } from './items.js?v=23';

export const GameState = {
  MENU: 'menu',
  RACE: 'race',
  RESULTS: 'results',
  UPGRADES: 'upgrades',
  CHAMPIONSHIP: 'championship',
};

export class Game {
  constructor(container, ui) {
    this.container = container;
    this.renderer = new Renderer3D(container);
    this.audio = new AudioEngine();
    this.ui = ui;
    this.items = new ItemSystem();

    this.state = GameState.MENU;
    this.save = null;
    this.trackIndex = 0;
    this.track = null;

    this.cars = [];
    this.aiControllers = [];
    this.input = { up: false, down: false, left: false, right: false, nitro: false, item: false };
    this.keys = {};
    this.touch = { left: false, right: false, brake: false, nitro: false };
    this.itemKeyDown = false;
    this.escapeKeyDown = false;

    this.countdown = 0;
    this.lastCountdownNum = -1;
    this.raceStarted = false;
    this.raceFinished = false;
    this.results = [];
    this.frame = 0;
    this.launchBoostQueued = false;

    this._bindInput();
    this.ui.initTouchControls({
      onChange: (touch) => {
        this.touch = { ...touch };
      },
      onItem: () => {
        if (this.state === GameState.RACE && this.raceStarted) this._usePlayerItem();
      },
      onInteract: () => {
        if (this.state === GameState.RACE && !this.audio.ctx) this.audio.init();
      },
    });
    this.lastTime = 0;
    requestAnimationFrame((t) => this.loop(t));
  }

  setSave(save) {
    this.save = save;
  }

  _bindInput() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyX', 'KeyC', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
        e.preventDefault();
      }
      if (e.code === 'KeyX') {
        if (!this.itemKeyDown && this.state === GameState.RACE && this.raceStarted) {
          this._usePlayerItem();
        }
        this.itemKeyDown = true;
      }
      if (e.code === 'Escape' && this.state === GameState.RACE) {
        e.preventDefault();
        if (!this.escapeKeyDown) {
          this._quitRace();
        }
        this.escapeKeyDown = true;
      }
      if (this.state === GameState.RACE && !this.audio.ctx) {
        this.audio.init();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      if (e.code === 'KeyX') {
        this.itemKeyDown = false;
      }
      if (e.code === 'Escape') {
        this.escapeKeyDown = false;
      }
    });

    document.addEventListener('touchmove', (e) => {
      if (this.state === GameState.RACE) e.preventDefault();
    }, { passive: false });
  }

  _readInput() {
    this.input.up = this.keys['ArrowUp'] || this.keys['KeyW'];
    this.input.down = this.keys['ArrowDown'] || this.keys['KeyS'] || this.touch.brake;
    this.input.left = this.keys['ArrowLeft'] || this.keys['KeyA'] || this.touch.left;
    this.input.right = this.keys['ArrowRight'] || this.keys['KeyD'] || this.touch.right;
    this.input.nitro = this.keys['Space'] || this.keys['KeyC'] || this.touch.nitro;

    const launchTap = this.touch.nitro || this.touch.left || this.touch.right;
    if (this.countdown > 0 && this.countdown <= 90 && (this.input.up || launchTap)) {
      this.launchBoostQueued = true;
    }
  }

  _quitRace() {
    if (!confirm('Quit this race and return to track select?')) return;
    this.audio.stopEngine();
    this.raceFinished = true;
    this.showChampionship();
  }

  _usePlayerItem() {
    const player = this.cars[0];
    if (!player || player.finished) return;
    if (this.items.useItem(player, this.cars)) {
      this.audio.playBeep(660, 0.08, 'square');
    }
  }

  _getPosition(car) {
    return this._getPositions().indexOf(car) + 1;
  }

  startRace(trackIndex) {
    if (!this.save) this.save = loadSave();
    this.trackIndex = trackIndex;
    this.track = TRACKS[trackIndex];
    this.state = GameState.RACE;
    this.countdown = 180;
    this.lastCountdownNum = -1;
    this.raceStarted = false;
    this.raceFinished = false;
    this.results = [];
    this.frame = 0;
    this.launchBoostQueued = false;

    this.renderer.buildTrack(this.track);
    this.items.init(this.track);

    const playerStats = getStats(this.save.upgrades);
    const boostedPlayerStats = {
      ...playerStats,
      turnRate: playerStats.turnRate * 1.15,
      accel: playerStats.accel * 1.1,
    };
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
      let stats = isPlayer ? boostedPlayerStats : playerStats;

      if (!isPlayer) {
        const mod = aiStatMods[i - 1];
        stats = getStats({
          speed: this.save.upgrades.speed + mod.speed,
          accel: this.save.upgrades.accel + mod.accel,
          handling: this.save.upgrades.handling + mod.handling,
          nitro: 2,
        });
      }

      const car = new Car(start.x, start.y, start.angle, stats, TRUCK_COLORS[i], isPlayer, i + 1);
      this.cars.push(car);
      this.renderer.createTruck(car);

      if (!isPlayer) {
        const ai = new AIController(car, this.track.waypoints, aiSkills[i - 1]);
        this.aiControllers.push(ai);
      }
    }

    this.audio.init();
    this.ui.hideAllScreens();
    this.ui.showRaceHud();
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

  _spawnDust(car) {
    const surface = getSurfaceAt(this.track, car.x, car.y);
    const colors = { MUD: '#5c3a1a', GRASS: '#3a6a2a', DIRT: '#a08050', WATER: '#4a88b8', ASPHALT: '#888888' };
    this.renderer.spawnDust(car.x, car.y, colors[surface] || '#a08050');
  }

  _updateRace() {
    this.frame++;

    if (this.countdown > 0) {
      this._readInput();
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
        const player = this.cars[0];
        if (player && this.launchBoostQueued) {
          player.launchBoost = 45;
          player.speed = 4;
        }
      }
      return;
    }

    this._readInput();
    const player = this.cars[0];

    for (const car of this.cars) {
      if (car.isPlayer) {
        const surface = getSurfaceAt(this.track, car.x, car.y);
        car.update(this.input, surface, 1, this.raceStarted);
      }
    }

    for (const ai of this.aiControllers) {
      ai.update(this.track);
    }

    for (const car of this.cars) {
      car.collideWalls(this.track.walls);
      car.collideCars(this.cars);
      car.checkCheckpoint(this.track.checkpoints);

      if (Math.abs(car.speed) > 2.5 && this.frame % 5 === 0 && Math.random() < 0.3) {
        this._spawnDust(car);
      }
      if (car.nitroActive && this.frame % 4 === 0 && Math.random() < 0.25) {
        this.renderer.spawnDust(
          car.x - Math.cos(car.angle) * 20,
          car.y - Math.sin(car.angle) * 20,
          '#ff6600'
        );
      }
    }

    for (const ai of this.aiControllers) {
      this.items.aiUseItem(ai.car, this.cars, (c) => this._getPosition(c));
    }

    this.items.update(this.cars, (c) => this._getPosition(c), this.track.walls);

    if (player) {
      this.audio.updateEngine(Math.abs(player.speed), player.nitroActive || player.starTimer > 0);
    }

    this._finalizeRaceIfReady();
  }

  _finalizeRaceIfReady() {
    if (this.raceFinished) return;

    const player = this.cars[0];
    const playerDone = player?.finished;
    const allDone = this.cars.every((c) => c.finished);

    if (playerDone && !allDone) {
      for (const car of this.cars) {
        if (!car.finished) {
          car.finished = true;
          car.finishTime = car.raceTime + 10000;
        }
      }
    }

    if (playerDone || allDone) {
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
      coins: car.coins,
    }));

    const playerResult = this.results.find((r) => r.isPlayer);
    const playerPos = playerResult.position;
    let earned = awardRaceCredits(this.save, playerPos);
    const coinBonus = (playerResult.coins || 0) * 15;
    if (coinBonus > 0) {
      this.save.credits += coinBonus;
      writeSave(this.save);
      earned += coinBonus;
    }

    if (playerPos === 1) {
      const unlocked = unlockNextTrack(this.save, this.trackIndex);
      if (this.trackIndex === 4) {
        this.save.championshipsWon++;
        writeSave(this.save);
      }
      this._unlockedTrack = unlocked;
    } else {
      this._unlockedTrack = false;
    }

    this.state = GameState.RESULTS;
    this.ui.showResults(this.results, earned, this.track.name, this.save, {
      won: playerPos === 1,
      unlockedTrack: this._unlockedTrack,
      nextTrack: this._unlockedTrack ? TRACKS[this.trackIndex + 1] : null,
    });
  }

  _renderRace() {
    const player = this.cars[0];
    this.renderer.render(this.track, this.cars, player, this.items);

    const positions = this._getPositions();
    const playerPos = positions.indexOf(player) + 1;
    const racers = positions.map((car, i) => ({
      name: car.isPlayer ? 'YOU' : car.color.name,
      position: i + 1,
      color: car.color.body,
      isPlayer: car.isPlayer,
      lap: Math.min(car.lap + 1, LAPS_PER_RACE),
    }));

    const held = player.heldItem ? ITEMS[player.heldItem] : null;

    this.ui.updateRaceHud({
      position: playerPos,
      lap: Math.min(player.lap + 1, LAPS_PER_RACE),
      totalLaps: LAPS_PER_RACE,
      nitro: player.nitro,
      nitroMax: player.stats.nitroMax,
      speed: Math.abs(player.speed),
      trackName: this.track.name,
      countdown: this.countdown > 0 ? Math.ceil(this.countdown / 60) : 0,
      raceStarted: this.raceStarted,
      racers,
      heldItem: held,
      coins: player.coins,
      driftCharge: player.driftCharge,
      starActive: player.starTimer > 0,
      lightningFlash: this.items.lightningFlash > 0,
    });
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
