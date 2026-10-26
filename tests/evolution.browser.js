import assert from 'node:assert/strict';

/** Real Arcade collisions with deterministic manual frames, not mocked Phaser bodies. */
export async function runEvolutionChecks(page) {
  const report = await page.evaluate(() => {
    const game = window.__MICHI_GAME__;
    const scene = game.scene.getScene('GameScene');
    const player = scene.player;
    const checks = [];
    const check = (condition, label) => {
      if (!condition) throw new Error(`Evolution: ${label}`);
      checks.push(label);
    };
    const close = (actual, expected, label) => check(Math.abs(actual - expected) < 0.1, `${label}: ${actual} ≈ ${expected}`);
    const step = (frames = 1, delta = 1000 / 60) => {
      for (let i = 0; i < frames; i++) {
        scene.update(scene.time.now, delta);
        scene.physics.world.postUpdate();
      }
    };
    const clear = () => {
      scene.dogs.clear(true, true);
      for (const pickup of scene.pickups.getChildren().slice()) scene.removePickup(pickup);
      player.clearWeapons();
      player.endAttack();
      scene.overdriveActive = false;
      scene.overdriveUntil = 0;
      scene.energy = 0;
      scene.shield = false;
      scene.combo = 0;
      player.evolutionCharge = 0;
      player.invincibleUntil = 0;
    };
    const settle = () => {
      player.isDashing = false;
      player.hurtUntil = 0;
      player.body.setAllowGravity(true).setGravityY(0);
      const feet = (player.body.offset.y + player.body.sourceHeight - player.displayOriginY) * player.scaleY;
      player.setPosition(340, 638 - feet).setVelocity(0, 0);
      player.body.updateFromGameObject();
      player.body.prevFrame.copy(player.body.position);
      step(3);
    };
    const spawn = (x, y, type = 'runner') => {
      scene.spawnEncounter({ type: 'dog', enemyType: type, offset: x - 1440 });
      const dog = scene.dogs.getChildren().at(-1);
      dog.setPosition(x, y);
      dog.body.updateFromGameObject();
      dog.body.prevFrame.copy(dog.body.position);
      return dog;
    };

    game.loop.sleep();
    try {
      scene.director.nextDog = scene.director.nextOrbs = scene.director.nextPowerup = Infinity;
      scene.controls.clear();
      clear();
      settle();
      check(player.currentEvolutionLevel === 1, 'base stage starts at 1');
      const baseWidth = player.body.width;
      const baseHeight = player.body.height;
      player.evolutionCharge = 11;
      scene.createPickup(player.body.center.x, player.body.center.y, 'neon-shard');
      step();
      check(player.currentEvolutionLevel === 2 && player.evolutionCharge === 0, 'shard overlap crosses threshold exactly once');
      close(player.body.width, baseWidth * 1.2, 'Lynx collider scales once');
      close(player.body.bottom, 638, 'evolution inside overlap preserves feet');
      step(5);
      close(player.body.bottom, 638, 'no post-update floor penetration');

      player.dashReadyAt = 0;
      player.dash();
      step(13);
      check(!player.isDashing && player.dashTrails.getLength() > 0, 'trail outlives dash');
      const trail = player.dashTrails.getChildren().at(-1);
      const kills = scene.counts.kills;
      spawn(trail.x, trail.y);
      step(2);
      check(scene.counts.kills === kills + 1, 'lingering trail destroys rear enemy through overlap');
      const expiry = player.dashTrails.getChildren()[0].expiresAt;
      const pausedAt = scene.playTime;
      scene.pauseRun();
      step(10, 50);
      check(scene.playTime === pausedAt && player.dashTrails.getChildren()[0].expiresAt === expiry, 'pause freezes trail lifetime');
      scene.resumeRun();
      step(60);
      check(player.dashTrails.getLength() === 0, 'trail bodies expire');

      clear();
      player.levelUp();
      settle();
      close(player.body.width, baseWidth * 1.4, 'Leopard collider scale');
      close(player.body.height, baseHeight * 1.4, 'Leopard collider height');
      const rangedKills = scene.counts.kills;
      spawn(player.x + 440, player.y);
      player.attackReadyAt = 0;
      player.attack();
      check(player.projectiles.getLength() === 1, 'Leopard fires one projectile with claws');
      check(player.projectiles.getChildren()[0].body.allowGravity === false, 'projectile is gravity-free');
      check(player.attack() === false && player.projectiles.getLength() === 1, 'attack cooldown prevents duplicate shots');
      step(27);
      check(scene.counts.kills === rangedKills + 1 && player.projectiles.getLength() === 0, 'ranged overlap kills beyond claw reach and consumes projectile');
      player.attackReadyAt = 0;
      player.attack();
      step(100);
      check(player.projectiles.getLength() === 0, 'missed projectile expires');

      clear();
      player.levelUp();
      settle();
      close(player.body.width, baseWidth * 1.7, 'Tiger collider scale');
      spawn(player.x, 604);
      step(2);
      check(player.currentEvolutionLevel === 4 && scene.dogs.getLength() === 0, 'passive armor kills runner without attacking');
      clear();
      spawn(player.x, player.y, 'hound');
      step();
      check(player.currentEvolutionLevel === 3 && !player.isDead, 'hound contact downgrades Tiger exactly one stage');
      close(player.invincibleUntil - scene.playTime, 2000, 'two seconds of damage immunity');
      check(player.takeDamage() === false, 'repeat contact cannot consume another stage during immunity');
      check(scene.effects.emitters.get('pixels').getAliveParticleCount() > 0, 'damage emits pixel fragments');
      const beforeHitStop = scene.playTime;
      const frozenHitStop = scene.hitStopRemaining;
      scene.pauseRun();
      step(5, 50);
      check(scene.hitStopRemaining === frozenHitStop, 'pause freezes hit-stop recovery');
      scene.resumeRun();
      step(2, 50);
      close(scene.playTime - beforeHitStop, 12, 'slow motion scales gameplay clock');
      step(4, 50);
      check(scene.hitStopRemaining === 0 && scene.time.timeScale === 1 && scene.tweens.timeScale === 1, 'slow motion restores clocks after pause');
      step(120);
      check(!player.isInvincible, 'damage immunity expires');

      clear();
      // Evolve while airborne: preserve current physical position and jump velocity.
      player.jump(scene.playTime);
      step(8);
      const airborneFeet = player.body.bottom;
      const airborneVelocity = player.body.velocity.y;
      player.levelUp();
      close(player.body.bottom, airborneFeet, 'airborne evolution preserves feet');
      close(player.body.velocity.y, airborneVelocity, 'evolution preserves jump velocity');
      player.levelUp();
      check(player.levelUp() === false && player.currentEvolutionLevel === 5, 'Apex cap');
      player.addEvolutionCharge(10000);
      check(player.evolutionCharge === 0, 'Apex does not bank hidden charge');
      settle();
      close(player.body.width, baseWidth * 2, 'Apex collider doubles');
      step(10);
      check(player.evolutionAura.commandBuffer.length > 0, 'procedural Apex mane is drawn');
      clear();
      const roarKills = scene.counts.kills;
      spawn(120, 604, 'hound');
      spawn(850, 604);
      spawn(1200, 470, 'drone');
      const offscreen = spawn(1600, 604);
      player.attackReadyAt = 0;
      player.attack();
      check(player.attackHitbox.body.width === 1440 && player.attackHitbox.body.height === 810, 'roar uses full-screen Arcade hitbox');
      check(player.projectiles.getLength() === 0, 'roar replaces projectile');
      step();
      check(scene.counts.kills === roarKills + 3, 'roar clears airborne, rear, and forward enemies');
      check(offscreen.active && scene.dogs.getLength() === 1, 'roar spares offscreen enemies');
      check(player.attack() === false, 'roar cooldown');
      clear();
      scene.refreshHud();
      check(document.querySelector('#evolution-name').textContent.includes('MECHA-SOLAR LION'), 'HUD shows Apex name');
      check(document.querySelectorAll('#health svg:not(.empty)').length === 5, 'HUD shows five survival stages');
      check(document.querySelector('[data-action="attack"] span').textContent === 'RUGIDO', 'touch attack reflects roar');

      for (let level = 4; level >= 1; level--) {
        player.invincibleUntil = 0;
        player.evolutionCharge = 5;
        check(player.takeDamage(), `damage accepted at level ${level + 1}`);
        check(player.currentEvolutionLevel === level && !player.isDead, `downgrade to ${level}`);
        check(player.evolutionCharge === 0, 'downgrade clears charge');
      }
      check(!player.hasPassiveArmor, 'lower stages lose passive armor');
      settle();
      player.attackReadyAt = player.dashReadyAt = 0;
      player.attack();
      player.dash();
      step(13);
      check(player.projectiles.getLength() === 0 && player.dashTrails.getLength() === 0, 'base stage loses all evolved weapons');
      player.endAttack();
      player.invincibleUntil = 0;
      settle();
      spawn(player.x, player.y);
      step(2);
      check(scene.state === 'gameover' && player.isDead && player.health === 0, 'unprotected base contact ends run');
      check(player.currentEvolutionLevel === 1, 'level remains within 1–5 even after death');
    } finally {
      game.loop.wake();
    }
    return checks;
  });
  assert.ok(report.length >= 40);
  console.info(`Evolution: ${report.length} checks passed with real Arcade bodies.`);
  await page.locator('#state-primary').click();
  await page.waitForFunction(() => {
    const s = window.__MICHI_GAME__.scene.getScene('GameScene');
    return s.state === 'playing' && !s.player.isDead;
  });
  assert.equal(await page.evaluate(() => {
    const s = window.__MICHI_GAME__.scene.getScene('GameScene');
    return s.player.currentEvolutionLevel === 1 && s.player.projectiles.getLength() === 0
      && s.player.dashTrails.getLength() === 0 && s.hitStopRemaining === 0
      && s.events.listenerCount('evolution-changed') === 1;
  }), true, 'restart resets evolution and cleans weapon groups/listeners');
}
