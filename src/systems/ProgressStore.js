const STORAGE_KEY = 'michi-neon-record-v2';

export class ProgressStore {
  constructor() {
    this.best = 0;
    try {
      const saved = Number(localStorage.getItem(STORAGE_KEY));
      if (Number.isFinite(saved) && saved > 0) this.best = saved;
    } catch { /* The run still works when browser storage is unavailable. */ }
  }

  save(score) {
    this.best = Math.max(this.best, Math.floor(score));
    try { localStorage.setItem(STORAGE_KEY, String(this.best)); }
    catch { /* Retain an in-memory record for restricted browsers. */ }
    return this.best;
  }
}
