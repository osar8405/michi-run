export const GAME = Object.freeze({
  width: 1440,
  height: 810,
  groundY: 638,
  gravity: 1900,
  baseSpeed: 360,
  maxSpeed: 760,
});

export const FRENZY_PHYSICS = Object.freeze({
  animationRateMultiplier: 1.65,
  jumpVelocityMultiplier: 1.22,
  dashSpeedMultiplier: 1.4,
  dashDurationMultiplier: 1.2,
  dashCooldownMultiplier: 0.55,
});

export const MOBILITY = Object.freeze({
  flightStaminaMax: 100,
  flightDrainPerSecond: 25,
  flightRechargePerSecond: 36,
  flightLiftSpeed: 225,
  flightAcceleration: 920,
  climbSpeed: 285,
  climbReach: 46,
});

export const PREDATOR_WOLF = Object.freeze({
  unlockEvolutionLevel: 4,
  lethalRange: 155,
  lethalDuration: 5000,
  chaseSpeed: 265,
  distanceSpeedBonus: 90,
});

export const COLORS = Object.freeze({
  bg: 0x0d0221,
  cyan: 0x00f3ff,
  magenta: 0xff00ff,
  yellow: 0xffe66d,
  white: 0xf3f5ff,
});
