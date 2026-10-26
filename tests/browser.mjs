import { chromium, devices } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { runEvolutionChecks } from './evolution.browser.js';

const production = process.argv.includes('--production');
const baseURL = process.env.MICHI_TEST_URL || (production ? 'http://localhost:4173' : 'http://localhost:5173');
await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.MICHI_CHROME_PATH || (existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome') ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined),
  args: ['--enable-unsafe-swiftshader'],
});
const errors = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await context.newPage();
page.on('pageerror', (error) => { errors.push(error.message); console.error('Browser runtime:', error.message); });
const read = (fn) => page.evaluate(fn);
const sceneReady = () => page.waitForFunction(() => window.__MICHI_GAME__?.scene.getScene('GameScene')?.state === 'menu');
if (production) {
  page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  try {
    await page.goto(baseURL);
    await page.locator('#arcade-frame[data-mode="menu"]').waitFor();
    assert.equal(await page.locator('.hero-cat').evaluate((img) => img.complete && img.naturalWidth > 0), true, 'production illustration loads');
    assert.equal(await page.evaluate(() => typeof window.__MICHI_GAME__), 'undefined', 'debug hook excluded from production');
    await page.locator('[data-ui="start"]').click();
    await page.waitForFunction(() => document.querySelector('#score').textContent !== '000000');
    await page.keyboard.press('Escape');
    await page.locator('#arcade-frame[data-mode="paused"]').waitFor();
    await page.locator('#state-primary').click();
    await page.locator('#arcade-frame[data-mode="playing"]').waitFor();
    await page.locator('.main-nav [data-ui="help"]').click();
    assert.equal(await page.locator('#help-dialog').evaluate((dialog) => dialog.open), true);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#help-dialog').open);
    await page.locator('#arcade-frame[data-mode="playing"]').waitFor();
    await page.screenshot({ path: 'artifacts/production.png', fullPage: true });
    assert.deepEqual(errors, [], 'production has no missing assets or runtime errors');
    console.info('Production smoke passed: assets, score, keyboard pause, resume, help, and debug hook exclusion.');
  } finally { await browser.close(); }
} else {
try {
  await page.goto(baseURL);
  await sceneReady();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'artifacts/menu-desktop.png', fullPage: true });
  await page.locator('[data-ui="start"]').click();
  await read(() => {
    const s = window.__MICHI_GAME__.scene.getScene('GameScene');
    s.director.nextDog = s.director.nextOrbs = s.director.nextPowerup = Infinity;
  });
  await page.waitForFunction(() => window.__MICHI_GAME__.scene.getScene('GameScene').player.body.blocked.down);
  await page.keyboard.down('ArrowUp');
  await page.waitForFunction(() => window.__MICHI_GAME__.scene.getScene('GameScene').player.jumpsUsed === 1, null, { timeout: 10000 });
  await page.keyboard.up('ArrowUp');
  assert.equal(await read(() => window.__MICHI_GAME__.scene.getScene('GameScene').player.jumpsUsed), 1, 'first jump');
  await page.keyboard.down('ArrowUp');
  await page.waitForFunction(() => window.__MICHI_GAME__.scene.getScene('GameScene').player.isGliding);
  assert.equal(await read(() => window.__MICHI_GAME__.scene.getScene('GameScene').player.jumpsUsed), 2, 'double jump');
  assert.equal(await read(() => window.__MICHI_GAME__.scene.getScene('GameScene').player.isGliding), true, 'held jump activates glide when falling');
  await page.screenshot({ path: 'artifacts/glide.png', fullPage: true });
  await page.keyboard.up('ArrowUp');
  await page.waitForFunction(() => window.__MICHI_GAME__.scene.getScene('GameScene').player.body.blocked.down);

  await read(() => { const s = window.__MICHI_GAME__.scene.getScene('GameScene'); s.spawnEncounter({ type: 'dog', enemyType: 'runner', offset: s.player.x + 105 - 1440 }); });
  await page.keyboard.press('f');
  await page.waitForFunction(() => window.__MICHI_GAME__.scene.getScene('GameScene').counts.kills === 1);
  assert.equal(await read(() => window.__MICHI_GAME__.scene.getScene('GameScene').counts.kills), 1, 'claw overlap defeats a dog');

  const health = await read(() => window.__MICHI_GAME__.scene.getScene('GameScene').player.health);
  await read(() => { const s = window.__MICHI_GAME__.scene.getScene('GameScene'); s.spawnEncounter({ type: 'dog', enemyType: 'runner', offset: s.player.x + 110 - 1440 }); });
  await page.keyboard.press('Shift');
  await page.waitForFunction(() => window.__MICHI_GAME__.scene.getScene('GameScene').counts.kills === 2);
  assert.equal(await read(() => window.__MICHI_GAME__.scene.getScene('GameScene').counts.kills), 2, 'dash defeats an enemy');
  assert.equal(await read(() => window.__MICHI_GAME__.scene.getScene('GameScene').player.health), health, 'dash grants immunity');

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__MICHI_GAME__.scene.getScene('GameScene').state === 'paused');
  const pausedAt = await read(() => window.__MICHI_GAME__.scene.getScene('GameScene').playTime);
  await page.waitForTimeout(250);
  assert.equal(await read(() => window.__MICHI_GAME__.scene.getScene('GameScene').state), 'paused');
  assert.equal(await read(() => window.__MICHI_GAME__.scene.getScene('GameScene').playTime), pausedAt, 'pause freezes simulation time');
  await page.locator('#state-primary').click();
  await page.waitForFunction(() => window.__MICHI_GAME__.scene.getScene('GameScene').state === 'playing');
  assert.equal(await read(() => window.__MICHI_GAME__.scene.getScene('GameScene').state), 'playing');

  await read(() => { const s = window.__MICHI_GAME__.scene.getScene('GameScene'); s.createPickup(s.player.x, s.player.y, 'shield'); });
  await page.waitForFunction(() => window.__MICHI_GAME__.scene.getScene('GameScene').shield);
  assert.equal(await read(() => window.__MICHI_GAME__.scene.getScene('GameScene').shield), true, 'shield pickup');
  await read(() => { const s = window.__MICHI_GAME__.scene.getScene('GameScene'); s.createPickup(s.player.x, s.player.y, 'magnet'); });
  await page.waitForFunction(() => { const s = window.__MICHI_GAME__.scene.getScene('GameScene'); return s.magnetUntil > s.playTime; });
  assert.equal(await read(() => { const s = window.__MICHI_GAME__.scene.getScene('GameScene'); return s.magnetUntil > s.playTime; }), true, 'magnet pickup');
  await read(() => window.__MICHI_GAME__.scene.getScene('GameScene').addOverdrive(100));
  await page.waitForTimeout(150);
  assert.equal(await read(() => window.__MICHI_GAME__.scene.getScene('GameScene').overdriveActive), true, 'energy enables overdrive');
  await page.waitForFunction(() => !window.__MICHI_GAME__.scene.getScene('GameScene').cameras.main.flashEffect.isRunning);
  await page.screenshot({ path: 'artifacts/gameplay-desktop.png', fullPage: true });
  await read(() => {
    const s = window.__MICHI_GAME__.scene.getScene('GameScene');
    s.overdriveUntil = s.playTime - 1;
    s.player.invincibleUntil = 0;
    while (s.player.currentEvolutionLevel < 3) s.player.levelUp();
  });
  await page.waitForFunction(() => { const s = window.__MICHI_GAME__.scene.getScene('GameScene'); return !s.overdriveActive && !s.player.isDashing && !s.player.isAttacking; });
  await read(() => { const s = window.__MICHI_GAME__.scene.getScene('GameScene'); s.spawnEncounter({ type: 'dog', enemyType: 'runner', offset: s.player.x + 15 - 1440 }); });
  await page.waitForFunction(() => !window.__MICHI_GAME__.scene.getScene('GameScene').shield);
  assert.equal(await read(() => window.__MICHI_GAME__.scene.getScene('GameScene').player.health), 3, 'shield absorbs contact without losing health');
  for (let healthAfter = 2; healthAfter >= 0; healthAfter--) {
    await read(() => { const s = window.__MICHI_GAME__.scene.getScene('GameScene'); s.player.invincibleUntil = 0; s.spawnEncounter({ type: 'dog', enemyType: 'runner', offset: s.player.x + 15 - 1440 }); });
    await page.waitForFunction((expected) => window.__MICHI_GAME__.scene.getScene('GameScene').player.health === expected, healthAfter);
  }
  await page.waitForFunction(() => window.__MICHI_GAME__.scene.getScene('GameScene').state === 'gameover');
  assert.equal(await page.locator('#arcade-frame').getAttribute('data-mode'), 'gameover');
  await page.locator('#state-primary').click();
  await page.waitForFunction(() => { const s = window.__MICHI_GAME__.scene.getScene('GameScene'); return s.state === 'playing' && s.playTime < 1000; });
  assert.equal(await read(() => window.__MICHI_GAME__.scene.getScene('GameScene').player.health), 1, 'restart resets evolution to Cyber-Michi');
  assert.equal(await read(() => window.__MICHI_GAME__.events.listenerCount('ui-action')), 1, 'restart cleans UI subscriptions');
  await page.locator('.main-nav [data-ui="help"]').click();
  assert.equal(await page.locator('#help-dialog').evaluate((dialog) => dialog.open), true);
  assert.equal(await read(() => window.__MICHI_GAME__.scene.getScene('GameScene').state), 'paused', 'help pauses run');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#help-dialog').open);
  assert.equal(await read(() => window.__MICHI_GAME__.scene.getScene('GameScene').state), 'playing', 'closing help resumes run');

  const slowFrames = await read(() => {
    const s = window.__MICHI_GAME__.scene.getScene('GameScene');
    s.dogs.clear(true, true);
    for (const pickup of s.pickups.getChildren().slice()) s.removePickup(pickup);
    s.director.nextDog = s.director.nextOrbs = s.director.nextPowerup = Infinity;
    s.controls.clear();
    s.player.body.reset(340, 604.4);
    s.player.dashReadyAt = 0;
    s.player.dash();
    const startClock = s.playTime;
    const startX = s.player.body.x;
    let maxX = startX;
    for (let i = 0; i < 8; i++) {
      s.update(s.time.now, 250);
      s.physics.world.postUpdate();
      maxX = Math.max(maxX, s.player.body.x);
    }
    return { elapsed: s.playTime - startClock, travel: maxX - startX, dashing: s.player.isDashing, cooldown: s.player.dashCooldownProgress };
  });
  assert.ok(Math.abs(slowFrames.elapsed - 400) < 0.01, 'slow frames share bounded simulation time');
  assert.ok(slowFrames.travel > 90 && slowFrames.travel < 155, `dash distance stays bounded at low FPS (${slowFrames.travel})`);
  assert.equal(slowFrames.dashing, false, 'dash expires under slow frames');
  assert.ok(slowFrames.cooldown < 0.35, 'cooldown uses the same bounded time as movement');
  await runEvolutionChecks(page);
  await read(() => { const s = window.__MICHI_GAME__.scene.getScene('GameScene'); s.addOverdrive(100); s.scene.restart({ autoStart: false }); });
  await sceneReady();
  assert.equal(await page.locator('#arcade-frame').evaluate((frame) => frame.classList.contains('overdrive')), false, 'menu clears previous overdrive styling');
  assert.equal(await page.locator('#drive-announcement').evaluate((el) => el.classList.contains('visible')), false, 'restart clears transient announcements');

  const mobileContext = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } });
  const mobile = await mobileContext.newPage();
  mobile.on('pageerror', (error) => errors.push(error.message));
  await mobile.goto(baseURL);
  await mobile.waitForFunction(() => window.__MICHI_GAME__?.scene.getScene('GameScene')?.state === 'menu');
  await mobile.screenshot({ path: 'artifacts/menu-mobile.png', fullPage: true });
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'mobile layout fits viewport');
  assert.equal(await mobile.locator('[data-ui="start"]').evaluate((button) => { const b = button.getBoundingClientRect(); const frame = button.closest('.arcade-frame').getBoundingClientRect(); return b.bottom <= frame.bottom && b.top >= frame.top; }), true, 'mobile start button fits inside arena');
  await mobile.locator('[data-ui="start"]').tap();
  await mobile.waitForFunction(() => window.__MICHI_GAME__.scene.getScene('GameScene').player.body.blocked.down);
  assert.equal(await mobile.locator('.touch-controls').isVisible(), true, 'touch controls are visible');
  await mobile.locator('[data-action="jump"]').tap();
  await mobile.waitForFunction(() => window.__MICHI_GAME__.scene.getScene('GameScene').player.jumpsUsed === 1);
  assert.equal(await mobile.evaluate(() => window.__MICHI_GAME__.scene.getScene('GameScene').player.jumpsUsed), 1, 'touch jump');
  await mobile.screenshot({ path: 'artifacts/gameplay-mobile.png', fullPage: true });
  await mobileContext.close();
  assert.deepEqual(errors, [], 'no browser runtime errors');
  console.info('Browser checks passed: double jump, glide, claws, dash, pause, pickups, Overdrive, restart, help, low-FPS physics and mobile touch.');
} catch (error) {
  console.error(await page.evaluate(() => {
    const s = window.__MICHI_GAME__?.scene.getScene('GameScene');
    return s ? { state: s.state, playTime: s.playTime, errors: '', player: { x: s.player.x, y: s.player.y, health: s.player.health, jumps: s.player.jumpsUsed, velocity: { x: s.player.body.velocity.x, y: s.player.body.velocity.y }, blocked: s.player.body.blocked }, input: { pressed: [...s.controls.pressedActions], held: [...s.controls.actionSources.entries()].map(([k, v]) => [k, [...v]]), up: s.controls.keys.UP.isDown } } : { scene: 'unavailable' };
  }));
  await page.screenshot({ path: 'artifacts/test-failure.png', fullPage: true });
  throw error;
} finally {
  await browser.close();
}
}
