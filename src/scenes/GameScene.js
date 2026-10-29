import Phaser from 'phaser';
import { GAME, COLORS } from '../config/game.js';
import { EVOLUTION_RULES } from '../config/evolution.js';
import { Kitten } from '../entities/Kitten.js';
import { Dog } from '../entities/Dog.js';
import { HumanCatcher } from '../entities/HumanCatcher.js';
import { NeonBee, NEON_BEE_RULES } from '../entities/NeonBee.js';
import { NeonBalcony } from '../entities/NeonBalcony.js';
import { NeonCity } from '../world/NeonCity.js';
import { NeonEffects } from '../fx/NeonEffects.js';
import { InputController } from '../systems/InputController.js';
import { SynthAudio } from '../systems/SynthAudio.js';
import { RunDirector } from '../systems/RunDirector.js';
import { ProgressStore } from '../systems/ProgressStore.js';

const MISSIONS = [
  { key: 'orbs', goal: 20, text: 'Recoge 20 fragmentos de neón' },
  { key: 'kills', goal: 5, text: 'Desactiva 5 cyber-hounds' },
  { key: 'distance', goal: 1000, text: 'Recorre 1,000 metros más' },
  { key: 'dashes', goal: 8, text: 'Activa 8 neon dashes' },
];
const BALCONY_FLOOR_TOPS = Object.freeze({
  1: GAME.groundY - 132,
  2: GAME.groundY - 264,
  3: GAME.groundY - 396,
});

export class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  create(data = {}) {
    this.ui = this.registry.get('ui');
    this.progress = new ProgressStore();
    this.state = 'menu';
    this.playTime = 0;
    this.ambientTime = 0;
    this.worldSpeed = GAME.baseSpeed;
    this.score = 0;
    this.distance = 0;
    this.combo = 0;
    this.maxCombo = 1;
    this.comboUntil = 0;
    this.energy = 0;
    this.overdriveUntil = 0;
    this.overdriveActive = false;
    this.shield = false;
    this.magnetUntil = 0;
    this.counts = { orbs: 0, kills: 0, dashes: 0 };
    this.missionIndex = 0;
    this.missionBase = 0;
    this.lastSector = 0;
    this.lastHudAt = -Infinity;
    this.lastDriveTrailAt = 0;
    this.helpWasPlaying = false;
    this.hitStopRemaining = 0;
    this.swarmChargeDrain = 0;
    this.lastSwarmWarningAt = -Infinity;
    this.finalRecord = null;
    this.shareButton = null;
    this.time.timeScale = 1;
    this.tweens.timeScale = 1;
    this.tweens.resumeAll();
    this.physics.resume();
    this.city = new NeonCity(this);
    this.effects = new NeonEffects(this);
    this.audio = new SynthAudio();
    this.director = new RunDirector();
    this.controls = new InputController(this);
    this.createPhysics();
    this.bindLifecycle();
    this.ui.setMode('menu');
    this.ui.setBest(this.progress.best);
    this.ui.setMuted(this.audio.muted);
    if (data.autoStart) this.startRun();
  }

  createPhysics() {
    this.ground = this.add.zone(GAME.width / 2, GAME.groundY + 60, GAME.width * 2, 120);
    this.physics.add.existing(this.ground, true);
    this.dogs = this.physics.add.group();
    this.bees = this.physics.add.group({ allowGravity: false });
    this.balconyGroup = this.physics.add.group({ allowGravity: false, immovable: true });
    this.pickups = this.physics.add.group({ allowGravity: false, immovable: true });
    this.empNets = this.physics.add.group({ allowGravity: false, immovable: true });
    this.catcher = null;
    this.player = new Kitten(this, 340, GAME.groundY - 45);
    this.player.setVisible(false);
    this.player.body.enable = false;
    this.shadow = this.add.image(340, GAME.groundY + 2, 'glow').setDisplaySize(145, 22)
      .setTint(COLORS.cyan).setAlpha(0).setDepth(17).setBlendMode(Phaser.BlendModes.ADD);
    this.shieldRing = this.add.graphics().setDepth(32).setBlendMode(Phaser.BlendModes.ADD);
    this.physics.add.collider(this.player, this.ground);
    this.physics.add.collider(this.player, this.balconyGroup, null, this.canLandOnBalcony, this);
    this.physics.add.collider(this.dogs, this.ground);

    // Attack overlap is registered before contact damage. Both callbacks check live state.
    this.physics.add.overlap(this.player.attackHitbox, this.dogs, (_, dog) => this.defeatDog(dog),
      (_, dog) => this.state === 'playing' && this.player.isAttacking && dog.active && !dog.killed
        && (this.player.attackLevel !== 5 || (dog.body.right > 0 && dog.body.left < GAME.width)));
    this.physics.add.overlap(this.player.projectiles, this.dogs, (shot, dog) => {
      shot.destroy();
      this.defeatDog(dog);
    }, (shot, dog) => this.state === 'playing' && shot.active && dog.active && !dog.killed);
    this.physics.add.overlap(this.player.dashTrails, this.dogs, (_, dog) => this.defeatDog(dog),
      (trail, dog) => this.state === 'playing' && trail.active && dog.active && !dog.killed);
    this.physics.add.overlap(this.player, this.dogs, (_, dog) => this.onEnemyContact(dog),
      (_, dog) => this.state === 'playing' && dog.active && !dog.killed);
    this.physics.add.overlap(this.player, this.bees, (_, bee) => this.onBeeContact(bee),
      (_, bee) => this.state === 'playing' && bee.active && !bee.attached);
    this.physics.add.overlap(this.player, this.pickups, (_, pickup) => this.collectPickup(pickup),
      (_, pickup) => this.state === 'playing' && pickup.active && !pickup.collected);
    this.physics.add.overlap(this.player, this.empNets, (_, net) => this.onEmpNetCollision(net),
      (_, net) => this.state === 'playing' && net.active && !this.player.isDashing);
  }

  bindLifecycle() {
    this.onUiAction = (action) => {
      if (action === 'start' || action === 'play') {
        if (this.state === 'menu') this.startRun();
        else if (this.state === 'gameover') this.scene.restart({ autoStart: true });
        else if (this.state === 'paused') this.resumeRun();
      }
      if (action === 'restart') this.scene.restart({ autoStart: true });
      if (action === 'pause') this.pauseRun();
      if (action === 'resume') this.resumeRun();
      if (action === 'menu') this.scene.restart({ autoStart: false });
      if (action === 'mute') this.ui.setMuted(this.audio.toggleMute());
      if (action === 'share') void this.shareRecord();
      if (action === 'help') {
        this.helpWasPlaying = this.state === 'playing';
        if (this.helpWasPlaying) this.pauseRun();
        this.controls.clear();
      }
      if (action === 'close-help') {
        this.controls.clear();
        if (this.helpWasPlaying) this.resumeRun();
        this.helpWasPlaying = false;
      }
    };
    this.game.events.on('ui-action', this.onUiAction);
    this.onBlur = () => this.pauseRun();
    this.onVisibility = () => { if (document.hidden) this.pauseRun(); };
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.events.on('player-action', this.onPlayerAction, this);
    this.events.on('evolution-changed', this.onEvolutionChanged, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
  }

  startRun() {
    if (this.state !== 'menu') return;
    this.state = 'playing';
    this.player.setVisible(true);
    this.player.body.enable = true;
    const footOffset = (this.player.body.offset.y + this.player.body.sourceHeight - this.player.displayOriginY) * this.player.scaleY;
    this.player.body.reset(340, GAME.groundY - footOffset);
    this.player.body.updateFromGameObject();
    this.player.body.prevFrame.copy(this.player.body.position);
    this.player.lastGroundedAt = this.playTime;
    this.player.invincibleUntil = 900;
    this.controls.clear();
    this.ui.setMode('playing');
    this.audio.start();
    this.effects.burst(this.player.x, this.player.y, COLORS.cyan, 35, 240);
    this.ui.toast('LA NOCHE ES TUYA. CORRE.');
    this.refreshHud();
  }

  pauseRun() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.physics.pause();
    this.tweens.pauseAll();
    this.time.timeScale = 0;
    for (const emitter of this.effects.emitters.values()) emitter.timeScale = 0;
    this.audio.pause();
    this.controls.clear();
    this.ui.setMode('paused');
  }

  resumeRun() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.setSimulationRate(this.hitStopRemaining > 0 ? EVOLUTION_RULES.hitStopScale : 1);
    this.physics.resume();
    this.tweens.resumeAll();
    this.audio.resume();
    this.controls.clear();
    this.ui.setMode('playing');
  }

  update(_time, rawDelta) {
    let delta = Math.min(rawDelta, 50);
    if (this.ui.dialog.open) { this.controls.endFrame(); return; }
    if (this.controls.pressed('mute')) this.ui.setMuted(this.audio.toggleMute());
    if (this.state === 'menu') {
      this.ambientTime += delta;
      this.city.update(this.ambientTime, delta, 65);
      if (this.controls.pressed('start')) this.startRun();
      this.controls.endFrame();
      return;
    }
    if (this.state === 'paused') {
      if (this.controls.pressed('pause') || this.controls.pressed('start')) this.resumeRun();
      this.controls.endFrame();
      return;
    }
    if (this.state === 'gameover') {
      if (this.controls.pressed('restart') || this.controls.pressed('start')) this.scene.restart({ autoStart: true });
      this.controls.endFrame();
      return;
    }
    if (this.controls.pressed('pause')) {
      this.pauseRun();
      this.controls.endFrame();
      return;
    }
    if (this.hitStopRemaining > 0) {
      const slowedTime = Math.min(delta, this.hitStopRemaining);
      this.hitStopRemaining -= slowedTime;
      delta -= slowedTime * (1 - EVOLUTION_RULES.hitStopScale);
      if (this.hitStopRemaining === 0) this.setSimulationRate(1);
    }
    this.playTime += delta;
    this.ambientTime += delta;
    this.overdriveActive = this.playTime < this.overdriveUntil;
    if (this.overdriveActive) this.energy = Math.max(0, (this.overdriveUntil - this.playTime) / 8000 * 100);
    else if (this.overdriveUntil > 0) {
      this.energy = 0;
      this.overdriveUntil = 0;
      this.audio.setIntensity(false);
      this.ui.toast('OVERDRIVE COMPLETADO. SIGUE BRILLANDO.');
    }
    if (this.combo > 0 && this.playTime > this.comboUntil) this.combo = 0;
    const events = this.director.update(delta, this.worldSpeed, this.player.currentEvolutionLevel,
      Boolean(this.catcher?.active), this.bees.countActive(true));
    this.worldSpeed = this.director.speed + (this.overdriveActive ? 65 : 0);
    this.distance += this.worldSpeed * delta / 1000 / 12;
    this.score += delta / 1000 * 6 * this.multiplier;
    this.city.update(this.ambientTime, delta, this.worldSpeed, { overdrive: this.overdriveActive });
    this.player.update(this.playTime, delta, this.controls);
    this.catcher?.updatePursuit(this.playTime, delta, this.player);
    for (const dog of this.dogs.getChildren().slice()) dog.updateRun(this.playTime, delta, this.worldSpeed);
    for (const balcony of this.balconyGroup.getChildren().slice()) {
      balcony.updateRun(this.playTime, this.worldSpeed);
    }
    this.updateBeeSwarm(delta);
    for (const event of events) this.spawnEncounter(event);
    this.updatePickups(delta);
    // Physics and action timers share the same bounded step on slow devices.
    this.physics.world.update(_time, delta);
    for (const balcony of this.balconyGroup.getChildren()) balcony.syncGlow();
    if (this.state !== 'playing') { this.controls.endFrame(); return; }
    this.updatePlayerLight();
    this.updateMission();
    if (this.director.sector.index !== this.lastSector) {
      this.lastSector = this.director.sector.index;
      this.ui.toast(`SECTOR ${this.lastSector + 1} / ${this.director.sector.name}`);
      this.audio.play('powerup');
    }
    if (this.playTime - this.lastHudAt > 50) {
      this.lastHudAt = this.playTime;
      this.refreshHud();
    }
    if (this.player.y > GAME.height + 100) this.endRun();
    this.controls.endFrame();
  }

  get multiplier() { return Math.min(8, Math.max(1, this.combo)) * (this.overdriveActive ? 2 : 1); }

  canLandOnBalcony(player, balcony) {
    if (this.state !== 'playing' || !player.body || !balcony.active || !balcony.body) return false;
    const previousBottom = player.body.prev.y + player.body.height;
    return player.body.velocity.y >= 0 && previousBottom <= balcony.body.top + 12;
  }

  spawnEncounter(event) {
    if (event.type === 'dog') {
      const dog = new Dog(this, GAME.width + event.offset, event.enemyType);
      this.dogs.add(dog);
      dog.configureBody();
      dog.setVelocityX(-this.worldSpeed);
    } else if (event.type === 'orbs') {
      for (let i = 0; i < 7; i++) {
        const lift = event.pattern === 'arc' ? Math.sin(i / 6 * Math.PI) * 170 : event.pattern === 'high' ? 210 : 0;
        this.createPickup(GAME.width + event.offset + i * 65, GAME.groundY - 54 - lift, 'neon-shard');
      }
    } else if (event.type === 'powerup') {
      this.createPickup(GAME.width + event.offset, GAME.groundY - 118, event.powerupType);
    } else if (event.type === 'balconies') {
      for (const definition of event.platforms ?? []) {
        const floor = Phaser.Math.Clamp(Math.round(definition.floor ?? 1), 1, 3);
        const x = GAME.width + event.offset + Math.max(0, definition.offset ?? 0);
        const balcony = new NeonBalcony(
          this,
          x,
          BALCONY_FLOOR_TOPS[floor],
          Phaser.Math.Clamp(definition.width ?? 340, 280, 460),
          definition.color,
        );
        this.balconyGroup.add(balcony);
        balcony.configureBody();
        balcony.setVelocityX(-this.worldSpeed);
      }
    } else if (event.type === 'neon-bee') {
      const limit = this.player.currentEvolutionLevel >= 5
        ? NEON_BEE_RULES.maxActiveLevel5
        : NEON_BEE_RULES.maxActiveLevel4;
      if (this.bees.countActive(true) >= limit) return;
      const position = Phaser.Math.Clamp(event.position ?? 0.5, 0, 1);
      const offset = Math.max(0, event.offset ?? 0);
      const fromTop = event.edge === 'top';
      const x = fromTop
        ? Phaser.Math.Linear(140, GAME.width - 140, position)
        : GAME.width + 45 + offset;
      const y = fromTop
        ? -45 - offset
        : Phaser.Math.Linear(90, GAME.groundY - 90, position);
      const bee = new NeonBee(this, x, y);
      this.bees.add(bee);
      this.effects.burst(x, y, COLORS.yellow, 7, 90);
    } else if (event.type === 'cyber-catcher' && !this.catcher?.active) {
      const groundLaneY = GAME.groundY - 83;
      this.catcher = new HumanCatcher(this, -30, groundLaneY, this.empNets);
      this.effects.burst(30, groundLaneY, 0xff304f, 26, 260);
      this.ui.toast('ALERTA / CYBER-CATCHER EN PERSECUCIÓN');
    }
  }

  createPickup(x, y, kind) {
    const isShard = kind === 'neon-shard';
    const color = isShard ? this.player.evolution.color : kind === 'shield' ? COLORS.cyan : COLORS.magenta;
    const pickup = this.physics.add.image(x, y, isShard ? 'neon-shard' : 'shard');
    pickup.setDisplaySize(isShard ? 27 : 40, isShard ? 34 : 40).setDepth(24);
    this.pickups.add(pickup);
    pickup.body.setAllowGravity(false).setImmovable(true);
    pickup.body.setSize(pickup.width * 0.8, pickup.height * 0.8, true);
    pickup.kind = kind;
    pickup.collected = false;
    pickup.baseline = y;
    pickup.phase = Math.random() * Math.PI * 2;
    pickup.setTint(color);
    pickup.light = this.add.image(x, y, 'glow').setTint(color).setDisplaySize(60, 60)
      .setAlpha(isShard ? 0.35 : 0.55).setDepth(23).setBlendMode(Phaser.BlendModes.ADD);
    if (!isShard) {
      pickup.label = this.add.text(x, y - 36, kind === 'shield' ? 'ESCUDO' : 'IMÁN', {
        fontFamily: 'Rajdhani', fontSize: '13px', color: kind === 'shield' ? '#00f3ff' : '#ff6ad9', fontStyle: 'bold', letterSpacing: 3,
      }).setOrigin(0.5).setDepth(24);
    }
    return pickup;
  }

  updatePickups() {
    const magnet = this.playTime < this.magnetUntil || this.overdriveActive;
    for (const pickup of this.pickups.getChildren().slice()) {
      if (!pickup.active) continue;
      const dx = this.player.x - pickup.x;
      const dy = this.player.y - pickup.y;
      const distance = Math.hypot(dx, dy);
      if (magnet && pickup.kind === 'neon-shard' && distance < 340) {
        pickup.body.setVelocity(dx * 8, dy * 8);
        if (distance < 34) this.collectPickup(pickup);
      } else {
        pickup.body.setVelocity(-this.worldSpeed, (pickup.baseline + Math.sin(this.playTime * 0.004 + pickup.phase) * 6 - pickup.y) * 8);
      }
      if (!pickup.active) continue;
      pickup.light.setPosition(pickup.x, pickup.y);
      pickup.rotation = Math.sin(this.playTime * 0.003 + pickup.phase) * 0.15;
      pickup.label?.setPosition(pickup.x, pickup.y - 36);
      if (pickup.x < -90) this.removePickup(pickup);
    }
  }

  collectPickup(pickup) {
    if (!pickup.active || pickup.collected || this.state !== 'playing') return;
    pickup.collected = true;
    if (pickup.kind === 'neon-shard') {
      this.counts.orbs += 1;
      this.score += 25 * this.multiplier;
      this.addOverdrive(2.5);
      this.player.addEvolutionCharge(1);
      this.effects.burst(pickup.x, pickup.y, this.player.evolution.color, 5, 110);
      this.audio.play('pickup');
    } else {
      if (pickup.kind === 'shield') {
        this.shield = true;
        this.ui.toast('ESCUDO ACTIVO / UN IMPACTO GRATIS');
      } else {
        this.magnetUntil = this.playTime + 11000;
        this.ui.toast('IMÁN ACTIVO / ATRAE TODA LA ENERGÍA');
      }
      this.audio.play('powerup');
      this.effects.burst(pickup.x, pickup.y, COLORS.cyan, 28, 220);
    }
    this.removePickup(pickup);
  }

  removePickup(pickup) {
    pickup.light?.destroy();
    pickup.label?.destroy();
    pickup.destroy();
  }

  updateBeeSwarm(delta) {
    const attached = [];
    for (const bee of this.bees.getChildren().slice()) {
      if (!bee.active) continue;
      bee.updateFlight(this.playTime, delta, this.player);
      if (bee.attached) attached.push(bee);
    }
    if (attached.length === 0) {
      this.swarmChargeDrain = 0;
      return;
    }

    const energyDrain = attached.length * NEON_BEE_RULES.energyDrainPerSecond * delta / 1000;
    if (this.overdriveActive) {
      this.overdriveUntil = Math.max(this.playTime, this.overdriveUntil - energyDrain / 100 * 8000);
      this.energy = Math.max(0, (this.overdriveUntil - this.playTime) / 8000 * 100);
      if (this.overdriveUntil <= this.playTime) {
        this.overdriveActive = false;
        this.overdriveUntil = 0;
        this.energy = 0;
        this.audio.setIntensity(false);
        this.ui.toast('CYBER-SWARM DRENÓ EL OVERDRIVE.');
      }
    } else {
      this.energy = Math.max(0, this.energy - energyDrain);
    }

    if (this.player.evolution.shards > 0 && this.player.evolutionCharge > 0) {
      this.swarmChargeDrain += attached.length * NEON_BEE_RULES.evolutionDrainPerSecond * delta / 1000;
      const chargeDrain = Math.min(this.player.evolutionCharge, Math.floor(this.swarmChargeDrain));
      if (chargeDrain > 0) {
        this.player.evolutionCharge -= chargeDrain;
        this.swarmChargeDrain -= chargeDrain;
      }
    } else {
      this.swarmChargeDrain = 0;
    }
  }

  onBeeContact(bee) {
    if (!bee.active || bee.attached || this.state !== 'playing') return;
    if (this.player.isDashing) {
      bee.shakeOff();
      return;
    }

    const slot = this.bees.getChildren().filter((candidate) => candidate.attached).length;
    if (!bee.attachTo(this.player, slot, this.playTime)) return;
    this.audio.play('hit');
    this.effects.burst(this.player.x, this.player.y, 0xff304f, 18, 150);
    this.cameras.main.flash(90, 255, 35, 20, false);
    if (this.playTime - this.lastSwarmWarningAt > 1200) {
      this.lastSwarmWarningAt = this.playTime;
      this.ui.toast('CYBER-SWARM ADHERIDO / USA DASH PARA PURGARLO');
    }
  }

  shakeOffAttachedBees() {
    const attached = this.bees.getChildren().filter((bee) => bee.active && bee.attached);
    if (attached.length === 0) return;
    for (const bee of attached) bee.shakeOff();
    this.swarmChargeDrain = 0;
    this.cameras.main.shake(100, 0.004);
    this.ui.toast(`DASH PURGA / ${attached.length} ${attached.length === 1 ? 'ABEJA' : 'ABEJAS'} DESTRUIDAS`);
  }

  clearBeeSwarm() {
    if (!this.bees?.children) return;
    for (const bee of this.bees.getChildren().slice()) bee.retire();
    this.swarmChargeDrain = 0;
  }

  clearBalconies() {
    if (!this.balconyGroup?.children) return;
    for (const balcony of this.balconyGroup.getChildren().slice()) balcony.retire();
  }

  onEnemyContact(dog) {
    if (!dog.active || dog.killed || this.state !== 'playing') return;
    if (this.player.isDashing || this.overdriveActive || (this.player.hasPassiveArmor && dog.type === 'runner')
      || (this.player.isAttacking && (this.player.attackLevel === 5 || dog.x > this.player.x - 15))) {
      this.defeatDog(dog);
      return;
    }
    if (this.player.isInvincible) return;
    if (this.shield) {
      this.shield = false;
      this.player.invincibleUntil = this.playTime + 900;
      this.effects.burst(this.player.x, this.player.y, COLORS.cyan, 42, 340);
      this.defeatDog(dog);
      this.ui.toast('ESCUDO ABSORBIÓ EL IMPACTO');
      return;
    }
    if (!this.player.takeDamage(this.playTime)) return;
    this.combo = 0;
    this.audio.play('hit');
    this.cameras.main.shake(130, 0.006);
    this.cameras.main.flash(90, 255, 0, 100, false);
    dog.retire();
    this.refreshHud();
    if (this.player.isDead) this.endRun();
    else {
      this.hitStopRemaining = EVOLUTION_RULES.hitStopDuration;
      this.setSimulationRate(EVOLUTION_RULES.hitStopScale);
    }
  }

  onEmpNetCollision(net) {
    if (!net.active || this.state !== 'playing' || this.player.isDashing) return;
    net.destroy();
    if (!this.player.takeEmpNetHit(this.playTime)) return;

    this.combo = 0;
    this.audio.play('hit');
    this.cameras.main.shake(220, 0.012);
    this.cameras.main.flash(140, 255, 30, 70, false);
    this.refreshHud();
    if (this.player.isDead) {
      this.endRun();
      this.ui.setText('state-description', 'ATRAPADO POR EL CYBER-CATCHER. LA NOCHE TERMINÓ.');
      return;
    }

    this.ui.toast('IMPACTO EMP / EVOLUCIÓN REINICIADA');
    this.hitStopRemaining = EVOLUTION_RULES.hitStopDuration;
    this.setSimulationRate(EVOLUTION_RULES.hitStopScale);
  }

  despawnCatcher() {
    this.catcher?.retire();
    this.catcher = null;
    this.empNets?.clear(true, true);
  }

  defeatDog(dog) {
    if (!dog.active || dog.killed || this.state !== 'playing') return;
    this.combo += 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.comboUntil = this.playTime + 4300;
    this.counts.kills += 1;
    const points = dog.points * this.multiplier;
    this.score += points;
    this.effects.burst(dog.x, dog.y, COLORS.magenta, 38, 360);
    this.effects.burst(dog.x, dog.y, COLORS.cyan, 20, 260);
    this.effects.floatText(dog.x, dog.y - 50, `+${points}${this.combo > 1 ? `  COMBO ×${this.combo}` : ''}`, this.combo > 1 ? '#ffe66d' : '#00f3ff');
    this.cameras.main.shake(70, 0.0025);
    this.audio.play('kill');
    this.addOverdrive(12);
    this.player.addEvolutionCharge(2 + Math.min(4, Math.floor(this.combo / 3)));
    dog.retire();
  }

  setSimulationRate(rate) {
    // Arcade is stepped explicitly with scaled delta; don't also set world.timeScale.
    this.time.timeScale = rate;
    this.tweens.timeScale = rate;
    for (const emitter of this.effects.emitters.values()) emitter.timeScale = rate;
  }

  onEvolutionChanged(level, upgraded) {
    if (this.state !== 'playing') return;
    if (level < 4) {
      this.despawnCatcher();
      this.clearBeeSwarm();
    }
    if (upgraded) {
      this.audio.play('powerup');
      this.ui.toast(`EVOLUCIÓN ${level} / ${this.player.evolution.name.toUpperCase()}`);
    } else if (!this.player.isDead) {
      this.ui.toast(`${this.player.evolution.name.toUpperCase()} / 2 s DE PROTECCIÓN`);
    }
    this.refreshHud();
  }

  addOverdrive(amount) {
    if (this.overdriveActive) return;
    this.energy = Math.min(100, this.energy + amount);
    if (this.energy >= 100) {
      this.overdriveUntil = this.playTime + 8000;
      this.overdriveActive = true;
      this.ui.announceOverdrive();
      this.audio.setIntensity(true);
      this.audio.play('powerup');
      this.effects.burst(this.player.x, this.player.y, COLORS.cyan, 60, 420);
      this.cameras.main.flash(170, 0, 120, 150, false);
    }
  }

  onPlayerAction(action) {
    if (this.state !== 'playing') return;
    if (action === 'dash') {
      this.counts.dashes += 1;
      this.shakeOffAttachedBees();
    }
  }

  updatePlayerLight() {
    const height = Math.max(0, GAME.groundY - this.player.y);
    this.shadow.setPosition(this.player.x, GAME.groundY + 3).setAlpha(Math.max(0.06, 0.4 - height / 700));
    this.shadow.setTint(this.player.evolution.color);
    this.shadow.setDisplaySize((130 + height * 0.15) * this.player.evolution.scale, 17 * this.player.evolution.scale);
    this.shieldRing.clear();
    if (this.shield || this.overdriveActive) {
      this.shieldRing.setPosition(this.player.x, this.player.y).setScale(this.player.evolution.scale);
      const color = this.overdriveActive ? COLORS.magenta : COLORS.cyan;
      this.shieldRing.lineStyle(10, color, 0.05).strokeCircle(0, 0, 60);
      this.shieldRing.lineStyle(2, color, 0.65).strokeCircle(0, 0, 60);
      this.shieldRing.lineStyle(1, COLORS.white, 0.25).strokeCircle(0, 0, 64);
    }
    if (this.overdriveActive && this.playTime - this.lastDriveTrailAt > 85) {
      this.effects.afterimage(this.player);
      this.lastDriveTrailAt = this.playTime;
    }
  }

  get mission() {
    const definition = MISSIONS[this.missionIndex % MISSIONS.length];
    const total = definition.key === 'distance' ? this.distance : this.counts[definition.key];
    return { ...definition, value: Math.floor(total - this.missionBase) };
  }

  updateMission() {
    if (this.mission.value < this.mission.goal) return;
    this.score += 500;
    this.addOverdrive(20);
    this.ui.toast('MISIÓN COMPLETADA / +500 PUNTOS');
    this.audio.play('powerup');
    this.missionIndex += 1;
    const key = MISSIONS[this.missionIndex % MISSIONS.length].key;
    this.missionBase = key === 'distance' ? this.distance : this.counts[key];
  }

  refreshHud() {
    this.ui.update({
      score: this.score, distance: this.distance, sector: this.director.sector.name,
      multiplier: this.multiplier, combo: this.combo, energy: this.energy,
      overdrive: this.overdriveActive, health: this.player.health,
      evolution: this.player.evolution, evolutionLevel: this.player.currentEvolutionLevel,
      evolutionCharge: this.player.evolutionCharge,
      dashReady: this.player.dashCooldownProgress >= 1,
      dashProgress: this.player.dashCooldownProgress,
      shield: this.shield, magnet: this.playTime < this.magnetUntil, mission: this.mission,
    });
  }

  endRun() {
    if (this.state !== 'playing') return;
    this.state = 'gameover';
    this.finalRecord = {
      evolutionLevel: this.player.currentEvolutionLevel,
      score: Math.floor(this.score),
    };
    this.hitStopRemaining = 0;
    this.setSimulationRate(1);
    this.physics.pause();
    this.player.stop();
    this.clearBeeSwarm();
    this.shieldRing.clear();
    this.controls.clear();
    this.audio.pause();
    this.audio.play('gameover');
    this.effects.burst(this.player.x, this.player.y, COLORS.magenta, 55, 400);
    const previousBest = this.progress.best;
    this.ui.setMode('gameover');
    this.ui.results({ score: this.score, distance: this.distance, maxCombo: this.maxCombo });
    this.ui.setBest(this.progress.save(this.score));
    this.showShareButton();
    if (this.score > previousBest) this.ui.setText('state-description', 'NUEVO RÉCORD. ESTA NOCHE TIENE TU NOMBRE.');
  }

  showShareButton() {
    const primary = this.ui.root?.querySelector('#state-primary');
    if (!primary) {
      console.error('Unable to mount the share button: game-over panel was not found.');
      return;
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'share-record';
    button.className = 'start-button';
    button.dataset.ui = 'share';
    button.setAttribute('aria-label', 'Compartir récord');
    Object.assign(button.style, {
      margin: '14px auto 0',
      minWidth: '275px',
      background: 'var(--cyan)',
      boxShadow: '0 0 28px #00f3ff2e',
    });
    for (const text of ['//', 'SHARE RECORD', '>']) {
      const span = document.createElement('span');
      span.textContent = text;
      if (text !== 'SHARE RECORD') span.setAttribute('aria-hidden', 'true');
      button.append(span);
    }
    primary.insertAdjacentElement('afterend', button);
    this.shareButton = button;
  }

  getShareText() {
    const record = this.finalRecord ?? {
      evolutionLevel: this.player.currentEvolutionLevel,
      score: Math.floor(this.score),
    };
    return `I survived the Neon City and reached Evolution Level ${record.evolutionLevel} with a score of ${record.score} in Michi Run! Can you beat me?`;
  }

  async shareRecord() {
    if (this.state !== 'gameover') return;
    const text = this.getShareText();
    const shareData = {
      title: 'Michi Run: Neon Nights',
      text,
      url: window.location.href,
    };

    if (typeof navigator.share === 'function') {
      if (this.shareButton) this.shareButton.disabled = true;
      try {
        await navigator.share(shareData);
      } catch (error) {
        if (error?.name !== 'AbortError') {
          console.error('Native record sharing failed.', error);
          this.ui.toast('NO SE PUDO ABRIR EL MENÚ DE COMPARTIR.');
        }
      } finally {
        if (this.shareButton?.isConnected) this.shareButton.disabled = false;
      }
      return;
    }

    this.openShareFallback(text);
  }

  openShareFallback(text) {
    const intent = new URL('https://twitter.com/intent/tweet');
    intent.searchParams.set('text', text);
    intent.searchParams.set('url', window.location.href);
    let popup;
    try {
      popup = window.open(intent.toString(), '_blank', 'popup=yes,width=720,height=540');
    } catch (error) {
      console.error('Twitter/X share fallback failed.', error);
      this.ui.toast('NO SE PUDO ABRIR X. REVISA LOS PERMISOS DEL NAVEGADOR.');
      return false;
    }
    if (!popup) {
      console.error('Twitter/X share fallback was blocked by the browser.');
      this.ui.toast('PERMITE VENTANAS EMERGENTES PARA COMPARTIR TU RÉCORD.');
      return false;
    }
    popup.opener = null;
    return true;
  }

  cleanup() {
    this.game.events.off('ui-action', this.onUiAction);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.events.off('player-action', this.onPlayerAction, this);
    this.events.off('evolution-changed', this.onEvolutionChanged, this);
    this.shareButton?.remove();
    this.shareButton = null;
    this.clearBeeSwarm();
    this.catcher?.destroy();
    this.catcher = null;
    this.controls.destroy();
    this.audio.destroy();
    this.effects.destroy();
    this.city.destroy();
  }
}
