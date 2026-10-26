/** Costs are per stage; powers are cumulative, except the Apex roar replaces claws. */
export const EVOLUTIONS = Object.freeze([
  Object.freeze({ name: 'Cyber-Michi', color: 0x00f3ff, scale: 1, shards: 12, power: 'DOBLE SALTO · GARRAS' }),
  Object.freeze({ name: 'Neon Bobcat', color: 0xff00ff, scale: 1.2, shards: 20, power: 'ESTELA LETAL' }),
  Object.freeze({ name: 'Laser Leopard', color: 0xffe66d, scale: 1.4, shards: 30, power: 'GARRAS + LÁSER' }),
  Object.freeze({ name: 'Plasma Tiger', color: 0xff8a24, scale: 1.7, shards: 42, power: 'ARMADURA DE PLASMA' }),
  Object.freeze({ name: 'Mecha-Solar Lion', color: 0xffffff, scale: 2, shards: 0, power: 'RUGIDO SOLAR' }),
]);

export const EVOLUTION_RULES = Object.freeze({
  immunity: 2000,
  trailLifetime: 900,
  trailInterval: 35,
  projectileSpeed: 1050,
  projectileLifetime: 1400,
  roarCooldown: 1800,
  roarDuration: 180,
  hitStopDuration: 240,
  hitStopScale: 0.12,
});
