import Phaser from 'phaser';
import { createTextures } from '../assets/createTextures.js';
import customBgMusicUrl from '../assets/michi-run-music.mp4?url';

export class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  preload() {
    this.load.image('city-art', '/assets/neo-tokyo.webp');
    this.load.audio('customBgMusic', { url: customBgMusicUrl, type: 'm4a' });
    this.load.on('progress', (progress) => this.registry.get('ui')?.loading(progress));
    this.load.on('loaderror', (file) => console.warn(`No se pudo cargar ${file.key}; se usará el escenario procedural.`));
  }

  create() {
    createTextures(this);
    this.scene.start('GameScene');
  }
}
