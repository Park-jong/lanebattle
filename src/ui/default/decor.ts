import Phaser from 'phaser';
import { DEFAULT_UI as U } from './tokens';

export function panel(
  scene: Phaser.Scene, x: number, y: number, w: number, h: number,
  dark = false, depth = 0,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setDepth(depth);
  g.fillStyle(0x070e19, 0.3).fillRoundedRect(x, y + 5, w, h, 12);
  g.fillStyle(dark ? U.panel : U.paper, 1).fillRoundedRect(x, y, w, h, 12);
  g.lineStyle(1, dark ? U.edge : 0xc6ad7d, 0.8).strokeRoundedRect(x, y, w, h, 12);
  g.lineStyle(1, dark ? U.gold : 0xffffff, 0.3).strokeRoundedRect(x + 4, y + 4, w - 8, h - 8, 9);
  return g;
}

/** Cached scene decoration: never rebuilt by the battle update loop. */
export function festivalNight(scene: Phaser.Scene, width = 960, ground = 540, depth = -10): void {
  const g = scene.add.graphics().setDepth(depth);
  const landscapeScale = Math.min(1, ground / 300);
  const moonY = Math.min(112, ground * 0.36 + 15);
  g.fillGradientStyle(U.night, U.night, 0x304b60, 0x304b60, 1);
  g.fillRect(0, 0, width, ground);
  g.fillStyle(U.gold, 0.035).fillCircle(width * 0.8, moonY, 115 * Math.max(0.65, landscapeScale));
  g.fillStyle(U.gold, 0.05).fillCircle(width * 0.8, moonY, 83 * Math.max(0.65, landscapeScale));
  g.fillStyle(0xffedbd, 0.85).fillCircle(width * 0.8, moonY, 35);
  g.fillStyle(0x253b50, 1).fillCircle(width * 0.8 + 15, moonY - 11, 31);
  for (let i = 0; i < Math.ceil(width / 18); i++) {
    const x = (i * 137) % width;
    const y = 24 + (i * 71) % Math.max(50, ground - 155);
    g.fillStyle(U.paper, 0.2 + (i % 3) * 0.15).fillCircle(x, y, i % 5 === 0 ? 1.5 : 0.8);
  }
  for (let i = 0; i < Math.ceil(width / 180); i++) {
    const x = i * 180;
    g.fillStyle(0x20384a, 1).fillTriangle(x - 160, ground, x + 100, ground - (190 + (i % 3) * 25) * landscapeScale, x + 350, ground);
    g.fillStyle(0x172c3b, 1).fillTriangle(x - 90, ground, x + 120, ground - 115 * landscapeScale, x + 330, ground);
  }
  for (let i = 0; i < Math.ceil(width / 105); i++) {
    const x = i * 105 + 18;
    const y = ground - (50 + (i % 3) * 12) * landscapeScale;
    g.fillStyle(0x122330, 1).fillRect(x, y, 76, ground - y);
    g.fillTriangle(x - 9, y + 2, x + 38, y - 27 * landscapeScale, x + 85, y + 2);
    g.fillStyle(U.gold, 0.32).fillRoundedRect(x + 18, y + 16 * landscapeScale, 10, 15 * landscapeScale, 2);
    g.fillRoundedRect(x + 46, y + 16 * landscapeScale, 10, 15 * landscapeScale, 2);
  }
}
