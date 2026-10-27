import Phaser from 'phaser';
import { COLORS, GAME } from '../config/game.js';
import { EVOLUTIONS, EVOLUTION_RULES } from '../config/evolution.js';

const PLAYER = Object.freeze({
  width: 104,
  height: 84,
  jumpVelocity: -690,
  doubleJumpVelocity: -625,
  coyoteTime: 105,
  jumpBuffer: 135,
  glideGravity: 0.13,
  glideFallSpeed: 138,
  attackDuration: 220,
  attackCooldown: 340,
  dashDuration: 175,
  dashCooldown: 1450,
  dashSpeed: 830,
});

/** Physics, action windows and player-owned effects stay together in this entity. */
export class Kitten extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'kitten');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setDisplaySize(PLAYER.width, PLAYER.height).setDepth(30);
    this.body.setSize(this.width * 0.48, this.height * 0.66);
    this.body.setOffset(this.width * 0.27, this.height * 0.24);
    this.body.setMaxVelocity(1000, 1100);
    this.setCollideWorldBounds(true);

    this.anchorX = x;
    this.currentEvolutionLevel = 1;
    this.evolutionCharge = 0;
    this.isDead = false;
    this.invincibleUntil = 0;
    this.isAttacking = false;
    this.isDashing = false;
    this.isGliding = false;
    this.stopped = false;
    this.jumpsUsed = 0;
    this.lastGroundedAt = -Infinity;
    this.jumpBufferedUntil = -Infinity;
    this.attackEndsAt = 0;
    this.attackReadyAt = 0;
    this.dashEndsAt = 0;
    this.dashReadyAt = 0;
    this.hurtUntil = 0;
    this.wasGrounded = false;
    this.lastTrailAt = 0;
    this.lastWingParticleAt = 0;
    this.lastUpdateTime = 0;
    this.lastDamageTrailAt = -Infinity;
    this.lastManeParticleAt = 0;
    this.attackLevel = 1;
    this.body.updateFromGameObject();
    this.setTint(this.evolution.color);

    this.projectiles = scene.physics.add.group({ allowGravity: false, immovable: true });
    this.dashTrails = scene.physics.add.group({ allowGravity: false, immovable: true });
    this.evolutionAura = scene.add.graphics().setDepth(31).setBlendMode(Phaser.BlendModes.ADD);

    this.attackHitbox = scene.add.zone(x, y, 114, 82);
    scene.physics.add.existing(this.attackHitbox);
    this.attackHitbox.body.setAllowGravity(false).setImmovable(true);
    this.attackHitbox.body.moves = true;
    this.attackHitbox.body.enable = false;
    this.attackHitbox.owner = this;

    this.wings = scene.add.graphics().setDepth(29).setBlendMode(Phaser.BlendModes.ADD);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  get jumpsRemaining() {
    return Math.max(0, 2 - this.jumpsUsed);
  }

  get evolution() { return EVOLUTIONS[this.currentEvolutionLevel - 1]; }
  get health() { return this.isDead ? 0 : this.currentEvolutionLevel; }
  get hasPassiveArmor() { return this.currentEvolutionLevel >= 4; }

  addEvolutionCharge(amount) {
    if (this.stopped || this.isDead || !Number.isFinite(amount) || amount <= 0) return;
    this.evolutionCharge += amount;
    while (this.evolution.shards > 0 && this.evolutionCharge >= this.evolution.shards) {
      const remaining = this.evolutionCharge - this.evolution.shards;
      this.levelUp();
      this.evolutionCharge = remaining;
    }
    if (this.currentEvolutionLevel === EVOLUTIONS.length) this.evolutionCharge = 0;
  }

  levelUp() {
    if (this.stopped || this.isDead || this.currentEvolutionLevel >= EVOLUTIONS.length) return false;
    this.currentEvolutionLevel += 1;
    this.evolutionCharge = 0;
    this.applyEvolution();
    this.scene.effects?.burst(this.x, this.y, this.evolution.color, 64, 360);
    this.scene.effects?.burst(this.x, this.y, 0xffffff, 28, 260);
    this.scene.events.emit('evolution-changed', this.currentEvolutionLevel, true);
    return true;
  }

  applyEvolution() {
    // Bodies use source pixels: Sprite scale is applied by Arcade exactly once.
    // Preserve the physical feet even when called inside a collision, before POST_UPDATE.
    const bottom = this.body.bottom;
    const centerX = this.body.x + this.body.width / 2;
    this.setTexture(this.currentEvolutionLevel === 5 ? 'kitten-solar' : 'kitten');
    this.setDisplaySize(PLAYER.width * this.evolution.scale, PLAYER.height * this.evolution.scale);
    this.body.updateBounds();
    this.body.position.set(
      Phaser.Math.Clamp(centerX - this.body.width / 2, 0, GAME.width - this.body.width),
      bottom - this.body.height,
    );
    this.body.updateCenter();
    this.setPosition(
      this.body.x - (this.body.offset.x - this.displayOriginX) * this.scaleX,
      this.body.y - (this.body.offset.y - this.displayOriginY) * this.scaleY,
    );
    // The transform above already includes this step's movement; don't integrate it twice.
    this.body.prev.copy(this.body.position);
    this.body.prevFrame.copy(this.body.position);
    this.body.autoFrame.copy(this.body.position);
    this.setTint(this.evolution.color);
    this.wings.setScale(this.evolution.scale);
    this.updateAttackHitbox();
  }

  get dashCooldownProgress() {
    const now = this.scene?.playTime ?? this.lastUpdateTime;
    return Phaser.Math.Clamp(1 - (this.dashReadyAt - now) / PLAYER.dashCooldown, 0, 1);
  }

  get isInvincible() {
    return this.isDashing || (this.scene?.playTime ?? this.lastUpdateTime) < this.invincibleUntil;
  }

  update(time, delta, input) {
    if (!this.active || !this.body || this.stopped) return;
    this.lastUpdateTime = time;

    const grounded = (this.body.blocked.down || this.body.touching.down) && this.body.velocity.y >= 0;
    if (grounded) {
      this.lastGroundedAt = time;
      this.jumpsUsed = 0;
      if (!this.wasGrounded && time > 160) {
        this.scene.effects?.burst(this.x, this.body.bottom, this.evolution.color, 8, 100);
        this.scene.audio?.play('land');
        this.scene.events.emit('player-action', 'land');
      }
    } else if (this.jumpsUsed === 0 && time - this.lastGroundedAt > PLAYER.coyoteTime) {
      this.jumpsUsed = 1;
    }

    if (input.pressed('jump')) this.jumpBufferedUntil = time + PLAYER.jumpBuffer;
    if (input.pressed('attack')) this.attack(time);
    if (input.pressed('dash')) this.dash(time);

    if (this.isAttacking && time >= this.attackEndsAt) this.endAttack();
    if (this.isDashing && time >= this.dashEndsAt) {
      this.isDashing = false;
      this.body.setAllowGravity(true);
      this.setVelocityX(0);
    }

    if (!this.isDashing) {
      if (this.jumpBufferedUntil >= time && this.jumpsUsed < 2) this.jump(time);

      const wasGliding = this.isGliding;
      this.isGliding = !grounded && this.body.velocity.y > 0 && input.held('jump');
      // Arcade adds body gravity to world gravity; counteract the world, don't replace it.
      this.body.setGravityY(this.isGliding ? GAME.gravity * (PLAYER.glideGravity - 1) : 0);
      if (this.isGliding) {
        this.setVelocityY(Math.min(this.body.velocity.y, PLAYER.glideFallSpeed));
        if (!wasGliding) this.scene.events.emit('player-action', 'glide');
      }

      if (time >= this.hurtUntil) {
        const targetX = this.anchorX + (input.direction ?? 0) * 80;
        this.setVelocityX(Phaser.Math.Clamp((targetX - this.x) * 7.5, -380, 380));
      }
    } else {
      this.isGliding = false;
      this.setVelocity(PLAYER.dashSpeed, 0);
      if (time - this.lastTrailAt >= 24) {
        this.scene.effects?.afterimage(this);
        this.lastTrailAt = time;
      }
      if (this.currentEvolutionLevel >= 2 && time - this.lastDamageTrailAt >= EVOLUTION_RULES.trailInterval) {
        this.leaveDamageTrail(time);
        this.lastDamageTrailAt = time;
      }
    }

    this.updateWeapons(time);
    this.updateAttackHitbox();
    this.drawWings(time);
    this.updateAppearance(time, delta, grounded);
    this.wasGrounded = grounded;
  }

  jump(time) {
    const isDoubleJump = this.jumpsUsed > 0;
    this.jumpsUsed += 1;
    this.jumpBufferedUntil = -Infinity;
    this.lastGroundedAt = -Infinity;
    this.isGliding = false;
    this.body.setGravityY(0);
    this.setVelocityY(isDoubleJump ? PLAYER.doubleJumpVelocity : PLAYER.jumpVelocity);
    this.scene.effects?.burst(this.x - 6, this.body.bottom, this.evolution.color, isDoubleJump ? 20 : 11, 160);
    this.scene.audio?.play('jump');
    this.scene.events.emit('player-action', isDoubleJump ? 'double-jump' : 'jump');
  }

  attack(time = this.scene?.playTime ?? this.lastUpdateTime) {
    if (this.stopped || time < this.attackReadyAt) return false;
    this.attackLevel = this.currentEvolutionLevel;
    const roar = this.attackLevel === 5;
    this.isAttacking = true;
    this.attackEndsAt = time + (roar ? EVOLUTION_RULES.roarDuration : PLAYER.attackDuration);
    this.attackReadyAt = time + (roar ? EVOLUTION_RULES.roarCooldown : PLAYER.attackCooldown);
    this.attackHitbox.body.enable = true;
    this.updateAttackHitbox();
    if (roar) {
      this.scene.effects?.roar(this.x, this.y);
      this.scene.cameras.main.shake(240, 0.009);
      this.scene.cameras.main.flash(120, 255, 230, 109, false);
    } else {
      this.scene.effects?.slash(this.x + 53 * this.evolution.scale, this.y - 6, this.evolution.color, this.evolution.scale);
      if (this.attackLevel >= 3) this.fireProjectile(time);
    }
    this.scene.audio?.play('attack');
    this.scene.events.emit('player-action', 'attack');
    return true;
  }

  dash(time = this.scene?.playTime ?? this.lastUpdateTime) {
    if (this.stopped || time < this.dashReadyAt) return false;
    this.isDashing = true;
    this.isGliding = false;
    this.dashEndsAt = time + PLAYER.dashDuration;
    this.dashReadyAt = time + PLAYER.dashCooldown;
    this.body.setAllowGravity(false).setGravityY(0);
    this.setVelocity(PLAYER.dashSpeed, 0);
    this.lastDamageTrailAt = -Infinity;
    this.scene.effects?.burst(this.x - 34, this.y + 8, this.evolution.color, 22, 250);
    this.scene.audio?.play('dash');
    this.scene.events.emit('player-action', 'dash');
    return true;
  }

  takeDamage(time = this.scene?.playTime ?? this.lastUpdateTime) {
    if (this.stopped || this.isDead || this.isDashing || time < this.invincibleUntil) return false;
    const previousColor = this.beginHit();
    if (this.currentEvolutionLevel === 1) this.isDead = true;
    else {
      this.currentEvolutionLevel -= 1;
      this.applyEvolution();
    }
    this.finishHit(time, previousColor, 'hurt');
    return true;
  }

  takeEmpNetHit(time = this.scene?.playTime ?? this.lastUpdateTime) {
    if (this.stopped || this.isDead || this.isDashing) return false;
    const previousColor = this.beginHit();
    if (this.currentEvolutionLevel === 1) this.isDead = true;
    else {
      this.currentEvolutionLevel = 1;
      this.applyEvolution();
    }
    this.finishHit(time, previousColor, 'emp-hit');
    return true;
  }

  beginHit() {
    const previousColor = this.evolution.color;
    this.endAttack();
    this.clearWeapons();
    this.evolutionCharge = 0;
    return previousColor;
  }

  finishHit(time, previousColor, action) {
    this.invincibleUntil = time + EVOLUTION_RULES.immunity;
    this.hurtUntil = time + 190;
    this.isGliding = false;
    this.body.setGravityY(0);
    this.setVelocity(-180, -250);
    this.scene.effects?.shatter(this.x, this.y, previousColor);
    this.scene.events.emit('evolution-changed', this.currentEvolutionLevel, false);
    this.scene.events.emit('player-action', action);
  }

  updateAttackHitbox() {
    if (!this.attackHitbox?.body || !this.isAttacking) return;
    // Anchor to the collider; visual transforms synchronize in POST_UPDATE.
    const roar = this.attackLevel === 5;
    const width = roar ? GAME.width : 114 * this.evolution.scale;
    const height = roar ? GAME.height : 82 * this.evolution.scale;
    const x = roar ? GAME.width / 2 : this.body.center.x + 65 * this.evolution.scale;
    const y = roar ? GAME.height / 2 : this.body.center.y - 2;
    this.attackHitbox.setSize(width, height);
    this.attackHitbox.body.setSize(width, height, true);
    this.attackHitbox.setPosition(x, y);
    // Integrate with the player through the next physics step, then reanchor here.
    this.attackHitbox.body.reset(x, y);
    this.attackHitbox.body.setVelocity(roar ? 0 : this.body.velocity.x, roar ? 0 : this.body.velocity.y);
  }

  fireProjectile(time) {
    const shot = this.projectiles.create(this.body.right + 28, this.body.center.y, 'spark');
    shot.setDisplaySize(64, 22).setTint(this.evolution.color).setDepth(33).setBlendMode(Phaser.BlendModes.ADD);
    shot.body.setSize(shot.width * 0.8, shot.height * 0.7, true);
    shot.body.updateFromGameObject();
    shot.setVelocityX(EVOLUTION_RULES.projectileSpeed);
    shot.expiresAt = time + EVOLUTION_RULES.projectileLifetime;
  }

  leaveDamageTrail(time) {
    const trail = this.dashTrails.create(this.body.left - 22, this.body.center.y, 'spark');
    trail.setDisplaySize(94, this.body.height * 0.85).setTint(this.evolution.color)
      .setAlpha(0.75).setDepth(27).setBlendMode(Phaser.BlendModes.ADD);
    trail.body.setSize(trail.width * 0.85, trail.height * 0.9, true);
    trail.body.updateFromGameObject();
    trail.expiresAt = time + EVOLUTION_RULES.trailLifetime;
    this.scene.effects?.burst(trail.x, trail.y, this.evolution.color, 3, 65);
  }

  updateWeapons(time) {
    for (const shot of this.projectiles.getChildren().slice()) {
      if (time >= shot.expiresAt || shot.x > GAME.width + 100) shot.destroy();
    }
    for (const trail of this.dashTrails.getChildren().slice()) {
      if (time >= trail.expiresAt || trail.x < -100) { trail.destroy(); continue; }
      trail.setVelocityX(-this.scene.worldSpeed);
      trail.setAlpha(0.75 * (trail.expiresAt - time) / EVOLUTION_RULES.trailLifetime);
    }
  }

  clearWeapons() {
    this.projectiles?.clear(true, true);
    this.dashTrails?.clear(true, true);
  }

  endAttack() {
    this.isAttacking = false;
    if (this.attackHitbox?.body) this.attackHitbox.body.enable = false;
  }

  drawWings(time) {
    this.wings.clear();
    if (!this.isGliding) return;
    this.wings.setPosition(this.x, this.y + 4);
    const lift = Math.sin(time * 0.012) * 6;
    for (const side of [-1, 1]) {
      const points = [
        new Phaser.Geom.Point(side * 9, 2),
        new Phaser.Geom.Point(side * 36, -31 - lift),
        new Phaser.Geom.Point(side * 90, -44 - lift),
        new Phaser.Geom.Point(side * 64, -4),
        new Phaser.Geom.Point(side * 43, 12),
        new Phaser.Geom.Point(side * 9, 2),
      ];
      this.wings.fillStyle(this.evolution.color, 0.055).fillPoints(points, true);
      this.wings.lineStyle(12, COLORS.magenta, 0.1).strokePoints(points, false);
      this.wings.lineStyle(5, this.evolution.color, 0.23).strokePoints(points, false);
      this.wings.lineStyle(1.5, this.evolution.color, 0.95).strokePoints(points, false);
      this.wings.lineBetween(side * 17, -1, side * 76, -35 - lift);
      this.wings.lineBetween(side * 17, -1, side * 58, -8);
    }
    if (time - this.lastWingParticleAt >= 65) {
      this.scene.effects?.burst(this.x - 60 * this.evolution.scale, this.y - 14, this.evolution.color, 2, 38);
      this.scene.effects?.burst(this.x + 60 * this.evolution.scale, this.y - 14, this.evolution.color, 2, 38);
      this.lastWingParticleAt = time;
    }
  }

  updateAppearance(time, delta, grounded) {
    const frame = Math.floor(time / 72) % 4;
    const baseTexture = this.currentEvolutionLevel === 5 ? 'kitten-solar' : 'kitten';
    const texture = grounded && !this.isDashing ? `${baseTexture}-run-${frame}` : baseTexture;
    if (this.texture.key !== texture && this.scene.textures.exists(texture)) this.setTexture(texture);
    const targetAngle = this.isDashing ? -0.12 : this.isGliding ? -0.08 : grounded ? Math.sin(time * 0.024) * 0.025 : Phaser.Math.Clamp(this.body.velocity.y / 6500, -0.09, 0.09);
    this.rotation = Phaser.Math.Linear(this.rotation, targetAngle, Math.min(1, delta / 75));
    this.setAlpha(time < this.invincibleUntil && !this.isDashing ? (Math.floor(time / 65) % 2 ? 0.42 : 1) : 1);
    this.setTint(this.evolution.color);
    this.drawEvolutionAura(time);
  }

  drawEvolutionAura(time) {
    const aura = this.evolutionAura;
    const scale = this.evolution.scale;
    const color = this.evolution.color;
    aura.clear().setPosition(this.x, this.y).setRotation(this.rotation).setScale(scale).setAlpha(this.alpha);
    // Silhouette accents distinguish each form without loading additional artwork.
    if (this.currentEvolutionLevel >= 2) {
      aura.lineStyle(2, color, 0.9);
      aura.lineBetween(20, -25, 17, -44);
      aura.lineBetween(36, -26, 40, -45);
    }
    if (this.currentEvolutionLevel === 3) {
      aura.fillStyle(color, 0.75);
      for (const [x, y] of [[-18, -10], [-5, -14], [7, -7], [-12, 2]]) aura.fillCircle(x, y, 2.2);
    }
    if (this.currentEvolutionLevel === 4) {
      aura.lineStyle(3, color, 0.85);
      for (let x = -25; x <= 5; x += 10) aura.lineBetween(x, -17, x + 6, 3);
    }
    if (this.currentEvolutionLevel === 5) {
      const pulse = Math.sin(time * 0.009) * 2;
      aura.lineStyle(7, COLORS.yellow, 0.16).strokeCircle(29, -10, 25 + pulse);
      aura.lineStyle(1.5, 0xffffff, 0.9).strokeCircle(29, -10, 22 + pulse);
      for (let i = 0; i < 14; i++) {
        const angle = i / 14 * Math.PI * 2 + time * 0.0005;
        aura.lineStyle(2, COLORS.yellow, 0.85);
        aura.lineBetween(29 + Math.cos(angle) * 22, -10 + Math.sin(angle) * 22,
          29 + Math.cos(angle) * (33 + pulse), -10 + Math.sin(angle) * (33 + pulse));
      }
      if (time - this.lastManeParticleAt > 55) {
        const angle = time * 0.013;
        this.scene.effects?.burst(this.x + (29 + Math.cos(angle) * 28) * scale,
          this.y + (-10 + Math.sin(angle) * 28) * scale, COLORS.yellow, 3, 65);
        this.lastManeParticleAt = time;
      }
    }
  }

  stop() {
    this.stopped = true;
    this.isDashing = false;
    this.isGliding = false;
    this.endAttack();
    this.wings?.clear();
    this.evolutionAura?.clear();
    this.clearWeapons();
    this.body?.setVelocity(0, 0);
    if (this.body) this.body.enable = false;
    this.setAlpha(1);
  }

  destroy(fromScene) {
    if (!this.scene) return;
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.attackHitbox?.destroy();
    this.wings?.destroy();
    this.evolutionAura?.destroy();
    this.clearWeapons();
    this.projectiles?.destroy();
    this.dashTrails?.destroy();
    this.attackHitbox = null;
    this.wings = null;
    super.destroy(fromScene);
  }
}
