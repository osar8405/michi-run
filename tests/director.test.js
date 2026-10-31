import test from 'node:test';
import assert from 'node:assert/strict';
import { getDailyRunSeed, RunDirector } from '../src/systems/RunDirector.js';

const FRAME = 1000 / 60;

function simulate(director, seconds, withTiming = false, evolutionLevel = 1, activeBeeCount = 0) {
  const events = [];
  for (let frame = 0; frame < Math.ceil(seconds * 60); frame += 1) {
    const speed = director.speed;
    for (const event of director.update(FRAME, speed, evolutionLevel, false, activeBeeCount)) {
      events.push(withTiming ? { ...event, time: director.elapsed, speed } : event);
    }
  }
  return events;
}

test('Daily Run usa exclusivamente la fecha ISO como semilla compartida', () => {
  const date = new Date('2026-10-30T23:15:00.000Z');
  assert.equal(getDailyRunSeed(date), '2026-10-30');
  assert.deepEqual(
    simulate(new RunDirector(getDailyRunSeed(date)), 60, true),
    simulate(new RunDirector('2026-10-30'), 60, true),
  );
  assert.throws(() => getDailyRunSeed(new Date('invalid')), TypeError);
});

test('la misma semilla reproduce encuentros y reset reinicia toda la carrera', () => {
  const first = new RunDirector('neon-night-01');
  const second = new RunDirector('neon-night-01');
  const expected = simulate(first, 120, true);
  assert.deepEqual(simulate(second, 120, true), expected);
  assert.notDeepEqual(simulate(new RunDirector('neon-night-02'), 120, true), expected);

  first.reset();
  assert.equal(first.elapsed, 0);
  assert.equal(first.speed, 360);
  assert.deepEqual(first.sector, { index: 0, name: 'NEO TOKIO' });
  assert.deepEqual(simulate(first, 120, true), expected);
});

test('el calentamiento ofrece energía antes del primer enemigo', () => {
  const events = simulate(new RunDirector(17), 5, true);
  const firstDog = events.find((event) => event.type === 'dog');
  const firstOrbs = events.find((event) => event.type === 'orbs');
  assert.ok(firstDog, 'Debe aparecer el primer enemigo.');
  assert.ok(firstOrbs, 'Debe aparecer una primera ruta de energía.');
  assert.ok(firstDog.time >= 2400 && firstDog.time <= 2400 + FRAME);
  assert.ok(firstOrbs.time < firstDog.time, 'El jugador practica recogiendo energía antes del peligro.');
  assert.ok(events.filter((event) => event.type === 'dog').every((event) => event.enemyType === 'runner'));
});

test('la velocidad crece de manera monótona y respeta el máximo', () => {
  const director = new RunDirector(1);
  let previousSpeed = director.speed;
  for (let frame = 0; frame < 180 * 60; frame += 1) {
    director.update(FRAME, director.speed);
    assert.ok(director.speed >= previousSpeed, 'La dificultad no debe retroceder.');
    assert.ok(director.speed <= 760, 'La velocidad no debe superar el máximo.');
    previousSpeed = director.speed;
  }
  assert.equal(director.speed, 760);
});

test('los sectores avanzan cada treinta segundos sin reiniciar la dificultad', () => {
  const director = new RunDirector(1);
  for (const expected of [
    { index: 1, name: 'NEON EXPRESS' },
    { index: 2, name: 'SKYLINE SECTOR' },
    { index: 3, name: 'NEO TOKIO' },
  ]) {
    for (let frame = 0; frame < 300; frame += 1) director.update(100, director.speed);
    assert.deepEqual(director.sector, expected);
    assert.ok(director.speed > 360);
  }
});

test('las oleadas conservan espacio de reacción incluso a máxima dificultad', () => {
  for (const seed of [1, 4, 11, 42, 108, 512, 2026, 65535]) {
    const events = simulate(new RunDirector(seed), 300, true);
    const dogEvents = events.filter((event) => event.type === 'dog');
    assert.ok(dogEvents.some((event, index) => index > 0 && event.time === dogEvents[index - 1].time),
      'La muestra debe incluir al menos una oleada doble.');

    // Normalize each extra offscreen offset into seconds at its spawn speed.
    const arrivals = dogEvents.map((event) => event.time + (event.offset / event.speed) * 1000)
      .sort((left, right) => left - right);
    for (let index = 1; index < arrivals.length; index += 1) {
      assert.ok(arrivals[index] - arrivals[index - 1] >= 795,
        `La semilla ${seed} no dejó 0.8 segundos entre amenazas.`);
    }
  }
});

test('los eventos mantienen un contrato válido y desbloquean enemigos gradualmente', () => {
  const events = simulate(new RunDirector(42), 180, true);
  const enemyTypes = new Set();
  const patterns = new Set();
  const balconyPatterns = new Set();
  const powerups = new Set();
  for (const event of events) {
    assert.ok(Number.isFinite(event.offset) && event.offset >= 0);
    switch (event.type) {
      case 'dog':
        assert.ok(['runner', 'hound', 'drone'].includes(event.enemyType));
        if (event.enemyType === 'hound') assert.ok(event.time >= 12000);
        if (event.enemyType === 'drone') assert.ok(event.time >= 24000);
        enemyTypes.add(event.enemyType);
        break;
      case 'orbs':
        assert.ok(['arc', 'line', 'high'].includes(event.pattern));
        patterns.add(event.pattern);
        break;
      case 'powerup':
        assert.ok(['shield', 'magnet'].includes(event.powerupType));
        powerups.add(event.powerupType);
        break;
      case 'balconies':
        assert.ok(['staircase', 'switchback', 'skyline', 'high-rise', 'penthouse'].includes(event.pattern));
        assert.ok(event.platforms.length >= 6);
        assert.equal(event.platforms[0].floor, 1);
        assert.ok([3, 4, 5].includes(event.platforms.at(-1).floor));
        event.platforms.forEach((platform, index) => {
          assert.ok([1, 2, 3, 4, 5].includes(platform.floor));
          assert.ok(platform.width >= 500 && platform.width <= 640);
          assert.ok(['cyan', 'magenta'].includes(platform.color));
          assert.equal(platform.neonChicken, platform.floor >= 4
            && index === event.platforms.length - 1);
          if (index > 0) {
            const previous = event.platforms[index - 1];
            const edgeGap = platform.offset - previous.offset
              - (previous.width + platform.width) / 2;
            assert.ok(platform.offset > previous.offset);
            if (platform.floor === previous.floor) {
              assert.ok(edgeGap >= 34.5 && edgeGap <= 65.5,
                'La ruta superior debe conservar huecos pequeños y saltables.');
            } else {
              assert.ok(edgeGap >= -105.5 && edgeGap <= -74.5,
                'Los escalones verticales deben solaparse para seguir siendo alcanzables.');
            }
            assert.ok(Math.abs(platform.floor - previous.floor) <= 1,
              'Los pisos consecutivos deben ser alcanzables.');
          }
        });
        assert.ok(event.skyShards.length > 7,
          'La ruta superior debe superar la densidad de siete fragmentos del suelo.');
        for (const shard of event.skyShards) {
          assert.ok(shard.floor >= 3 && shard.floor <= 5);
          assert.ok(event.platforms.some((platform) => platform.floor === shard.floor
            && shard.offset >= platform.offset - platform.width / 2
            && shard.offset <= platform.offset + platform.width / 2));
        }
        balconyPatterns.add(event.pattern);
        break;
      default:
        assert.fail(`Evento desconocido: ${event.type}`);
    }
  }
  assert.deepEqual([...enemyTypes].sort(), ['drone', 'hound', 'runner']);
  assert.deepEqual([...patterns].sort(), ['arc', 'high', 'line']);
  assert.deepEqual([...powerups].sort(), ['magnet', 'shield']);
  assert.ok(balconyPatterns.size >= 2);
});

test('un frame inválido o una pestaña recuperada no descarga una cola de enemigos', () => {
  const director = new RunDirector(42);
  for (const invalid of [NaN, Infinity, -10, 0]) {
    assert.deepEqual(director.update(invalid, 360), []);
    assert.equal(director.elapsed, 0);
  }
  assert.deepEqual(director.update(60000, 360), []);
  assert.equal(director.elapsed, 100, 'Los saltos de reloj deben limitarse a un frame recuperable.');
  const events = simulate(director, 3, true);
  assert.equal(events.filter((event) => event.type === 'dog').length, 1);
});

test('el Cyber-Catcher aparece una vez por cada estancia en niveles 4–5', () => {
  const director = new RunDirector(42);
  assert.deepEqual(director.update(FRAME, director.speed, 3, false)
    .filter((event) => event.type === 'cyber-catcher'), []);

  assert.deepEqual(director.update(FRAME, director.speed, 4, false)
    .filter((event) => event.type === 'cyber-catcher'), [
    { type: 'cyber-catcher', offset: 0 },
  ]);
  assert.deepEqual(director.update(FRAME, director.speed, 5, false)
    .filter((event) => event.type === 'cyber-catcher'), []);
  assert.deepEqual(director.update(FRAME, director.speed, 5, true)
    .filter((event) => event.type === 'cyber-catcher'), []);

  director.update(FRAME, director.speed, 1, false);
  assert.equal(director.catcherSummoned, false);
  assert.equal(director.update(FRAME, director.speed, 4, false)
    .filter((event) => event.type === 'cyber-catcher').length, 1);
});

test('el Cyber-Swarm se desbloquea en nivel 4 y acelera con fuerza en nivel 5', () => {
  const locked = simulate(new RunDirector(42), 20, true, 3)
    .filter((event) => event.type === 'neon-bee');
  const level4 = simulate(new RunDirector(42), 20, true, 4)
    .filter((event) => event.type === 'neon-bee');
  const level5 = simulate(new RunDirector(42), 20, true, 5)
    .filter((event) => event.type === 'neon-bee');

  assert.equal(locked.length, 0);
  assert.ok(level4.length >= 7, 'El nivel 4 debe sostener presión de enjambre.');
  assert.ok(level5.length >= level4.length * 2, 'El nivel 5 debe al menos duplicar la frecuencia.');
  for (const event of [...level4, ...level5]) {
    assert.ok(['top', 'right'].includes(event.edge));
    assert.ok(event.position >= 0.12 && event.position <= 0.88);
    assert.ok(Number.isFinite(event.offset) && event.offset >= 0);
  }

  const capped = new RunDirector(42);
  assert.equal(simulate(capped, 5, false, 4, 6)
    .filter((event) => event.type === 'neon-bee').length, 0);
  assert.ok(capped.nextBee <= 0, 'El siguiente enjambre queda listo mientras el límite está lleno.');
  assert.equal(capped.update(FRAME, capped.speed, 4, true, 5)
    .filter((event) => event.type === 'neon-bee').length, 1);
});

test('los Neon Balconies forman Sky Routes largas con huecos, fragmentos y azoteas', () => {
  const events = simulate(new RunDirector(84), 45, true)
    .filter((event) => event.type === 'balconies');
  assert.ok(events.length >= 3);
  assert.ok(events[0].time >= 5200 && events[0].time <= 5200 + FRAME);
  assert.ok(events.some((event) => event.platforms.at(-1).floor >= 4));
  for (const event of events) {
    assert.equal(event.platforms[0].floor, 1);
    const chickenPlatforms = event.platforms.filter((platform) => platform.neonChicken);
    if (event.platforms.at(-1).floor >= 4) {
      assert.equal(chickenPlatforms.length, 1);
      assert.equal(chickenPlatforms[0], event.platforms.at(-1));
      assert.ok(chickenPlatforms[0].width >= 500);
    } else {
      assert.equal(chickenPlatforms.length, 0);
    }
    const routeLength = event.platforms.at(-1).offset + event.platforms.at(-1).width / 2
      - (event.platforms[0].offset - event.platforms[0].width / 2);
    assert.ok(routeLength > 3000, 'La Sky Route debe sentirse como un piso superior continuo.');
    assert.ok(event.skyShards.length > 7);
    for (let index = 1; index < event.platforms.length; index += 1) {
      const previous = event.platforms[index - 1];
      const current = event.platforms[index];
      const edgeGap = current.offset - previous.offset - (previous.width + current.width) / 2;
      if (current.floor === previous.floor) assert.ok(edgeGap >= 34.5 && edgeGap <= 65.5);
      else assert.ok(edgeGap < 0);
      assert.ok(Math.abs(current.floor - previous.floor) <= 1);
    }
  }
});
