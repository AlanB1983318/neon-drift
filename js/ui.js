import { buyUpgrade, getUpgradeCost } from './save.js';
import { MAX_UPGRADE_LEVEL } from './utils.js';

export class UI {
  constructor(overlay, callbacks) {
    this.overlay = overlay;
    this.callbacks = callbacks;
    this.screens = {};
    this._buildScreens();
  }

  _buildScreens() {
    this.overlay.innerHTML = `
      <div id="screen-menu" class="screen">
        <div class="title">Neon Drift</div>
        <div class="subtitle">Hover Championship 2087</div>
        <button class="btn" id="btn-championship">Enter Championship</button>
        <button class="btn" id="btn-upgrades">Ship Upgrades</button>
        <button class="btn btn-secondary" id="btn-reset">Reset Progress</button>
        <div class="controls-hint">
          ↑ / W — Thrust &nbsp;|&nbsp; ↓ / S — Reverse Brake<br>
          ← → / A D — Vector Steer &nbsp;|&nbsp; SPACE — Plasma Boost
        </div>
        <div id="menu-credits" class="credits" style="margin-top:16px"></div>
      </div>

      <div id="screen-championship" class="screen hidden">
        <div class="title" style="font-size:2rem">Championship</div>
        <div id="track-list" class="track-select"></div>
        <button class="btn" id="btn-start-race">Launch Race</button>
        <button class="btn btn-secondary" id="btn-champ-back">Abort</button>
      </div>

      <div id="screen-upgrades" class="screen hidden">
        <div class="title" style="font-size:2rem">Ship Bay</div>
        <div class="stats-panel">
          <div id="upgrade-credits" class="credits"></div>
          <div id="upgrade-list"></div>
        </div>
        <button class="btn btn-secondary" id="btn-upgrades-back">Return</button>
      </div>

      <div id="screen-results" class="screen hidden">
        <div class="title" style="font-size:2rem">Race Complete</div>
        <div class="stats-panel">
          <h3 id="results-track"></h3>
          <table class="results-table">
            <thead><tr><th>Pos</th><th>Pilot</th><th>Time</th></tr></thead>
            <tbody id="results-body"></tbody>
          </table>
          <div id="results-earned" class="credits"></div>
        </div>
        <button class="btn" id="btn-results-continue">Continue</button>
      </div>

      <div id="race-hud" class="race-hud hidden">
        <div class="hud-left hud-panel">
          <div id="hud-track" class="track-name-hud"></div>
          <div class="lap-display" id="hud-lap"></div>
          <div id="hud-speed" class="speed-hud"></div>
        </div>
        <div class="hud-center hud-panel">
          <div class="position-display" id="hud-position"></div>
        </div>
        <div class="hud-right hud-panel" style="align-items:flex-end">
          <div class="nitro-label">PLASMA</div>
          <div class="nitro-bar-wrap"><div class="nitro-bar" id="hud-nitro"></div></div>
        </div>
      </div>

      <div id="countdown" class="countdown hidden"></div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    document.getElementById('btn-championship').onclick = () => this.callbacks.onChampionship();
    document.getElementById('btn-upgrades').onclick = () => this.callbacks.onUpgrades();
    document.getElementById('btn-reset').onclick = () => this.callbacks.onReset();
    document.getElementById('btn-champ-back').onclick = () => this.callbacks.onMenu();
    document.getElementById('btn-upgrades-back').onclick = () => this.callbacks.onMenu();
    document.getElementById('btn-start-race').onclick = () => this._startSelectedRace();
    document.getElementById('btn-results-continue').onclick = () => this.callbacks.onMenu();
  }

  hideAllScreens() {
    this.overlay.querySelectorAll('.screen').forEach((s) => s.classList.add('hidden'));
    document.getElementById('race-hud').classList.add('hidden');
    document.getElementById('countdown').classList.add('hidden');
  }

  showMainMenu(save) {
    this.hideAllScreens();
    document.getElementById('screen-menu').classList.remove('hidden');
    document.getElementById('menu-credits').textContent = `Credits: ◈ ${save.credits}`;
    if (save.championshipsWon > 0) {
      document.getElementById('menu-credits').textContent +=
        `  |  Titles: ${save.championshipsWon}`;
    }
  }

  showChampionship(save, tracks) {
    this.hideAllScreens();
    document.getElementById('screen-championship').classList.remove('hidden');

    const list = document.getElementById('track-list');
    list.innerHTML = '';
    this.selectedTrack = Math.min(save.tracksUnlocked - 1, tracks.length - 1);

    tracks.forEach((track, i) => {
      const locked = i >= save.tracksUnlocked;
      const btn = document.createElement('button');
      btn.className = 'track-btn' + (locked ? ' locked' : '') + (i === this.selectedTrack ? ' selected' : '');
      btn.textContent = locked
        ? `◌ LOCKED — ${track.name}`
        : `▸ ${i + 1}. ${track.name} — ${track.description}`;
      if (!locked) {
        btn.onclick = () => {
          this.selectedTrack = i;
          list.querySelectorAll('.track-btn').forEach((b) => b.classList.remove('selected'));
          btn.classList.add('selected');
        };
      }
      list.appendChild(btn);
    });
  }

  _startSelectedRace() {
    this.callbacks.onStartRace(this.selectedTrack ?? 0);
  }

  showUpgrades(save) {
    this.hideAllScreens();
    document.getElementById('screen-upgrades').classList.remove('hidden');
    this._renderUpgrades(save);
  }

  _renderUpgrades(save) {
    document.getElementById('upgrade-credits').textContent = `Credits: ◈ ${save.credits}`;
    const list = document.getElementById('upgrade-list');
    list.innerHTML = '';

    const labels = {
      speed: 'Thruster Output',
      accel: 'Acceleration Core',
      handling: 'Vector Control',
      nitro: 'Plasma Capacity',
    };

    for (const [stat, label] of Object.entries(labels)) {
      const level = save.upgrades[stat];
      const cost = getUpgradeCost(level);
      const maxed = level >= MAX_UPGRADE_LEVEL;

      const row = document.createElement('div');
      row.className = 'upgrade-row';
      row.innerHTML = `
        <span>${label}</span>
        <span class="level">MK ${level}/${MAX_UPGRADE_LEVEL}</span>
        <button ${maxed || save.credits < cost ? 'disabled' : ''}>
          ${maxed ? 'MAX' : `◈ ${cost}`}
        </button>
      `;
      row.querySelector('button').onclick = () => {
        if (buyUpgrade(save, stat)) this._renderUpgrades(save);
      };
      list.appendChild(row);
    }
  }

  showRaceHud() {
    document.getElementById('race-hud').classList.remove('hidden');
  }

  updateRaceHud(data) {
    document.getElementById('hud-track').textContent = data.trackName;
    document.getElementById('hud-lap').textContent = `LAP ${data.lap} / ${data.totalLaps}`;
    document.getElementById('hud-position').textContent = `${this._ordinal(data.position)}`;
    document.getElementById('hud-speed').textContent = `${Math.round(data.speed * 20)} KM/H`;
    document.getElementById('hud-nitro').style.width =
      `${(data.nitro / data.nitroMax) * 100}%`;

    const cd = document.getElementById('countdown');
    if (data.countdown > 0) {
      cd.classList.remove('hidden');
      cd.textContent = data.countdown === 1 ? 'GO!' : data.countdown;
    } else {
      cd.classList.add('hidden');
    }
  }

  showResults(results, earned, trackName, save) {
    this.hideAllScreens();
    document.getElementById('screen-results').classList.remove('hidden');
    document.getElementById('results-track').textContent = trackName;
    document.getElementById('results-earned').textContent = `Earned: ◈ ${earned}`;

    const body = document.getElementById('results-body');
    body.innerHTML = '';
    for (const r of results) {
      const tr = document.createElement('tr');
      if (r.isPlayer) tr.className = 'player-row';
      const timeStr = this._formatTime(r.time);
      tr.innerHTML = `<td>${r.position}</td><td>${r.name}</td><td>${timeStr}</td>`;
      body.appendChild(tr);
    }
  }

  _ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  _formatTime(frames) {
    const secs = frames / 60;
    const m = Math.floor(secs / 60);
    const s = (secs % 60).toFixed(2);
    return `${m}:${s.padStart(5, '0')}`;
  }
}
