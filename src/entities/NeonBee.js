import Phaser from 'phaser';

const TEXTURE_KEY = 'neon-bee';
const RED = 0xff304f;
const ORANGE = 0xff8a24;
const YELLOW = 0xffe66d;

export const NEON_BEE_RULES = Object.freeze({
  chaseSpeed: 720,
  waveVelocity: 95,
  energyDrainPerSecond: 8,
  evolutionDrainPerSecond: 1.2,
  maxActiveLevel4: 6,
  maxActiveLevel5: 10,
  trailLifetime: 280,
  trailInterval: 32,
});

function createTexture(scene) {
  if (scene.textures.exists(TEXTURE_KEY)) return;

  const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
  graphics.fillStyle(YELLOW, 0.08).fillCircle(26, 18, 17);
  graphics.fillStyle(ORANGE, 0.2).fillCircle(26, 18, 12);
  graphics.fillStyle(0xffffff, 0.72).fillEllipse(19, 9, 12, 8);
  graphics.fillStyle(0xffffff, 0.72).fillEllipse(31, 9, 12, 8);
  graphics.fillStyle(ORANGE, 1).fillCircle(20, 19, 7);
  graphics.fillStyle(YELLOW, 1).fillCircle(28, 19, 8);
  graphics.fillStyle(0x3a1400, 0.9).fillRect(23, 12, 3, 14);
  graphics.fillStyle(0xffffff, 0.95).fillCircle(31, 16, 2);
  graphics.fillStyle(YELLOW, 0.9).fillCircle(39, 19, 3);
  graphics.generateTexture(TEXTURE_KEY, 52, 36);
  graphics.destroy();
}

export class NeonBee extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    createTexture(scene);
    super(scene, x, y, TEXTURE_KEY);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.attached = false;
    this.target = null;
    this.attachSlot = 0;
    this.attachedAt = 0;
    this.flightPhase = Phaser.Math.FloatBetween(0, Math.PI * 2);
    this.lastTrailAt = -Infinity;
    this.trailPoints = [];
    this.trail = scene.add.graphics().setDepth(27).setBlendMode(Phaser.BlendModes.ADD);

    this.setDisplaySize(40, 28).setDepth(28).setBlendMode(Phaser.BlendModes.ADD);
    this.body.setCircle(8, this.width / 2 - 8, this.height / 2 - 8);
    this.body.setAllowGravity(false).setMaxVelocity(800, 800);
    this.body.updateFromGameObject();

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  updateFlight(time, delta, player) {
    if (!this.active || !player?.body) return;
    if (this.attached) {
      this.updateAttached(time, delta);
      return;
    }

    const targetX = player.body.center.x;
    const targetY = player.body.center.y;
    const angle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
    const wave = Math.sin(time * 0.009 + this.flightPhase) * NEON_BEE_RULES.waveVelocity;
    this.setVelocity(
      Math.cos(angle) * NEON_BEE_RULES.chaseSpeed - Math.sin(angle) * wave,
      Math.sin(angle) * NEON_BEE_RULES.chaseSpeed + Math.cos(angle) * wave,
    );
    this.rotation = angle + Math.sin(time * 0.018 + this.flightPhase) * 0.18;
    this.updateTrail(time, delta, ORANGE);
  }

  attachTo(player, slot = 0, time = this.scene?.playTime ?? 0) {
    if (!this.active || this.attached || !player?.body) return false;
    this.attached = true;
    this.target = player;
    this.attachSlot = slot;
    this.attachedAt = time;
    this.body.enable = false;
    this.setVelocity(0, 0);
    this.setTintFill(RED);
    this.scene.tweens.add({
      targets: this,
      alpha: 0.3,
      duration: 70,
      yoyo: true,
      repeat: 2,
      onComplete: () => {
        if (!this.active) return;
        this.setAlpha(1).clearTint();
      },
    });
    return true;
  }

  updateAttached(time, delta) {
    if (!this.target?.active || !this.target.body) {
      this.retire();
      return;
    }

    const side = this.attachSlot % 2 === 0 ? -1 : 1;
    const row = Math.floor(this.attachSlot / 2);
    const scale = this.target.evolution?.scale ?? 1;
    const jitter = Math.sin(time * 0.025 + this.flightPhase) * 4;
    this.setPosition(
      this.target.x + side * (27 + row * 8) * scale + jitter,
      this.target.y - (8 + (row % 3) * 14) * scale + Math.cos(time * 0.021 + this.flightPhase) * 4,
    );
    this.rotation = side * 0.25 + Math.sin(time * 0.03 + this.flightPhase) * 0.12;
    this.updateTrail(time, delta, time - this.attachedAt < 500 ? RED : ORANGE);
  }

  updateTrail(time, delta, color) {
    if (time - this.lastTrailAt >= NEON_BEE_RULES.trailInterval) {
      this.trailPoints.push({ x: this.x, y: this.y, life: 1 });
      this.lastTrailAt = time;
    }

    const decay = delta / NEON_BEE_RULES.trailLifetime;
    for (const point of this.trailPoints) point.life -= decay;
    this.trailPoints = this.trailPoints.filter((point) => point.life > 0);
    this.trail.clear();
    for (const [index, point] of this.trailPoints.entries()) {
      const alpha = point.life * (0.5 - index * 0.025);
      if (alpha <= 0) continue;
      this.trail.fillStyle(color, alpha).fillCircle(point.x, point.y, 2 + point.life * 3);
    }
  }

  shakeOff() {
    if (!this.active) return;
    this.scene.effects?.burst(this.x, this.y, RED, 16, 170);
    this.scene.effects?.burst(this.x, this.y, YELLOW, 10, 120);
    this.retire();
  }

  retire() {
    if (!this.active) return;
    const swarm = this.scene?.bees;
    if (swarm?.children && swarm.contains(this)) swarm.remove(this, false, false);
    this.destroy();
  }

  destroy(fromScene) {
    if (!this.scene) return;
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.scene.tweens.killTweensOf(this);
    this.trail?.destroy();
    this.trail = null;
    this.trailPoints.length = 0;
    super.destroy(fromScene);
  }
}
