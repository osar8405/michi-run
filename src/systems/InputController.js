const KEY_BINDINGS = {
  SPACE: ['jump', 'start'],
  UP: ['jump'],
  W: ['jump'],
  F: ['attack'],
  J: ['attack'],
  SHIFT: ['dash'],
  K: ['dash'],
  LEFT: ['left'],
  A: ['left'],
  RIGHT: ['right'],
  D: ['right'],
  ESC: ['pause'],
  P: ['pause'],
  R: ['restart'],
  ENTER: ['start'],
  M: ['mute'],
};

/** Frame-based input: pressed() stays true until endFrame(), held() is continuous. */
export class InputController {
  constructor(scene) {
    this.scene = scene;
    this.pressedActions = new Set();
    this.actionSources = new Map();
    this.pointerActions = new Map();
    this.listeners = [];
    this.keys = {};

    if (scene.input.keyboard) {
      const names = Object.keys(KEY_BINDINGS);
      this.keys = scene.input.keyboard.addKeys(
        Object.fromEntries(names.map((name) => [name, name])),
        true,
        false,
      );
      for (const name of names) {
        const down = () => {
          for (const action of KEY_BINDINGS[name]) this.setSource(action, name, true);
        };
        const up = () => {
          for (const action of KEY_BINDINGS[name]) this.setSource(action, name, false);
        };
        this.keys[name].on('down', down);
        this.keys[name].on('up', up);
        this.listeners.push(() => {
          this.keys[name].off('down', down);
          this.keys[name].off('up', up);
        });
      }
    }

    if (typeof document !== 'undefined') {
      document.querySelectorAll('[data-action]').forEach((button) => {
        const action = button.dataset.action;
        if (!['jump', 'glide', 'attack', 'dash'].includes(action)) return;
        const down = (event) => {
          if (button.disabled || button.getAttribute('aria-disabled') === 'true'
            || button.closest('[hidden], [aria-hidden="true"]')) return;
          event.preventDefault();
          event.stopPropagation();
          const source = `pointer-${event.pointerId}`;
          if (this.pointerActions.has(event.pointerId)) return;
          this.pointerActions.set(event.pointerId, { action, button, source });
          this.setSource(action, source, true);
          button.classList.add('is-pressed');
          try { button.setPointerCapture(event.pointerId); } catch { /* Pointer may already have ended. */ }
        };
        const lostCapture = (event) => {
          if (this.pointerActions.get(event.pointerId)?.button === button) this.releasePointer(event.pointerId);
        };
        button.addEventListener('pointerdown', down, { passive: false });
        button.addEventListener('lostpointercapture', lostCapture);
        this.listeners.push(() => {
          button.removeEventListener('pointerdown', down);
          button.removeEventListener('lostpointercapture', lostCapture);
        });
      });

      const release = (event) => this.releasePointer(event.pointerId);
      const blur = () => this.clear();
      const visibility = () => {
        if (document.hidden) this.clear();
      };
      window.addEventListener('pointerup', release);
      window.addEventListener('pointercancel', release);
      window.addEventListener('blur', blur);
      document.addEventListener('visibilitychange', visibility);
      this.listeners.push(() => {
        window.removeEventListener('pointerup', release);
        window.removeEventListener('pointercancel', release);
        window.removeEventListener('blur', blur);
        document.removeEventListener('visibilitychange', visibility);
      });
    }
  }

  setSource(action, source, down) {
    if (!this.actionSources.has(action)) this.actionSources.set(action, new Set());
    const sources = this.actionSources.get(action);
    if (down) {
      if (!sources.has(source)) this.pressedActions.add(action);
      sources.add(source);
    } else {
      sources.delete(source);
    }
  }

  releasePointer(pointerId) {
    const pointer = this.pointerActions.get(pointerId);
    if (!pointer) return;
    this.setSource(pointer.action, pointer.source, false);
    this.pointerActions.delete(pointerId);
    try {
      if (pointer.button.hasPointerCapture(pointerId)) pointer.button.releasePointerCapture(pointerId);
    } catch { /* The browser may have already released a cancelled pointer. */ }
    if (![...this.pointerActions.values()].some(({ button }) => button === pointer.button)) {
      pointer.button.classList.remove('is-pressed');
    }
  }

  pressed(action) {
    return this.pressedActions.has(action);
  }

  held(action) {
    return (this.actionSources.get(action)?.size ?? 0) > 0;
  }

  get direction() {
    return Number(this.held('right')) - Number(this.held('left'));
  }

  endFrame() {
    this.pressedActions.clear();
  }

  clear() {
    this.pressedActions.clear();
    this.actionSources.clear();
    for (const pointerId of this.pointerActions.keys()) this.releasePointer(pointerId);
    this.actionSources.clear();
  }

  destroy() {
    this.clear();
    for (const remove of this.listeners) remove();
    this.listeners.length = 0;
    for (const key of Object.values(this.keys)) this.scene.input.keyboard?.removeKey(key, true);
    this.keys = {};
  }
}
