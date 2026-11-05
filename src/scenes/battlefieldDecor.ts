import Phaser from 'phaser';
import { COMBAT } from '../data/combat';
import { BATTLEFIELD, BATTLE_LAYOUT } from './layout';

/** 넓은 길의 윗면·풀 가장자리·납작한 디딤돌. 지형은 씬을 만들 때 한 번만 그린다. */
export function drawBattlefield(scene: Phaser.Scene): void {
  const g = scene.add.graphics().setDepth(1);
  const width = COMBAT.battlefieldLength;
  const { backY, frontY } = BATTLEFIELD;
  const patch = (color: number, alpha: number, points: number[][]) => {
    g.fillStyle(color, alpha).fillPoints(points.map(([x, y]) => new Phaser.Math.Vector2(x, y)), true);
  };
  g.fillGradientStyle(0x273c37, 0x273c37, 0x182d2a, 0x182d2a, 1);
  g.fillRect(0, backY - 18, width, BATTLE_LAYOUT.panel.y - backY + 18);

  // 먼 풀밭보다 밝은 길의 윗면을 앞쪽으로 넓힌다.
  g.fillGradientStyle(0x536052, 0x536052, 0x807352, 0x807352, 1);
  g.fillRect(0, backY + 8, width, frontY - backY - 8);
  g.fillStyle(0x283d32, 1).fillRect(0, backY - 3, width, 11);
  g.fillStyle(0x96a071, 0.25).fillRect(0, backY + 8, width, 2);

  for (let i = 0; i < Math.ceil(width / 95); i++) {
    const x = i * 95;
    patch(0x52644a, 1, [[x - 16, backY + 7], [x + 21, backY - 5], [x + 78, backY + 2], [x + 101, backY + 17], [x + 50, backY + 12]]);
    patch(0x23392c, 1, [[x, backY + 4], [x + 7, backY - 9], [x + 12, backY + 4], [x + 21, backY - 4], [x + 26, backY + 7]]);
  }

  // 뒤쪽의 작은 돌과 앞쪽의 큰 돌로 지면의 깊이를 드러낸다.
  for (let row = 0; row < 4; row++) {
    const scale = 0.62 + row * 0.16;
    for (let i = 0; i < Math.ceil(width / 72); i++) {
      const x = i * 72 + (row % 2) * 31 + (i * 13 % 19);
      const y = backY + 25 + row * 27 + (i * 7 % 11);
      const w = (22 + i * 7 % 21) * scale, h = (8 + i % 5) * scale;
      patch(0x263a32, 0.22, [[x - w / 2, y + 2], [x - w / 3, y - h / 2], [x + w / 3, y - h / 2 + 1], [x + w / 2, y + 2], [x + w / 4, y + h / 2], [x - w / 4, y + h / 2]]);
      g.lineStyle(1, 0xc1b98a, 0.16).lineBetween(x - w / 3, y - h / 2, x + w / 3, y - h / 2 + 1);
      if ((i + row) % 3 === 0) g.fillStyle(0xb1a37a, 0.24).fillEllipse(x + 19, y - 4, 3 * scale, 1.4 * scale);
    }
  }

  for (let i = 0; i < Math.ceil(width / 160); i++) {
    const x = i * 160 + 53;
    g.fillStyle(0xe9c477, 0.025).fillEllipse(x, backY + 35, 150, 35);
    g.fillStyle(0x24392e, 0.3).fillEllipse(x + 64, frontY - 5, 75, 12);
  }

  // 앞쪽 풀 가장자리를 HUD 위에 남기고 발밑과 간격을 둔다.
  g.fillStyle(0x172d26, 1).fillRect(0, frontY + 5, width, BATTLE_LAYOUT.panel.y - frontY - 5);
  for (let i = 0; i < Math.ceil(width / 70); i++) {
    const x = i * 70;
    patch(0x304831, 1, [[x - 12, frontY + 8], [x + 8, frontY - 2], [x + 39, frontY - 6 + i % 5], [x + 74, frontY + 3], [x + 82, frontY + 10]]);
    g.lineStyle(1.4, 0x839266, 0.45).lineBetween(x + 3, frontY + 1, x + 30, frontY - 3);
    patch(0x1d3529, 1, [[x + 40, frontY + 6], [x + 43, frontY - 7], [x + 48, frontY + 2], [x + 54, frontY - 3], [x + 58, frontY + 8]]);
  }
}
