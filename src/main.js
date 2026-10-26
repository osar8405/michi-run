import Phaser from 'phaser';
import '@fontsource/rajdhani/latin-400.css';
import '@fontsource/rajdhani/latin-500.css';
import '@fontsource/rajdhani/latin-600.css';
import '@fontsource/rajdhani/latin-700.css';
import '@fontsource/orbitron/latin-800.css';
import '@fontsource/orbitron/latin-900.css';
import { GAME } from './config/game.js';
import { BootScene } from './scenes/BootScene.js';
import { GameScene } from './scenes/GameScene.js';
import { GameInterface } from './ui/GameInterface.js';
import './style.css';

const ui = new GameInterface(document.querySelector('#app'));
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-canvas',
  width: GAME.width,
  height: GAME.height,
  backgroundColor: '#0d0221',
  antialias: true,
  roundPixels: false,
  powerPreference: 'high-performance',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: GAME.gravity }, debug: false, fps: 60, fixedStep: true, customUpdate: true },
  },
  input: { activePointers: 4 },
  scene: [BootScene, GameScene],
  callbacks: { preBoot: (instance) => instance.registry.set('ui', ui) },
});
ui.attach(game);
// Read-only inspection hook for local browser diagnostics, excluded in production.
if (import.meta.env.DEV) window.__MICHI_GAME__ = game;
if (import.meta.hot) import.meta.hot.dispose(() => { ui.destroy(); game.destroy(true); });
