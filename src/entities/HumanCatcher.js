import Phaser from 'phaser';
import { GAME } from '../config/game.js';

const CATCHER = Object.freeze({
  width: 86,
  height: 166,
  initialThrowDelay: 1300,
  throwDelayMin: 2300,
  throwDelayMax: 2900,
  netSpeed: 520,
  netLifetime: 2200,
  pressureRate: 0.014,
  maxPressure: 120,
});

export class HumanCatcher extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, netGroup) {
    super(scene, x, y, 'human-catcher');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.netGroup = netGroup;
    this.pressure = 0;
    this.nextThrowAt = (scene.playTime ?? 0) + CATCHER.initialThrowDelay;
    this.hoverPhase = Phaser.Math.FloatBetween(0, Math.PI * 2);

    this.setDisplaySize(CATCHER.width, CATCHER.height).setDepth(29);
    this.body.setSize(this.width * 0.48, this.height * 0.86);
    this.body.setOffset(this.width * 0.26, this.height * 0.1);
    this.body.setAllowGravity(false).setImmovable(true).setMaxVelocity(500, 500);
    this.body.updateFromGameObject();

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  updatePursuit(time, delta, player) {
    if (!this.active || !this.body || !player?.body) return;

    if (player.isDashing) {
      this.pressure = Math.max(0, this.pressure - delta * 0.9);
      this.nextThrowAt = Math.max(this.nextThrowAt, time + 500);
    } else {
      this.pressure = Math.min(CATCHER.maxPressure, this.pressure + delta * CATCHER.pressureRate);
    }

    const pursuitGap = 300 - this.pressure;
    const targetX = player.isDashing
      ? -35
      : Phaser.Math.Clamp(player.body.left - pursuitGap, 18, player.x - 150);
    const horizontalGain = player.isDashing ? 4.8 : 1.35;
    const horizontalLimit = player.isDashing ? 460 : 95;
    this.setVelocityX(Phaser.Math.Clamp((targetX - this.x) * horizontalGain, -horizontalLimit, horizontalLimit));

    const targetY = Phaser.Math.Clamp(player.body.center.y - 40, 90, GAME.groundY - 85);
    this.setVelocityY(Phaser.Math.Clamp((targetY - this.y) * 4.2, -420, 420));
    this.rotation = Math.sin(time * 0.006 + this.hoverPhase) * 0.035;

    if (!player.isDashing && this.x > -10 && time >= this.nextThrowAt) this.throwNet(time, player);
    this.updateNets(time);
  }

  throwNet(time, player) {
    if (!this.active || !player?.body) return null;

    const startX = this.body.right + 20;
    const startY = this.body.center.y - 5;
    const angle = Phaser.Math.Angle.Between(startX, startY, player.body.center.x, player.body.center.y);
    const net = this.netGroup.create(startX, startY, 'emp-net');
    net.setDisplaySize(68, 68).setDepth(34).setBlendMode(Phaser.BlendModes.ADD);
    net.body.setAllowGravity(false).setImmovable(true);
    net.body.setCircle(net.width * 0.32, net.width * 0.18, net.height * 0.18);
    net.body.updateFromGameObject();
    net.setVelocity(Math.cos(angle) * CATCHER.netSpeed, Math.sin(angle) * CATCHER.netSpeed);
    net.setAngularVelocity(360);
    net.expiresAt = time + CATCHER.netLifetime;

    this.scene.effects?.burst(startX, startY, 0xff304f, 12, 150);
    this.scene.tweens.add({ targets: this, alpha: 0.55, duration: 90, yoyo: true });
    this.nextThrowAt = time + Phaser.Math.Between(CATCHER.throwDelayMin, CATCHER.throwDelayMax);
    return net;
  }

  updateNets(time) {
    for (const net of this.netGroup.getChildren().slice()) {
      if (!net.active) continue;
      if (time >= net.expiresAt || net.x > GAME.width + 120 || net.y < -120 || net.y > GAME.height + 120) {
        net.destroy();
      }
    }
  }

  retire() {
    if (this.active) this.destroy();
  }

  destroy(fromScene) {
    if (!this.scene) return;
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    super.destroy(fromScene);
  }
}
