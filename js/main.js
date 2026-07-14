import { Game } from './game.js?v=24';
import { UI } from './ui.js?v=24';
import { loadSave, resetSave } from './save.js?v=24';

function hideBootLoading() {
  document.getElementById('boot-loading')?.classList.add('hidden');
}

function showBootError(message) {
  hideBootLoading();
  const box = document.getElementById('boot-error');
  if (!box) return;
  box.classList.remove('hidden');
  box.innerHTML = `<h1>Game failed to load</h1><p>${message}</p><p>Try a hard refresh (Ctrl+Shift+R) or <a href="https://alanb1983318.github.io/neon-drift/?v=24">open the live version</a>.</p>`;
}

try {
  const container = document.getElementById('game-container');
  const overlay = document.getElementById('ui-overlay');
  if (!container || !overlay) {
    throw new Error('Game container missing from page.');
  }

  let save = loadSave();
  let game;

  const ui = new UI(overlay, {
    onMenu: () => {
      save = game.save ?? loadSave();
      game.setSave(save);
      game.showMenu();
    },
    onChampionship: () => {
      save = game.save ?? loadSave();
      game.setSave(save);
      game.showChampionship();
    },
    onUpgrades: () => {
      save = game.save ?? loadSave();
      game.setSave(save);
      game.showUpgrades();
    },
    onResultsContinue: () => {
      save = game.save ?? loadSave();
      game.setSave(save);
      game.showChampionship();
    },
    onStartRace: (trackIndex) => {
      game.audio.init();
      game.startRace(trackIndex);
    },
    onInteract: () => {
      game.audio.init();
    },
    onReset: () => {
      if (confirm('Reset all progress? This cannot be undone.')) {
        save = resetSave();
        game.setSave(save);
        game.showMenu();
      }
    },
  });

  game = new Game(container, ui);
  game.setSave(save);
  ui.showMainMenu(save);
  hideBootLoading();
} catch (err) {
  console.error(err);
  showBootError(err?.message || 'Unknown startup error');
}
