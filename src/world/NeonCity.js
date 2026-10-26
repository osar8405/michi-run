import Phaser from 'phaser';

const WIDTH = 1440;
const HEIGHT = 810;
const GROUND_Y = 638;

function seededRandom(initialSeed) {
  let seed = initialSeed;
  return () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
}

/** Parallax city, rain and wet perspective road; no network or per-frame textures. */
export class NeonCity {
  constructor(scene) {
    this.scene = scene;
    this.objects = [];
    this.scroll = 0;
    this.rainPhase = 0;
    this.gridPhase = 0;
    this.layers = [];
    this.createEnvironmentTextures();
    const add = object => { this.objects.push(object); return object; };
    const hasArt = scene.textures.exists('city-art');

    add(scene.add.image(WIDTH / 2, HEIGHT / 2, 'city-gradient').setDepth(-100));
    if (hasArt) {
      this.art = add(scene.add.image(WIDTH / 2, 360, 'city-art').setDisplaySize(WIDTH + 70, 820).setDepth(-96).setAlpha(0.89));
      add(scene.add.rectangle(WIDTH / 2, 360, WIDTH, 810, 0x0d0221, 0.18).setDepth(-95));
    }

    this.stars = add(scene.add.image(WIDTH / 2, 280, 'city-stars').setDepth(-93).setAlpha(hasArt ? 0.3 : 0.9));
    this.moonHalo = add(scene.add.image(1010, 263, 'glow').setDisplaySize(620, 620)
      .setTint(0xff288c).setAlpha(hasArt ? 0.16 : 0.25).setBlendMode(Phaser.BlendModes.ADD).setDepth(-92));
    this.moon = add(scene.add.image(1010, 262, 'city-moon').setDisplaySize(265, 265).setDepth(-91).setAlpha(hasArt ? 0 : 0.95));

    this.mountains = add(scene.add.tileSprite(0, 405, WIDTH, 260, 'city-mountains').setOrigin(0, 0).setDepth(-85).setAlpha(hasArt ? 0.32 : 0.9));
    this.createLayer('city-far', 478, -80, 0.035, hasArt ? 0.36 : 0.9);
    this.createLayer('city-mid', 565, -70, 0.095, hasArt ? 0.58 : 1);
    this.createLayer('city-near', 611, -50, 0.19, 0.92);

    // Light haze separates city silhouettes without blurring their neon edges.
    add(scene.add.image(980, 527, 'glow').setDisplaySize(1300, 190).setTint(0x8422ff).setAlpha(0.17).setBlendMode(Phaser.BlendModes.ADD).setDepth(-48));
    add(scene.add.image(1000, 623, 'glow').setDisplaySize(1500, 95).setTint(0x00f3ff).setAlpha(0.2).setBlendMode(Phaser.BlendModes.ADD).setDepth(-45));

    // The low viaduct adds a believable running surface above the reflective grid.
    const viaduct = add(scene.add.graphics().setDepth(-22));
    viaduct.fillStyle(0x101426, 1).fillRect(0, 609, WIDTH, 29);
    viaduct.fillStyle(0x141d32, 1).fillRect(0, 612, WIDTH, 6);
    viaduct.lineStyle(1, 0x2a4c6b, 0.8).lineBetween(0, 611, WIDTH, 611);
    for (let x = 30; x < WIDTH; x += 100) {
      viaduct.lineStyle(1, 0x344568, 0.65).lineBetween(x, 613, x - 13, 630);
      viaduct.fillStyle(0x0b0e20).fillRect(x, 620, 46, 3);
    }
    this.road = add(scene.add.tileSprite(0, GROUND_Y, WIDTH, HEIGHT - GROUND_Y, 'road').setOrigin(0, 0).setDepth(-20));
    this.reflections = add(scene.add.image(WIDTH / 2, 724, 'city-reflections').setDepth(-18).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.65));
    this.grid = add(scene.add.graphics().setDepth(-16));
    const rail = add(scene.add.graphics().setDepth(-12).setBlendMode(Phaser.BlendModes.ADD));
    rail.lineStyle(14, 0x00f3ff, 0.035).lineBetween(0, GROUND_Y, WIDTH, GROUND_Y);
    rail.lineStyle(7, 0x00f3ff, 0.1).lineBetween(0, GROUND_Y, WIDTH, GROUND_Y);
    rail.lineStyle(2, 0x00f3ff, 0.86).lineBetween(0, GROUND_Y, WIDTH, GROUND_Y);
    rail.lineStyle(1, 0xa8ffff, 0.9).lineBetween(0, GROUND_Y - 1, WIDTH, GROUND_Y - 1);

    this.roadLights = add(scene.add.tileSprite(0, GROUND_Y + 9, WIDTH, 12, 'city-road-lights').setOrigin(0, 0).setDepth(-10).setBlendMode(Phaser.BlendModes.ADD));
    this.rain = add(scene.add.graphics().setDepth(30));
    this.rainDrops = Array.from({ length: 64 }, () => {
      const random = Math.random;
      return { x: random() * (WIDTH + 200), y: random() * HEIGHT, length: 10 + random() * 29, speed: 0.6 + random() * 0.7, alpha: 0.035 + random() * 0.12 };
    });

    add(scene.add.tileSprite(0, 0, WIDTH, HEIGHT, 'city-scanlines').setOrigin(0, 0).setDepth(89).setAlpha(0.2));
    add(scene.add.image(WIDTH / 2, HEIGHT / 2, 'city-vignette').setDepth(90).setAlpha(0.68));
    this.update(0, 0, 300);
  }

  createLayer(key, baseline, depth, factor, alpha) {
    const layer = this.scene.add.tileSprite(0, baseline, WIDTH, 440, key).setOrigin(0, 1).setDepth(depth).setAlpha(alpha);
    this.objects.push(layer);
    this.layers.push({ sprite: layer, factor });
  }

  createEnvironmentTextures() {
    const textures = this.scene.textures;
    const make = (key, width, height, painter) => {
      if (textures.exists(key)) return;
      const texture = textures.createCanvas(key, width, height);
      painter(texture.context, width, height);
      texture.refresh();
    };

    make('city-gradient', WIDTH, HEIGHT, (ctx, width, height) => {
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#07091b');
      gradient.addColorStop(0.4, '#180b33');
      gradient.addColorStop(0.72, '#3c174e');
      gradient.addColorStop(1, '#08091d');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
      const haze = ctx.createRadialGradient(1020, 320, 0, 1020, 320, 600);
      haze.addColorStop(0, 'rgba(255,0,128,.13)'); haze.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = haze; ctx.fillRect(0, 0, width, height);
    });

    make('city-stars', WIDTH, 560, (ctx, width, height) => {
      const random = seededRandom(781);
      for (let index = 0; index < 95; index++) {
        const x = random() * width, y = random() * height;
        const size = random() > 0.93 ? 2 : 1;
        ctx.fillStyle = `rgba(185,220,255,${random() * 0.7 + 0.15})`;
        ctx.fillRect(x, y, size, size);
        if (size === 2) {
          ctx.fillStyle = 'rgba(93,212,255,.23)';
          ctx.fillRect(x - 3, y, 8, 1); ctx.fillRect(x, y - 3, 1, 8);
        }
      }
    });

    make('city-moon', 340, 340, ctx => {
      const gradient = ctx.createLinearGradient(0, 20, 0, 320);
      gradient.addColorStop(0, '#ffe99b'); gradient.addColorStop(0.31, '#ffbe83');
      gradient.addColorStop(0.65, '#ff5a9d'); gradient.addColorStop(1, '#ed21ba');
      ctx.fillStyle = gradient;
      ctx.beginPath(); ctx.arc(170, 170, 147, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      for (let y = 174, index = 0; y < 320; y += 13 + index * 1.5, index++) ctx.fillRect(0, y, 340, 4 + index * 1.9);
    });

    make('city-mountains', 2200, 260, (ctx, width, height) => {
      const peaks = [[-40, 240], [130, 90], [230, 149], [345, 52], [475, 148], [600, 99], [790, 210], [925, 57], [1120, 188], [1270, 81], [1480, 196], [1640, 101], [1810, 181], [2020, 67], [2240, 240]];
      ctx.beginPath(); ctx.moveTo(0, height);
      for (const [x, y] of peaks) ctx.lineTo(x, y);
      ctx.lineTo(width, height); ctx.closePath();
      ctx.fillStyle = '#160f30'; ctx.fill();
      ctx.strokeStyle = 'rgba(188,53,207,.38)'; ctx.lineWidth = 1; ctx.stroke();
      for (let index = 1; index < peaks.length - 1; index++) {
        const [x, y] = peaks[index];
        if (y > 150) continue;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 40, height); ctx.moveTo(x, y); ctx.lineTo(x - 90, height);
        ctx.strokeStyle = 'rgba(114,47,168,.24)'; ctx.stroke();
      }
    });

    const skyline = (key, seed, foreground) => make(key, 2200, 440, (ctx, width, height) => {
      const random = seededRandom(seed);
      const near = foreground === 2;
      let x = -25;
      while (x < width) {
        const buildingWidth = 35 + random() * (near ? 130 : 76);
        const buildingHeight = (near ? 90 : 75) + random() * (near ? 200 : 270);
        const y = height - buildingHeight;
        ctx.fillStyle = near ? '#0c1123' : foreground ? '#101429' : '#1b1531';
        ctx.fillRect(x, y, buildingWidth, buildingHeight);
        ctx.fillStyle = near ? '#12192d' : '#211936';
        ctx.fillRect(x + buildingWidth - 7, y, 7, buildingHeight);
        if (random() > 0.55) {
          ctx.fillRect(x + buildingWidth * 0.4, y - 19, buildingWidth * 0.3, 19);
          ctx.strokeStyle = '#483061'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x + buildingWidth * 0.55, y - 19); ctx.lineTo(x + buildingWidth * 0.55, y - 49); ctx.stroke();
          ctx.fillStyle = '#ff37a1'; ctx.fillRect(x + buildingWidth * 0.55 - 1, y - 49, 2, 2);
        }
        if (foreground && random() > 0.4) {
          const color = random() > 0.5 ? 'rgba(0,243,255,.46)' : 'rgba(255,0,209,.44)';
          ctx.strokeStyle = color; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(x + 2, height); ctx.lineTo(x + 2, y + 2); ctx.lineTo(x + buildingWidth - 1, y + 2); ctx.stroke();
        }
        const spacing = near ? 12 : 9;
        for (let wx = x + 9; wx < x + buildingWidth - 9; wx += spacing) {
          for (let wy = y + 13; wy < height - 8; wy += 15) {
            if (random() > 0.5) continue;
            ctx.fillStyle = random() > 0.7 ? `rgba(255,158,109,${random() * 0.4 + 0.15})` : `rgba(67,189,224,${random() * 0.25 + 0.08})`;
            ctx.fillRect(wx, wy, near ? 5 : 3, near ? 6 : 4);
          }
        }
        if (foreground && buildingWidth > 80 && random() > 0.33) {
          const signX = x + 10, signY = y + 27;
          const signWidth = buildingWidth - 22;
          const color = random() > 0.5 ? '#ff35bc' : '#00f3ff';
          ctx.fillStyle = '#171329'; ctx.fillRect(signX, signY, signWidth, 32);
          ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.strokeRect(signX, signY, signWidth, 32);
          ctx.shadowColor = color; ctx.shadowBlur = 7;
          ctx.fillStyle = color; ctx.font = `bold ${signWidth > 94 ? 17 : 14}px monospace`; ctx.textAlign = 'center';
          const signs = ['NEKO', '夜遊び', '夢', 'CAT//', '東京', '24H'];
          ctx.fillText(signs[Math.floor(random() * signs.length)], signX + signWidth / 2, signY + 22);
          ctx.shadowBlur = 0;
          if (near && random() > 0.5) {
            ctx.fillStyle = color; ctx.globalAlpha = 0.16;
            ctx.fillRect(signX + 4, signY + 35, signWidth - 8, buildingHeight - 68);
            ctx.globalAlpha = 1;
          }
        }
        x += buildingWidth + 9 + random() * 24;
      }
    });
    skyline('city-far', 322, 0);
    skyline('city-mid', 872, 1);
    skyline('city-near', 991, 2);

    make('city-reflections', WIDTH, 172, (ctx, width, height) => {
      const random = seededRandom(821);
      for (let index = 0; index < 28; index++) {
        const x = random() * width;
        const w = 8 + random() * 78;
        const isCyan = random() > 0.5;
        for (let y = 0; y < height; y += 3 + random() * 7) {
          const spread = 1 + y / height * 2;
          const alpha = (1 - y / height) * (random() * 0.1 + 0.045);
          ctx.fillStyle = isCyan ? `rgba(0,243,255,${alpha})` : `rgba(255,0,204,${alpha})`;
          ctx.fillRect(x - w * spread / 2 + random() * 20, y, w * spread, 1 + random() * 2);
        }
      }
    });

    make('city-road-lights', 280, 12, ctx => {
      ctx.fillStyle = 'rgba(255,0,255,.12)'; ctx.fillRect(5, 1, 105, 8);
      ctx.fillStyle = '#ff32da'; ctx.fillRect(5, 3, 105, 2);
      ctx.fillStyle = '#ffb6ed'; ctx.fillRect(5, 3, 105, 1);
      ctx.fillStyle = 'rgba(0,243,255,.15)'; ctx.fillRect(160, 1, 29, 8);
      ctx.fillStyle = '#00f3ff'; ctx.fillRect(160, 3, 29, 2);
    });

    make('city-scanlines', 4, 4, ctx => {
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 0, 4, 1);
    });

    make('city-vignette', WIDTH, HEIGHT, (ctx, width, height) => {
      const gradient = ctx.createRadialGradient(width / 2, height / 2, 170, width / 2, height / 2, 830);
      gradient.addColorStop(0, 'rgba(3,0,15,0)'); gradient.addColorStop(0.5, 'rgba(3,0,15,.03)');
      gradient.addColorStop(1, 'rgba(3,0,15,.88)');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
      const top = ctx.createLinearGradient(0, 0, 0, 220);
      top.addColorStop(0, 'rgba(4,0,18,.45)'); top.addColorStop(1, 'rgba(4,0,18,0)');
      ctx.fillStyle = top; ctx.fillRect(0, 0, width, 220);
    });
  }

  update(time, delta, speed = 300, { overdrive = false } = {}) {
    const dt = Math.min(delta, 50) / 1000;
    this.scroll += speed * dt;
    this.gridPhase = (this.gridPhase + speed * dt / 520) % 1;
    this.rainPhase += dt * (overdrive ? 760 : 450);
    this.road.tilePositionX = this.scroll;
    this.roadLights.tilePositionX = this.scroll * 1.1;
    this.reflections.x = WIDTH / 2 - Math.sin(this.scroll / 1000) * 12;
    this.mountains.tilePositionX = this.scroll * 0.017;
    for (const layer of this.layers) layer.sprite.tilePositionX = this.scroll * layer.factor;
    this.stars.alpha = 0.72 + Math.sin(time / 3100) * 0.09;
    this.moonHalo.alpha = (overdrive ? 0.3 : 0.22) + Math.sin(time / 1800) * 0.035;

    const grid = this.grid;
    grid.clear();
    const horizon = GROUND_Y + 2;
    const vanishingX = 980;
    grid.lineStyle(1, overdrive ? 0xff00ff : 0x007c92, overdrive ? 0.38 : 0.28);
    for (let index = -11; index <= 13; index++) {
      const endX = vanishingX + index * 218;
      grid.lineBetween(vanishingX + index * 9, horizon, endX, HEIGHT);
    }
    for (let index = 0; index < 12; index++) {
      const progress = (index + this.gridPhase) / 12;
      const y = horizon + progress * progress * (HEIGHT - horizon);
      grid.lineStyle(progress > 0.8 ? 1.2 : 1, index % 3 === 0 ? 0xff00cc : 0x00b7d1, 0.07 + progress * 0.2);
      grid.lineBetween(0, y, WIDTH, y);
    }
    // Elongated reflections on wet asphalt move opposite the runner.
    for (let index = 0; index < 8; index++) {
      const x = ((index * 237 - this.scroll * 0.8) % (WIDTH + 260) + WIDTH + 260) % (WIDTH + 260) - 130;
      const y = GROUND_Y + 46 + (index % 3) * 43;
      grid.lineStyle(index % 2 ? 2 : 1, index % 2 ? 0xff00c8 : 0x00f3ff, 0.12);
      grid.lineBetween(x, y, x + 45 + index * 8, y);
    }

    this.rain.clear();
    for (const drop of this.rainDrops) {
      const y = (drop.y + this.rainPhase * drop.speed) % (HEIGHT + 60) - 30;
      const x = ((drop.x - this.rainPhase * drop.speed * 0.34) % (WIDTH + 200) + WIDTH + 200) % (WIDTH + 200) - 100;
      this.rain.lineStyle(1, 0x8edaf4, drop.alpha);
      this.rain.lineBetween(x, y, x - drop.length * 0.3, y + drop.length);
    }
  }

  destroy() {
    for (const object of this.objects) object.destroy();
    this.objects.length = 0;
    this.layers.length = 0;
  }
}
