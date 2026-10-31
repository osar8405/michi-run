const SECTORS = ['NEO TOKIO', 'NEON EXPRESS', 'SKYLINE SECTOR'];
const BALCONY_PATTERNS = Object.freeze([
  Object.freeze({ name: 'staircase', floors: Object.freeze([1, 2, 3, 3, 3, 3]), highRise: false }),
  Object.freeze({ name: 'switchback', floors: Object.freeze([1, 2, 2, 3, 3, 3, 3]), highRise: false }),
  Object.freeze({ name: 'skyline', floors: Object.freeze([1, 2, 3, 3, 3, 3, 3]), highRise: false }),
  Object.freeze({ name: 'high-rise', floors: Object.freeze([1, 2, 3, 4, 4, 4, 4]), highRise: true }),
  Object.freeze({ name: 'penthouse', floors: Object.freeze([1, 2, 3, 4, 5, 5, 5, 5]), highRise: true }),
]);

function normalizeSeed(seed) {
  if (typeof seed === 'number') return seed >>> 0;
  let value = 2166136261;
  for (const character of String(seed)) {
    value = Math.imul(value ^ character.charCodeAt(0), 16777619);
  }
  return value >>> 0;
}

export function getDailyRunSeed(date = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError('Daily Run seed requires a valid Date.');
  }
  return date.toISOString().split('T')[0];
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
    this.nextBee = null;
    this.nextBalconies = 5200;
    this.beeLevel = 0;
    this.waveCount = 0;
    this.catcherSummoned = false;
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

  update(delta, worldSpeed = this.speed, evolutionLevel = 1, catcherActive = false, activeBeeCount = 0) {
    if (!Number.isFinite(delta) || delta <= 0) return [];
    // A recovered browser tab must not dump a backlog of encounters on the player.
    const step = Math.min(delta, 100);
    this.runElapsed += step;
    this.nextDog -= step;
    this.nextOrbs -= step;
    this.nextPowerup -= step;
    this.nextBalconies -= step;
    const events = [];
    const seconds = this.runElapsed / 1000;

    if (evolutionLevel < 4) {
      this.catcherSummoned = false;
    } else if (catcherActive) {
      this.catcherSummoned = true;
    } else if (!this.catcherSummoned) {
      events.push({ type: 'cyber-catcher', offset: 0 });
      this.catcherSummoned = true;
    }

    if (evolutionLevel < 4) {
      this.nextBee = null;
      this.beeLevel = 0;
    } else {
      const level = evolutionLevel >= 5 ? 5 : 4;
      if (this.nextBee === null) {
        this.nextBee = level === 5 ? 420 : 900;
      } else if (level > this.beeLevel && Number.isFinite(this.nextBee)) {
        this.nextBee = Math.min(this.nextBee, 420);
      }
      this.beeLevel = level;
      this.nextBee -= step;

      const swarmLimit = level === 5 ? 10 : 6;
      if (this.nextBee <= 0 && Math.max(0, Number(activeBeeCount) || 0) < swarmLimit) {
        events.push({
          type: 'neon-bee',
          edge: this.random() < 0.38 ? 'top' : 'right',
          position: 0.12 + this.random() * 0.76,
          offset: Math.round(this.random() * 90),
        });
        this.nextBee = level === 5
          ? 620 + this.random() * 380
          : 1800 + this.random() * 700;
      }
    }

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

    if (this.nextBalconies <= 0) {
      const pattern = BALCONY_PATTERNS[Math.floor(this.random() * BALCONY_PATTERNS.length)];
      const alternateColor = this.random() < 0.5;
      const platforms = [];
      const skyShards = [];
      let routeOffset = 0;
      let previousWidth = 0;
      let previousFloor = 0;
      pattern.floors.forEach((floor, index) => {
        const width = Math.round(500 + this.random() * 140);
        if (index > 0) {
          const gap = floor === previousFloor
            ? Math.round(35 + this.random() * 30)
            : Math.round(-105 + this.random() * 30);
          routeOffset += (previousWidth + width) / 2 + gap;
        }
        const platform = {
          offset: Math.round(routeOffset),
          floor,
          width,
          color: (index + Number(alternateColor)) % 2 === 0 ? 'cyan' : 'magenta',
          neonChicken: pattern.highRise && index === pattern.floors.length - 1,
        };
        platforms.push(platform);
        if (floor >= 3) {
          const left = platform.offset - platform.width / 2 + 65;
          const right = platform.offset + platform.width / 2 - 65;
          for (let shardOffset = left; shardOffset <= right; shardOffset += 92) {
            skyShards.push({ offset: Math.round(shardOffset), floor });
          }
        }
        previousWidth = width;
        previousFloor = floor;
      });
      events.push({
        type: 'balconies',
        pattern: pattern.name,
        offset: 120,
        platforms,
        skyShards,
      });
      this.nextBalconies = Math.max(7600, 11200 - seconds * 9) + this.random() * 2200;
    }

    return events;
  }
}
