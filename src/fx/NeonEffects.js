import Phaser from 'phaser';

/** Bounded, scene-owned effects: pooled particles and short-lived graphics. */
export class NeonEffects {
  constructor(scene) {
    this.scene = scene;
    this.active = new Set();
    this.emitters = new Map();
    for (const color of [0x00f3ff, 0xff00ff, 0xffe66d, 0xff8a24, 0xffffff]) {
      const emitter = scene.add.particles(0, 0, 'spark', {
        emitting: false,
        lifespan: { min: 260, max: 620 },
        speed: { min: 80, max: 280 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.4, end: 0 },
        alpha: { start: 1, end: 0 },
        gravityY: 130,
        tint: color,
        blendMode: Phaser.BlendModes.ADD,
        maxParticles: 180,
      }).setDepth(35);
      this.emitters.set(color, emitter);
    }
    this.emitters.set('pixels', scene.add.particles(0, 0, 'pixel', {
      emitting: false, lifespan: { min: 300, max: 750 }, speed: { min: 130, max: 430 },
      angle: { min: 0, max: 360 }, rotate: { min: 0, max: 180 },
      scale: { start: 1.25, end: 0 }, alpha: { start: 1, end: 0 }, gravityY: 400,
      blendMode: Phaser.BlendModes.ADD, maxParticles: 120,
    }).setDepth(38));
  }

  burst(x, y, color = 0x00f3ff, count = 16, speed = 220) {
    const emitter = this.emitters.get(color) ?? this.emitters.get(0x00f3ff);
    emitter.setParticleSpeed({ min: speed * 0.25, max: speed });
    emitter.explode(Math.min(count, 64), x, y);
    if (count < 12) return;
    const ring = this.scene.add.circle(x, y, 8).setStrokeStyle(2, color, 0.9).setDepth(34).setBlendMode(Phaser.BlendModes.ADD);
    this.trackTween(ring, { scale: 5.8, alpha: 0, duration: 330, ease: 'Cubic.Out' });
    const flash = this.scene.add.image(x, y, 'glow').setTint(color).setScale(1.1).setAlpha(0.65).setDepth(34).setBlendMode(Phaser.BlendModes.ADD);
    this.trackTween(flash, { scale: 2, alpha: 0, duration: 230, ease: 'Quad.Out' });
  }

  shatter(x, y, color) {
    this.emitters.get('pixels').setParticleTint(color).explode(80, x, y);
    this.burst(x, y, color, 48, 430);
  }

  roar(x, y) {
    for (let i = 0; i < 3; i++) {
      const ring = this.scene.add.circle(x, y, 30 + i * 12)
        .setStrokeStyle(5 - i, i === 1 ? 0xffffff : 0xffe66d, 0.85)
        .setDepth(36).setBlendMode(Phaser.BlendModes.ADD);
      this.trackTween(ring, { scale: 35, alpha: 0, duration: 550 + i * 90, ease: 'Cubic.Out' });
    }
    this.burst(x, y, 0xffe66d, 64, 500);
    this.floatText(x, y - 85, 'RUGIDO SOLAR', '#ffe66d');
  }

  slash(x, y, color = 0x00f3ff, scale = 1) {
    const arc = this.scene.add.graphics().setDepth(37).setBlendMode(Phaser.BlendModes.ADD);
    arc.setPosition(x, y).setScale(scale);
    for (let index = 0; index < 3; index++) {
      arc.lineStyle(9 - index * 2.2, index === 1 ? 0xffffff : color, index ? 0.95 : 0.22);
      arc.beginPath();
      arc.moveTo(-26 + index * 13, 35);
      arc.lineTo(8 + index * 13, -6);
      arc.lineTo(48 + index * 10, -46);
      arc.strokePath();
      arc.lineStyle(1.5, 0xffffff, 0.9);
      arc.beginPath();
      arc.moveTo(-23 + index * 13, 32);
      arc.lineTo(45 + index * 10, -42);
      arc.strokePath();
    }
    this.trackTween(arc, { x: x + 32 * scale, scaleX: 1.25 * scale, alpha: 0, duration: 200, ease: 'Quad.Out' });
  }

  afterimage(sprite) {
    if (this.active.size > 55 || !sprite.active) return;
    const ghost = this.scene.add.image(sprite.x, sprite.y, sprite.texture.key, sprite.frame.name)
      .setOrigin(sprite.originX, sprite.originY)
      .setScale(sprite.scaleX, sprite.scaleY)
      .setFlip(sprite.flipX, sprite.flipY)
      .setRotation(sprite.rotation)
      .setTint(sprite.evolution?.color ?? 0x00f3ff).setAlpha(0.38).setDepth(8)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.trackTween(ghost, { x: ghost.x - 75, alpha: 0, duration: 240, ease: 'Quad.Out' });
  }

  floatText(x, y, text, color = '#00f3ff') {
    const label = this.scene.add.text(x, y, text, {
      fontFamily: 'Rajdhani, sans-serif', fontSize: '25px', fontStyle: 'bold',
      color, stroke: '#0d0221', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(42);
    this.trackTween(label, { y: y - 65, alpha: 0, duration: 800, ease: 'Cubic.Out' });
  }

  trackTween(target, config) {
    this.active.add(target);
    this.scene.tweens.add({
      targets: target, ...config,
      onComplete: () => { this.active.delete(target); target.destroy(); },
    });
  }

  update() {}

  destroy() {
    for (const target of this.active) {
      this.scene.tweens.killTweensOf(target);
      target.destroy();
    }
    this.active.clear();
    for (const emitter of this.emitters.values()) emitter.destroy();
    this.emitters.clear();
  }
}
