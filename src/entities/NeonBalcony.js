import Phaser from 'phaser';

const TEXTURE_WIDTH = 320;
const TEXTURE_HEIGHT = 38;
const COLORS = Object.freeze({
  cyan: 0x00f3ff,
  magenta: 0xff00ff,
});

function createTexture(scene, colorName) {
  const key = `neon-balcony-${colorName}`;
  if (scene.textures.exists(key)) return key;

  const color = COLORS[colorName];
  const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
  graphics.fillStyle(color, 0.08).fillRect(0, 0, TEXTURE_WIDTH, 14);
  graphics.fillStyle(0x05091c, 0.94).fillRect(4, 7, TEXTURE_WIDTH - 8, 29);
  graphics.fillStyle(color, 0.12).fillRect(5, 9, TEXTURE_WIDTH - 10, 25);
  graphics.lineStyle(8, color, 0.14).lineBetween(2, 6, TEXTURE_WIDTH - 2, 6);
  graphics.lineStyle(3, color, 1).lineBetween(2, 6, TEXTURE_WIDTH - 2, 6);
  graphics.lineStyle(1, 0xffffff, 0.85).lineBetween(5, 4, TEXTURE_WIDTH - 5, 4);
  graphics.lineStyle(1, color, 0.3);
  for (let x = 20; x < TEXTURE_WIDTH; x += 42) {
    graphics.lineBetween(x, 12, x - 10, 31);
  }
  graphics.fillStyle(color, 0.65);
  for (let x = 12; x < TEXTURE_WIDTH; x += 64) graphics.fillRect(x, 32, 28, 2);
  graphics.generateTexture(key, TEXTURE_WIDTH, TEXTURE_HEIGHT);
  graphics.destroy();
  return key;
}

export class NeonBalcony extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, top, width, colorName = 'cyan') {
    const normalizedColor = COLORS[colorName] ? colorName : 'cyan';
    const texture = createTexture(scene, normalizedColor);
    super(scene, x, top + TEXTURE_HEIGHT / 2, texture);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.colorName = normalizedColor;
    this.platformWidth = width;
    this.setDisplaySize(width, TEXTURE_HEIGHT).setDepth(23);
    this.glow = scene.add.image(this.x, this.y, texture)
      .setDisplaySize(width, TEXTURE_HEIGHT)
      .setAlpha(0.32)
      .setDepth(22)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.configureBody();
    this.body.updateFromGameObject();

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  configureBody() {
    this.body.setSize(TEXTURE_WIDTH, 12);
    this.body.setOffset(0, 4);
    this.body.setAllowGravity(false).setImmovable(true).setMaxVelocity(900, 0);
    this.body.checkCollision.up = true;
    this.body.checkCollision.down = false;
    this.body.checkCollision.left = false;
    this.body.checkCollision.right = false;
    return this;
  }

  updateRun(time, worldSpeed) {
    if (!this.active || !this.body) return;
    this.setVelocityX(-worldSpeed);
    this.glow.setAlpha(0.26 + Math.sin(time * 0.006 + this.x * 0.002) * 0.08);
    if (this.body.right < -90) this.retire();
  }

  syncGlow() {
    if (this.active) this.glow?.setPosition(this.x, this.y);
  }

  retire() {
    if (!this.active) return;
    const group = this.scene?.balconyGroup;
    if (group?.children && group.contains(this)) group.remove(this, false, false);
    this.destroy();
  }

  destroy(fromScene) {
    if (!this.scene) return;
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.glow?.destroy();
    this.glow = null;
    super.destroy(fromScene);
  }
}
