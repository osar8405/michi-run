import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { InputController } from '../src/systems/InputController.js';
import { SynthAudio } from '../src/systems/SynthAudio.js';

function pointerEvent(type, pointerId) {
  const event = new Event(type, { cancelable: true });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  return event;
}

function browserFixture(t) {
  const buttons = ['jump', 'attack', 'dash'].map((action) => {
    const button = new EventTarget();
    const classes = new Set();
    const captures = new Set();
    Object.assign(button, {
      dataset: { action }, disabled: false,
      getAttribute: () => null,
      closest: () => null,
      classList: {
        add: (name) => classes.add(name),
        remove: (name) => classes.delete(name),
        contains: (name) => classes.has(name),
      },
      setPointerCapture: (id) => captures.add(id),
      hasPointerCapture: (id) => captures.has(id),
      releasePointerCapture: (id) => {
        captures.delete(id);
        button.dispatchEvent(pointerEvent('lostpointercapture', id));
      },
    });
    return button;
  });
  const windowMock = new EventTarget();
  const documentMock = new EventTarget();
  const cleanups = [];
  const globals = [];
  Object.assign(documentMock, { hidden: false, querySelectorAll: () => buttons });
  for (const [name, value] of [['window', windowMock], ['document', documentMock]]) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
    globals.push({ name, descriptor });
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  }
  t.after(() => {
    for (const cleanup of cleanups) cleanup();
    for (const { name, descriptor } of globals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  return { buttons, window: windowMock, document: documentMock, cleanup: (fn) => cleanups.push(fn) };
}

function controlsFixture(t) {
  const browser = browserFixture(t);
  const removed = [];
  const keyboard = {
    addKeys: (bindings) => Object.fromEntries(Object.keys(bindings).map((name) => [name, new EventEmitter()])),
    removeKey: (key) => removed.push(key),
  };
  const controls = new InputController({ input: { keyboard } });
  browser.cleanup(() => controls.destroy());
  return { ...browser, controls, removed };
}

test('soltar una fuente no cancela un salto sostenido con otra tecla o dedo', (t) => {
  const { controls, buttons, window } = controlsFixture(t);
  controls.keys.SPACE.emit('down');
  assert.equal(controls.pressed('jump'), true);
  assert.equal(controls.pressed('start'), true);
  controls.endFrame();
  controls.keys.SPACE.emit('down');
  assert.equal(controls.pressed('jump'), false, 'Un evento repetido no consume el doble salto.');

  controls.keys.UP.emit('down');
  buttons[0].dispatchEvent(pointerEvent('pointerdown', 7));
  controls.keys.SPACE.emit('up');
  controls.keys.UP.emit('up');
  assert.equal(controls.held('jump'), true, 'El dedo conserva el planeo después de soltar las teclas.');
  window.dispatchEvent(pointerEvent('pointerup', 7));
  assert.equal(controls.held('jump'), false);
  assert.equal(buttons[0].classList.contains('is-pressed'), false);
  assert.equal(buttons[0].hasPointerCapture(7), false);
});

test('perder captura o cancelar un dedo libera solo su acción', (t) => {
  const { controls, buttons, window } = controlsFixture(t);
  buttons[0].dispatchEvent(pointerEvent('pointerdown', 1));
  buttons[0].dispatchEvent(pointerEvent('pointerdown', 2));
  buttons[1].dispatchEvent(pointerEvent('pointerdown', 3));
  buttons[0].releasePointerCapture(1);
  assert.equal(controls.held('jump'), true);
  assert.equal(buttons[0].classList.contains('is-pressed'), true);
  buttons[0].releasePointerCapture(2);
  assert.equal(controls.held('jump'), false, 'Perder captura no deja el planeo activo.');
  assert.equal(buttons[0].classList.contains('is-pressed'), false);
  assert.equal(controls.held('attack'), true);
  window.dispatchEvent(pointerEvent('pointercancel', 3));
  assert.equal(controls.held('attack'), false);
  assert.equal(controls.pointerActions.size, 0);
});

test('ocultar la pestaña y destruir los controles libera capturas y listeners', (t) => {
  const { controls, buttons, document, window, removed } = controlsFixture(t);
  const jumpKey = controls.keys.UP;
  const keys = Object.values(controls.keys);
  jumpKey.emit('down');
  buttons[2].dispatchEvent(pointerEvent('pointerdown', 9));
  document.hidden = true;
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(controls.held('jump'), false);
  assert.equal(controls.held('dash'), false);
  assert.equal(controls.pressed('jump'), false);
  assert.equal(buttons[2].hasPointerCapture(9), false);

  jumpKey.emit('down');
  window.dispatchEvent(new Event('blur'));
  assert.equal(controls.held('jump'), false);
  controls.destroy();
  jumpKey.emit('down');
  buttons[0].dispatchEvent(pointerEvent('pointerdown', 10));
  assert.equal(controls.held('jump'), false, 'Reiniciar no conserva listeners del controlador anterior.');
  assert.deepEqual(removed, keys);
});

function voiceNode() {
  return {
    stops: 0, disconnects: 0, onended: null,
    stop() { this.stops += 1; },
    disconnect() { this.disconnects += 1; },
  };
}

test('pausar audio desconecta voces sin depender de onended en un contexto suspendido', (t) => {
  const browser = browserFixture(t);
  const audio = new SynthAudio();
  browser.cleanup(() => audio.destroy());
  const source = voiceNode();
  const envelope = voiceNode();
  audio.trackVoice(source, [source, envelope]);
  const lateEnded = source.onended;
  audio.pause();
  assert.equal(source.stops, 1);
  assert.equal(source.disconnects, 1);
  assert.equal(envelope.disconnects, 1);
  assert.equal(source.onended, null);
  assert.equal(audio.voices.size, 0);
  lateEnded();
  audio.pause();
  assert.equal(source.disconnects, 1, 'La limpieza es idempotente ante eventos de audio tardíos.');
});

test('destruir audio cierra el contexto y desconecta sus buses', async (t) => {
  const { window } = browserFixture(t);
  const audio = new SynthAudio();
  let closes = 0;
  audio.context = { close: async () => { closes += 1; } };
  const nodes = Array.from({ length: 4 }, voiceNode);
  [audio.music, audio.effects, audio.master, audio.limiter] = nodes;
  audio.destroy();
  audio.destroy();
  window.dispatchEvent(new Event('pointerdown'));
  await Promise.resolve();
  assert.equal(closes, 1);
  assert.ok(nodes.every((node) => node.disconnects === 1));
  assert.equal(audio.hasGesture, false, 'El contexto destruido deja de escuchar gestos.');
  assert.equal(audio.context, null);
  assert.equal(audio.master, null);
});
