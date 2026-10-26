const SECTORS = ['NEO TOKIO', 'NEON EXPRESS', 'SKYLINE SECTOR'];

function normalizeSeed(seed) {
  if (typeof seed === 'number') return seed >>> 0;
  let value = 2166136261;
  for (const character of String(seed)) {
    value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  }
  return value >>> 0;
}

/** Deterministic encounter director. delta/elapsed use milliseconds; offsets use pixels. */
export class RunDirector {
  constructor(seed = Date.now()) {
    this.seed = normalizeSeed(seed);
    this.reset();
  }

  reset() {
    this.randomState = this.seed;
    this.runElapsed = 0;
    this.nextDog = 2400;
    this.nextOrbs = 900;
    this.nextPowerup = 11000;
    this.waveCount = 0;
  }

  random() {
    this.randomState = (this.randomState + 0x6d2b79f5) >>> 0;
    let value = this.randomState;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  get elapsed() {
    return this.runElapsed;
  }

  get speed() {
    return Math.min(760, 360 + (this.runElapsed / 1000) * 3.15);
  }

  get sector() {
    const index = Math.floor(this.runElapsed / 30000);
    return { index, name: SECTORS[index % SECTORS.length] };
  }

  update(delta, worldSpeed = this.speed) {
    if (!Number.isFinite(delta) || delta <= 0) return [];
    // A recovered browser tab must not dump a backlog of encounters on the player.
    const step = Math.min(delta, 100);
    this.runElapsed += step;
    this.nextDog -= step;
    this.nextOrbs -= step;
    this.nextPowerup -= step;
    const events = [];
    const seconds = this.runElapsed / 1000;

    if (this.nextDog <= 0) {
      this.waveCount += 1;
      const roll = this.random();
      let enemyType = 'runner';
      if (seconds >= 24 && roll > 0.8) enemyType = 'drone';
      else if (seconds >= 12 && roll > 0.57) enemyType = 'hound';

      events.push({ type: 'dog', enemyType, offset: 80 });
      const wave = seconds >= 32 && enemyType === 'runner' && this.waveCount % 4 === 0;
      const pairGap = Math.max(430, Math.max(360, worldSpeed) * 0.8);
      if (wave) {
        events.push({ type: 'dog', enemyType: 'runner', offset: 80 + pairGap });
      }

      const interval = Math.max(950, 2050 - seconds * 10);
      const breathingRoom = this.waveCount % 6 === 0 ? 450 : 0;
      this.nextDog = interval + this.random() * 330 + breathingRoom
        + (wave ? (pairGap / Math.max(360, worldSpeed)) * 1000 : 0);
    }

    if (this.nextOrbs <= 0) {
      const roll = this.random();
      const pattern = roll < 0.45 ? 'arc' : roll < 0.8 ? 'line' : 'high';
      events.push({ type: 'orbs', pattern, offset: 60 });
      this.nextOrbs = 2350 + this.random() * 1100;
    }

    if (this.nextPowerup <= 0) {
      events.push({
        type: 'powerup',
        powerupType: this.random() < 0.5 ? 'shield' : 'magnet',
        offset: 150,
      });
      this.nextPowerup = 15500 + this.random() * 5000;
    }

    return events;
  }
}
