import Phaser from 'phaser';
import { GAME } from '../config/game.js';

const TYPES = Object.freeze({
  runner: { texture: 'dog', width: 108, height: 74, speed: 1, points: 100 },
  hound: { texture: 'hound', width: 118, height: 84, speed: 1.08, points: 150 },
  drone: { texture: 'drone', width: 90, height: 68, speed: 0.92, points: 180 },
});

export class Dog extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, type = 'runner') {
    const definition = TYPES[type] ?? TYPES.runner;
    super(scene, x, GAME.groundY - definition.height * 0.43, scene.textures.exists(definition.texture) ? definition.texture : 'dog');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(28);
    this.reset(x, type);
  }

  reset(x, type = 'runner') {
    this.type = TYPES[type] ? type : 'runner';
    this.definition = TYPES[this.type];
    this.killed = false;
    this.points = this.definition.points;
    this.spawnedAt = this.scene.playTime ?? this.scene.time.now;
    this.nextJumpAt = this.spawnedAt + Phaser.Math.Between(280, 700);
    this.floatPhase = Phaser.Math.FloatBetween(0, Math.PI * 2);
    this.baseY = this.type === 'drone' ? GAME.groundY - 165 : GAME.groundY - this.definition.height * 0.43;
    const texture = this.scene.textures.exists(this.definition.texture) ? this.definition.texture : 'dog';
    this.setTexture(texture).setDisplaySize(this.definition.width, this.definition.height);
    this.setActive(true).setVisible(true).setAlpha(1).clearTint().setRotation(0);
    this.body.enable = true;
    this.body.reset(x, this.baseY);
    this.configureBody();
    return this;
  }

  /** Call after adding to an Arcade group, whose defaults may change gravity. */
  configureBody() {
    this.body.setSize(this.width * 0.62, this.height * (this.type === 'drone' ? 0.62 : 0.68));
    this.body.setOffset(this.width * 0.2, this.height * 0.25);
    this.body.setAllowGravity(this.type !== 'drone');
    this.body.setGravity(0, 0).setMaxVelocity(1300, 1100).setBounce(0);
    this.body.moves = true;
    this.body.setImmovable(false);
    return this;
  }

  updateRun(time, delta, speed) {
    if (!this.active || !this.body || this.killed) return;
    this.setVelocityX(-speed * this.definition.speed);

    if (this.type === 'drone') {
      const targetY = this.baseY + Math.sin(time * 0.0035 + this.floatPhase) * 38;
      this.setVelocityY((targetY - this.y) * 7);
      this.setRotation(Math.sin(time * 0.005 + this.floatPhase) * 0.055);
    } else {
      const grounded = (this.body.blocked.down || this.body.touching.down) && this.body.velocity.y >= 0;
      const texture = grounded ? `${this.definition.texture}-run-${Math.floor(time / 68) % 4}` : this.definition.texture;
      if (this.texture.key !== texture && this.scene.textures.exists(texture)) this.setTexture(texture);
      const playerX = this.scene.player?.x ?? this.scene.kitten?.x ?? 350;
      if (this.type === 'hound' && grounded && time > this.nextJumpAt && this.x > playerX + 70 && this.x < playerX + 460) {
        this.setVelocityY(-660);
        this.nextJumpAt = time + 1100;
        this.scene.effects?.burst(this.x, this.body.bottom, 0xff00ff, 8, 100);
      }
      const targetRotation = grounded ? Math.sin(time * 0.025 + this.floatPhase) * 0.025 : Phaser.Math.Clamp(this.body.velocity.y / 7000, -0.08, 0.1);
      this.rotation = Phaser.Math.Linear(this.rotation, targetRotation, Math.min(1, delta / 80));
    }

    if (this.x < -170 || this.y > GAME.height + 150) this.retire();
  }

  retire() {
    this.killed = true;
    this.destroy();
  }
}
