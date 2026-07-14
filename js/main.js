import { Game, GameState } from './game.js';
import { UI } from './ui.js';
import { loadSave, resetSave } from './save.js';
import { TRACKS } from './tracks.js';

const canvas = document.getElementById('game-canvas');
const overlay = document.getElementById('ui-overlay');

let save = loadSave();
let game;

const ui = new UI(overlay, {
  onMenu: () => {
    game.state = GameState.MENU;
    ui.showMainMenu(save);
  },
  onChampionship: () => {
    game.state = GameState.CHAMPIONSHIP;
    ui.showChampionship(save, TRACKS);
  },
  onUpgrades: () => {
    game.state = GameState.UPGRADES;
    ui.showUpgrades(save);
  },
  onStartRace: (trackIndex) => {
    game.startRace(trackIndex);
  },
  onReset: () => {
    if (confirm('Reset all progress? This cannot be undone.')) {
      save = resetSave();
      game.setSave(save);
      ui.showMainMenu(save);
    }
  },
});

game = new Game(canvas, ui);
game.setSave(save);
ui.showMainMenu(save);
