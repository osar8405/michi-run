import Phaser from 'phaser';
import { COLORS, GAME, PREDATOR_WOLF } from '../config/game.js';

const TEXTURE_KEY = 'predator-wolf';

function createTexture(scene) {
  if (scene.textures.exists(TEXTURE_KEY)) return;

  const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
  graphics.fillStyle(0xff304f, 0.08).fillEllipse(68, 42, 120, 70);
  graphics.fillStyle(0x090817, 1);
  graphics.fillTriangle(24, 34, 34, 3, 50, 29);
  graphics.fillTriangle(72, 27, 91, 2, 96, 39);
  graphics.fillEllipse(61, 44, 82, 50);
  graphics.fillTriangle(83, 40, 122, 49, 84, 61);
  graphics.fillStyle(0x26122f, 1).fillEllipse(58, 48, 66, 35);
  graphics.lineStyle(3, 0xff304f, 0.9).strokeEllipse(61, 44, 82, 50);
  graphics.fillStyle(COLORS.yellow, 1).fillTriangle(44, 37, 54, 38, 49, 44);
  graphics.fillStyle(COLORS.yellow, 1).fillTriangle(70, 38, 80, 37, 75, 44);
  graphics.fillStyle(0xffffff, 0.85).fillTriangle(104, 50, 117, 52, 105, 57);
  graphics.generateTexture(TEXTURE_KEY, 132, 82);
  graphics.destroy();
}

export class PredatorWolf extends Phaser.Physics.Arcade.Sprite {
  constructor(scene) {
    createTexture(scene);
    super(scene, -120, GAME.groundY - 46, TEXTURE_KEY);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.proximityElapsed = 0;
    this.flightPhase = Phaser.Math.FloatBetween(0, Math.PI * 2);
    this.setDisplaySize(132, 82).setDepth(31).setBlendMode(Phaser.BlendModes.ADD);
    this.body.setSize(this.width * 0.62, this.height * 0.58, true);
    this.body.setAllowGravity(false).setMaxVelocity(500, 500);
    this.body.updateFromGameObject();
    this.tether = scene.add.graphics().setDepth(24).setBlendMode(Phaser.BlendModes.ADD);

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  updatePursuit(time, delta, player) {
    if (!this.active || !this.body || !player?.body) return;

    const targetX = player.body.center.x;
    const targetY = player.body.center.y;
    const dx = targetX - this.body.center.x;
    const dy = targetY - this.body.center.y;
    const distance = Math.hypot(dx, dy);
    const speed = PREDATOR_WOLF.chaseSpeed
      + Math.min(PREDATOR_WOLF.distanceSpeedBonus, distance * 0.16);
    const angle = Math.atan2(dy, dx);
    const blend = Math.min(1, delta / 260);
    this.setVelocity(
      Phaser.Math.Linear(this.body.velocity.x, Math.cos(angle) * speed, blend),
      Phaser.Math.Linear(this.body.velocity.y, Math.sin(angle) * speed, blend),
    );
    this.rotation = Phaser.Math.Linear(this.rotation, angle * 0.08, Math.min(1, delta / 100));
    this.setScale(1 + Math.sin(time * 0.008 + this.flightPhase) * 0.035);

    if (distance <= PREDATOR_WOLF.lethalRange) this.proximityElapsed += delta;
    else this.proximityElapsed = 0;

    this.drawPressureLine(player, distance);
    if (this.proximityElapsed >= PREDATOR_WOLF.lethalDuration) {
      this.scene.onWolfCapture();
    }
  }

  drawPressureLine(player, distance) {
    const pressure = Phaser.Math.Clamp(
      this.proximityElapsed / PREDATOR_WOLF.lethalDuration,
      0,
      1,
    );
    this.tether.clear();
    if (distance > PREDATOR_WOLF.lethalRange * 1.8) return;
    this.tether.lineStyle(3 + pressure * 7, 0xff304f, 0.14 + pressure * 0.55);
    this.tether.lineBetween(this.x, this.y, player.x, player.y);
    this.tether.lineStyle(2, COLORS.yellow, pressure * 0.8);
    this.tether.strokeCircle(player.x, player.y, 48 + pressure * 18);
  }

  get pressure() {
    return Phaser.Math.Clamp(
      this.proximityElapsed / PREDATOR_WOLF.lethalDuration,
      0,
      1,
    );
  }

  destroy(fromScene) {
    if (!this.scene) return;
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.tether?.destroy();
    this.tether = null;
    super.destroy(fromScene);
  }
}
