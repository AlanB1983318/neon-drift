import { Game, GameState } from './game.js?v=23';
import { UI } from './ui.js?v=23';
import { loadSave, resetSave } from './save.js?v=23';
import { TRACKS } from './tracks.js?v=23';

const container = document.getElementById('game-container');
const overlay = document.getElementById('ui-overlay');

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
