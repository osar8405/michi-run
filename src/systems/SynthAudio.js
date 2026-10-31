const BPM = 108;
const STEP_TIME = 60 / BPM / 4;
const AUDIO_PREFERENCE = 'michi-run-muted';
const noteFrequency = (midi) => 440 * 2 ** ((midi - 69) / 12);

/** Small Web Audio sequencer: no network assets; start/unlock require a user gesture. */
export class SynthAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.music = null;
    this.effects = null;
    this.voices = new Set();
    this.timer = null;
    this.requested = false;
    this.paused = false;
    this.destroyed = false;
    this.hasGesture = false;
    this.step = 0;
    this.nextStepTime = 0;
    this.intensity = 0;
    this.muted = false;
    this.warned = false;
    try { this.muted = localStorage.getItem(AUDIO_PREFERENCE) === 'true'; } catch { /* Private browsing. */ }

    this.gestureHandler = () => {
      this.hasGesture = true;
      this.unlock();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('pointerdown', this.gestureHandler, { capture: true });
      window.addEventListener('keydown', this.gestureHandler, { capture: true });
    }
  }

  unlock() {
    if (this.destroyed) return;
    const activated = typeof navigator !== 'undefined' && navigator.userActivation?.isActive;
    if (!this.context && !this.hasGesture && !activated) return;
    try {
      if (!this.context) this.createContext();
      if (!this.context) return;
      if (this.context.state === 'suspended') {
        this.context.resume().then(() => this.beginScheduling()).catch(() => {});
      } else {
        this.beginScheduling();
      }
    } catch (error) {
      if (!this.warned) console.warn('No se pudo iniciar el audio del juego:', error);
      this.warned = true;
    }
  }

  createContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    this.context = new AudioContextClass();
    this.master = this.context.createGain();
    this.music = this.context.createGain();
    this.effects = this.context.createGain();
    const limiter = this.context.createDynamicsCompressor();
    limiter.threshold.value = -14;
    limiter.knee.value = 10;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.18;
    this.master.gain.value = this.muted ? 0 : 0.42;
    this.music.gain.value = 0.65;
    this.effects.gain.value = 0.7;
    this.music.connect(this.master);
    this.effects.connect(this.master);
    this.master.connect(limiter);
    limiter.connect(this.context.destination);
    this.limiter = limiter;

    const length = this.context.sampleRate;
    this.noiseBuffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = Math.random() * 2 - 1;
  }

  start() {
    this.requested = true;
    this.paused = false;
    this.unlock();
  }

  pause() {
    this.paused = true;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.stopVoices();
  }

  resume() {
    this.start();
  }

  toggleMute() {
    this.muted = !this.muted;
    try { localStorage.setItem(AUDIO_PREFERENCE, String(this.muted)); } catch { /* Private browsing. */ }
    this.unlock();
    if (this.context && this.master) {
      this.master.gain.cancelScheduledValues(this.context.currentTime);
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.42, this.context.currentTime, 0.025);
    }
    return this.muted;
  }

  setIntensity(overdrive) {
    this.intensity = Math.max(0, Math.min(1, Number(overdrive) || 0));
  }

  beginScheduling() {
    if (!this.context || this.context.state !== 'running' || !this.requested
      || this.paused || this.destroyed || this.timer !== null) return;
    this.nextStepTime = this.context.currentTime + 0.045;
    this.schedule();
    this.timer = setInterval(() => this.schedule(), 35);
  }

  schedule() {
    if (!this.context || this.context.state !== 'running' || this.paused) return;
    if (this.nextStepTime < this.context.currentTime - 0.2) {
      this.nextStepTime = this.context.currentTime + 0.02;
    }
    let scheduled = 0;
    while (this.nextStepTime < this.context.currentTime + 0.13 && scheduled < 4) {
      if (!this.muted) this.scheduleStep(this.step, this.nextStepTime);
      this.step = (this.step + 1) % 128;
      this.nextStepTime += STEP_TIME;
      scheduled += 1;
    }
  }

  scheduleStep(step, time) {
    const beat = step % 16;
    const chord = Math.floor(step / 16) % 4;
    const roots = [42, 38, 45, 40];
    const root = roots[chord];
    if (beat % 2 === 0) {
      const bassPattern = [0, 0, 12, 7, 0, 12, 7, 12];
      this.tone(noteFrequency(root + bassPattern[beat / 2]), time, STEP_TIME * 1.5, {
        type: 'sawtooth', gain: 0.085, lowpass: 620 + this.intensity * 700, bus: this.music,
      });
    }
    if (beat === 0) {
      for (const interval of [12, 15, 19]) {
        this.tone(noteFrequency(root + interval), time, STEP_TIME * 15, {
          type: 'triangle', gain: 0.021, attack: 0.18, release: 0.38, bus: this.music,
        });
      }
    }
    if (beat % 4 === 0) {
      this.tone(142, time, 0.2, {
        gain: 0.38, slideTo: 43, release: 0.13, bus: this.music,
      });
    }
    if (beat === 4 || beat === 12) {
      this.noise(time, 0.13, { gain: 0.11, frequency: 1700, type: 'highpass', bus: this.music });
      this.tone(177, time, 0.07, { gain: 0.07, bus: this.music });
    }
    if (beat % 2 === 0 || this.intensity > 0.5) {
      this.noise(time, beat === 14 ? 0.1 : 0.035, {
        gain: beat % 4 === 2 ? 0.033 : 0.018, frequency: 7400, type: 'highpass', bus: this.music,
      });
    }
    const melody = [24, null, 31, null, 27, null, 19, null, 24, 31, null, 34, 31, null, 27, null];
    if (melody[beat] !== null && (step >= 32 || beat % 4 === 0)) {
      this.tone(noteFrequency(root + melody[beat]), time, STEP_TIME * 1.35, {
        type: 'triangle', gain: 0.039 + this.intensity * 0.012, attack: 0.007,
        lowpass: 2800, bus: this.music,
      });
    }
  }

  tone(frequency, when, duration, options = {}) {
    if (!this.context || this.destroyed || this.voices.size > 48) return;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    const gain = options.gain ?? 0.1;
    const attack = options.attack ?? 0.004;
    const release = Math.min(options.release ?? 0.06, duration * 0.65);
    oscillator.type = options.type ?? 'sine';
    oscillator.frequency.setValueAtTime(Math.max(1, frequency), when);
    if (options.slideTo) oscillator.frequency.exponentialRampToValueAtTime(options.slideTo, when + duration * 0.8);
    envelope.gain.setValueAtTime(0.0001, when);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), when + attack);
    envelope.gain.setValueAtTime(Math.max(0.001, gain), when + Math.max(attack, duration - release));
    envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    const nodes = [oscillator, envelope];
    if (options.lowpass) {
      const filter = this.context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = options.lowpass;
      oscillator.connect(filter);
      filter.connect(envelope);
      nodes.push(filter);
    } else oscillator.connect(envelope);
    envelope.connect(options.bus ?? this.effects);
    this.trackVoice(oscillator, nodes);
    oscillator.start(when);
    oscillator.stop(when + duration + 0.02);
  }

  noise(when, duration, options = {}) {
    if (!this.context || this.destroyed || this.voices.size > 48) return;
    const source = this.context.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = this.context.createBiquadFilter();
    filter.type = options.type ?? 'bandpass';
    filter.frequency.value = options.frequency ?? 2200;
    const envelope = this.context.createGain();
    envelope.gain.setValueAtTime(options.gain ?? 0.08, when);
    envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(options.bus ?? this.effects);
    this.trackVoice(source, [source, filter, envelope]);
    source.start(when, Math.random() * 0.5);
    source.stop(when + duration + 0.01);
  }

  trackVoice(source, nodes) {
    const voice = { source, nodes };
    this.voices.add(voice);
    source.onended = () => this.releaseVoice(voice);
  }

  releaseVoice(voice) {
    if (!this.voices.delete(voice)) return;
    voice.source.onended = null;
    for (const node of voice.nodes) node.disconnect();
  }

  stopVoices() {
    for (const voice of this.voices) {
      this.releaseVoice(voice);
      try { voice.source.stop(); } catch { /* Already finished. */ }
    }
  }

  play(name) {
    if (this.muted || this.destroyed) return;
    this.unlock();
    if (!this.context || this.context.state !== 'running') return;
    const now = this.context.currentTime + 0.005;
    switch (name) {
      case 'jump':
      case 'double-jump':
      case 'doubleJump':
        this.tone(name === 'jump' ? 310 : 470, now, 0.15, { type: 'triangle', gain: 0.14, slideTo: 880 });
        break;
      case 'dash':
        this.noise(now, 0.16, { gain: 0.14, frequency: 1800 });
        this.tone(680, now, 0.18, { type: 'sawtooth', gain: 0.055, slideTo: 95, lowpass: 1900 });
        break;
      case 'attack':
      case 'slash':
        this.noise(now, 0.085, { gain: 0.12, frequency: 3700, type: 'highpass' });
        this.tone(760, now, 0.09, { gain: 0.075, slideTo: 180 });
        break;
      case 'kill':
      case 'explode':
        this.noise(now, 0.2, { gain: 0.18, frequency: 1100 });
        this.tone(145, now, 0.18, { gain: 0.2, slideTo: 48 });
        this.tone(1046, now + 0.04, 0.13, { type: 'triangle', gain: 0.07 });
        break;
      case 'pickup':
      case 'collect':
      case 'orb':
        this.tone(1174, now, 0.085, { type: 'triangle', gain: 0.055, slideTo: 1568 });
        break;
      case 'powerup':
      case 'overdrive':
      case 'start':
      case 'confirm':
        [0, 4, 7, 12].forEach((note, index) => {
          this.tone(noteFrequency(69 + note), now + index * 0.065, 0.22, { type: 'triangle', gain: 0.08 });
        });
        break;
      case 'hit':
      case 'hurt':
        this.noise(now, 0.2, { gain: 0.17, frequency: 700 });
        this.tone(230, now, 0.25, { type: 'sawtooth', gain: 0.08, slideTo: 65, lowpass: 1400 });
        break;
      case 'gameover':
        [64, 60, 57, 52].forEach((note, index) => {
          this.tone(noteFrequency(note), now + index * 0.15, 0.3, { type: 'triangle', gain: 0.1 });
        });
        break;
      case 'glide':
        this.tone(783, now, 0.22, { type: 'sine', gain: 0.035, slideTo: 1046 });
        break;
      case 'near-miss':
        this.tone(1318, now, 0.11, { type: 'triangle', gain: 0.085, slideTo: 2093 });
        this.tone(1760, now + 0.055, 0.13, { type: 'sine', gain: 0.065, slideTo: 2637 });
        break;
      default:
        this.tone(660, now, 0.065, { type: 'triangle', gain: 0.06 });
    }
  }

  destroy() {
    this.pause();
    this.destroyed = true;
    if (typeof window !== 'undefined') {
      window.removeEventListener('pointerdown', this.gestureHandler, { capture: true });
      window.removeEventListener('keydown', this.gestureHandler, { capture: true });
    }
    this.context?.close().catch(() => {});
    for (const node of [this.music, this.effects, this.master, this.limiter]) node?.disconnect();
    this.context = null;
    this.master = null;
    this.music = null;
    this.effects = null;
    this.limiter = null;
    this.noiseBuffer = null;
  }
}
