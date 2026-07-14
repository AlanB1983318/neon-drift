import { buyUpgrade, getUpgradeCost } from './save.js?v=22';
import { MAX_UPGRADE_LEVEL } from './utils.js?v=22';

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
        <div class="title">Super Off-Road</div>
        <div class="subtitle">3D Championship</div>
        <button class="btn" id="btn-championship">Start Championship</button>
        <button class="btn" id="btn-upgrades">Upgrade Truck</button>
        <button class="btn btn-secondary" id="btn-reset">Reset Progress</button>
        <div class="controls-hint">
          Auto-accelerates — steer with ← → or A D<br>
          ↓ / S — Brake &nbsp;|&nbsp; ↑ / W — Extra gas<br>
          SPACE / C — Nitro &nbsp;|&nbsp; X — Use Item<br>
          ESC — Quit race
        </div>
        <div id="menu-credits" class="credits" style="margin-top:16px"></div>
      </div>

      <div id="screen-championship" class="screen hidden">
        <div class="title" style="font-size:2rem">Championship</div>
        <div id="track-list" class="track-select"></div>
        <button class="btn" id="btn-start-race">Start Race</button>
        <button class="btn btn-secondary" id="btn-champ-back">Back</button>
      </div>

      <div id="screen-upgrades" class="screen hidden">
        <div class="title" style="font-size:2rem">Truck Garage</div>
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
        <button class="btn" id="btn-results-continue">Next Track</button>
      </div>

      <div id="race-hud" class="race-hud hidden">
        <div id="racer-bar" class="racer-bar"></div>
        <div class="hud-row">
          <div class="hud-left hud-panel">
            <div id="hud-track" class="track-name-hud"></div>
            <div class="lap-display" id="hud-lap"></div>
            <div id="hud-speed" class="speed-hud"></div>
          </div>
          <div class="hud-center hud-panel">
            <div class="position-display" id="hud-position"></div>
          </div>
          <div class="hud-right hud-panel">
            <div class="item-slot" id="hud-item">
              <span class="item-icon" id="hud-item-icon">—</span>
              <span class="item-name" id="hud-item-name">NO ITEM</span>
            </div>
            <div class="coin-display" id="hud-coins">🪙 0</div>
            <div class="drift-label">DRIFT BOOST</div>
            <div class="drift-bar-wrap"><div class="drift-bar" id="hud-drift"></div></div>
            <div class="nitro-label">NITRO</div>
            <div class="nitro-bar-wrap"><div class="nitro-bar" id="hud-nitro"></div></div>
          </div>
        </div>
      </div>

      <div id="lightning-flash" class="lightning-flash hidden"></div>
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
    document.getElementById('btn-results-continue').onclick = () => {
      if (this.callbacks.onResultsContinue) {
        this.callbacks.onResultsContinue();
      } else {
        this.callbacks.onMenu();
      }
    };
  }

  hideAllScreens() {
    this.overlay.querySelectorAll('.screen').forEach((s) => s.classList.add('hidden'));
    document.getElementById('race-hud').classList.add('hidden');
    document.getElementById('countdown').classList.add('hidden');
  }

  showMainMenu(save) {
    this.hideAllScreens();
    document.getElementById('screen-menu').classList.remove('hidden');
    document.getElementById('menu-credits').textContent = `Cash: $${save.credits}`;
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
        ? `🔒 LOCKED — ${track.name}`
        : `${i + 1}. ${track.name} — ${track.description}`;
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
    document.getElementById('upgrade-credits').textContent = `Cash: $${save.credits}`;
    const list = document.getElementById('upgrade-list');
    list.innerHTML = '';

    const labels = {
      speed: 'Top Speed',
      accel: 'Acceleration',
      handling: 'Handling',
      nitro: 'Nitro Tank',
    };

    for (const [stat, label] of Object.entries(labels)) {
      const level = save.upgrades[stat];
      const cost = getUpgradeCost(level);
      const maxed = level >= MAX_UPGRADE_LEVEL;

      const row = document.createElement('div');
      row.className = 'upgrade-row';
      row.innerHTML = `
        <span>${label}</span>
        <span class="level">LV ${level}/${MAX_UPGRADE_LEVEL}</span>
        <button ${maxed || save.credits < cost ? 'disabled' : ''}>
          ${maxed ? 'MAX' : `$${cost}`}
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
    document.getElementById('hud-track').textContent = data.trackName.toUpperCase();
    document.getElementById('hud-lap').textContent = `LAP ${data.lap}/${data.totalLaps}`;
    document.getElementById('hud-position').textContent = this._ordinal(data.position).toUpperCase();
    document.getElementById('hud-speed').textContent = `${Math.round(data.speed * 22)} MPH`;
    document.getElementById('hud-nitro').style.width =
      `${(data.nitro / data.nitroMax) * 100}%`;

    const driftEl = document.getElementById('hud-drift');
    if (driftEl) {
      driftEl.style.width = `${((data.driftCharge || 0) / 50) * 100}%`;
      driftEl.classList.toggle('ready', (data.driftCharge || 0) >= 50);
    }

    const itemIcon = document.getElementById('hud-item-icon');
    const itemName = document.getElementById('hud-item-name');
    if (data.heldItem) {
      itemIcon.textContent = data.heldItem.icon;
      itemName.textContent = `${data.heldItem.name.toUpperCase()} (X)`;
      document.getElementById('hud-item').classList.add('has-item');
    } else {
      itemIcon.textContent = '—';
      itemName.textContent = 'NO ITEM';
      document.getElementById('hud-item').classList.remove('has-item');
    }

    document.getElementById('hud-coins').textContent = `🪙 ${data.coins || 0}`;

    const flash = document.getElementById('lightning-flash');
    if (data.lightningFlash) {
      flash.classList.remove('hidden');
    } else {
      flash.classList.add('hidden');
    }

    if (data.starActive) {
      document.getElementById('hud-item').classList.add('star-active');
    } else {
      document.getElementById('hud-item').classList.remove('star-active');
    }

    const bar = document.getElementById('racer-bar');
    if (data.racers) {
      bar.innerHTML = data.racers.map((r) => `
        <div class="racer-slot ${r.isPlayer ? 'player-slot' : ''}" style="border-color:${r.color}">
          <span class="racer-color" style="background:${r.color}"></span>
          <span class="racer-name">${r.name}</span>
          <span class="racer-pos">${this._ordinal(r.position).toUpperCase()}</span>
          <span class="racer-lap">L${r.lap}</span>
        </div>
      `).join('');
    }

    const cd = document.getElementById('countdown');
    if (data.countdown > 0 && !data.raceStarted) {
      cd.classList.remove('hidden');
      cd.textContent = String(data.countdown);
    } else {
      cd.classList.add('hidden');
      cd.textContent = '';
    }
  }

  showResults(results, earned, trackName, save, meta = {}) {
    this.hideAllScreens();
    document.getElementById('screen-results').classList.remove('hidden');
    document.getElementById('results-track').textContent = trackName;
    let earnedText = `Earned: $${earned}`;

    const playerResult = results.find((r) => r.isPlayer);
    if (playerResult?.coins > 0) {
      earnedText += `  (+$${playerResult.coins * 15} from ${playerResult.coins} coins)`;
    }
    if (meta.won && meta.unlockedTrack && meta.nextTrack) {
      earnedText += `  —  Unlocked: ${meta.nextTrack.name}!`;
    } else if (meta.won && !meta.nextTrack) {
      earnedText += '  —  Championship complete!';
    }
    document.getElementById('results-earned').textContent = earnedText;

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
