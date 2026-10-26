import test from 'node:test';
import assert from 'node:assert/strict';
import { RunDirector } from '../src/systems/RunDirector.js';

const FRAME = 1000 / 60;

function simulate(director, seconds, withTiming = false) {
  const events = [];
  for (let frame = 0; frame < Math.ceil(seconds * 60); frame += 1) {
    const speed = director.speed;
    for (const event of director.update(FRAME, speed)) {
      events.push(withTiming ? { ...event, time: director.elapsed, speed } : event);
    }
  }
  return events;
}

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
      default:
        assert.fail(`Evento desconocido: ${event.type}`);
    }
  }
  assert.deepEqual([...enemyTypes].sort(), ['drone', 'hound', 'runner']);
  assert.deepEqual([...patterns].sort(), ['arc', 'high', 'line']);
  assert.deepEqual([...powerups].sort(), ['magnet', 'shield']);
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
