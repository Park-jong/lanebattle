import Phaser from 'phaser';
import { COMBAT } from '../data/combat';
import { BATTLEFIELD } from './layout';

/** 길 뒤의 소나무·돌담·당산 장식. 전투 실루엣보다 어둡게, 이동 구역보다 뒤에 둔다. */
export function drawBattleScenery(scene: Phaser.Scene): void {
  const g = scene.add.graphics().setDepth(2);
  const width = COMBAT.battlefieldLength;
  const foot = BATTLEFIELD.backY + 9;
  const shape = (color: number, points: number[][], alpha = 1) => {
    g.fillStyle(color, alpha).fillPoints(points.map(([x, y]) => new Phaser.Math.Vector2(x, y)), true);
  };

  // 창문만 있던 먼 마을 앞에 굽은 소나무 숲을 한 겹 더한다.
  for (let i = 0; i < Math.ceil(width / 390); i++) {
    const x = i * 390 + 80 + (i * 47 % 90);
    const height = 106 + i * 23 % 43;
    const lean = i % 2 ? -18 : 22;
    shape(0x182d2b, [[x - 10, foot], [x - 5, foot - height * 0.56],
      [x + lean, foot - height], [x + lean + 7, foot - height + 4],
      [x + 8, foot - height * 0.5], [x + 15, foot]]);
    g.lineStyle(3, 0x314136, 0.6).lineBetween(x + 1, foot - 8, x + lean + 3, foot - height + 10);
    for (let tier = 0; tier < 4; tier++) {
      const y = foot - height + 18 + tier * 24;
      const spread = 31 + tier * 13;
      const cx = x + lean * (1 - tier / 5);
      shape(tier % 2 ? 0x203b35 : 0x254137, [[cx - spread, y + 9], [cx - spread * 0.6, y - 5],
        [cx - 9, y - 11], [cx + 8, y - 15], [cx + spread * 0.6, y - 6],
        [cx + spread, y + 6], [cx + 12, y + 5], [cx - 11, y + 10]]);
      g.lineStyle(1, 0x596b4f, 0.3).lineBetween(cx - spread * 0.65, y - 3, cx - 9, y - 8);
    }
  }

  // 낮은 돌담: 끊긴 담과 덮개 기와가 길의 뒷면을 잡아 준다.
  for (let i = 0; i < Math.ceil(width / 286); i++) {
    const x = i * 286 + 16;
    const length = 154 + i * 17 % 50;
    g.fillStyle(0x162925).fillEllipse(x + length / 2, foot + 3, length + 25, 12);
    g.fillStyle(0x35463c).fillRect(x, foot - 22, length, 23);
    for (let row = 0; row < 2; row++) {
      for (let stone = 0; stone < 7; stone++) {
        const sx = x + stone * 26 + (row % 2) * 9;
        if (sx + 24 > x + length) continue;
        g.fillStyle((stone + row) % 3 ? 0x4d5a49 : 0x5d6350)
          .fillRoundedRect(sx + 1, foot - 21 + row * 11, 24, 9, 2);
        g.lineStyle(1, 0x839075, 0.28).lineBetween(sx + 4, foot - 20 + row * 11, sx + 20, foot - 20 + row * 11);
      }
    }
    shape(0x1c3331, [[x - 6, foot - 21], [x + 2, foot - 28], [x + length - 2, foot - 28], [x + length + 6, foot - 21]]);
    g.lineStyle(2, 0x5c7160, 0.6).lineBetween(x, foot - 27, x + length, foot - 27);
    for (let tile = 0; tile < length / 15; tile++) {
      g.lineStyle(1, 0x6b7d68, 0.3).lineBetween(x + tile * 15, foot - 26, x + tile * 15 - 3, foot - 22);
    }
  }

  for (let i = 0; i < Math.ceil(width / 430); i++) {
    const x = i * 430 + 222;
    const next = x + 380;
    const top = foot - 70 - i % 2 * 8;
    // 당산 금줄과 색 바랜 오방색 천. 아래로 늘어진 끈은 전투 영역에 닿지 않는다.
    g.lineStyle(2, 0x918368, 0.65).beginPath().moveTo(x, top).lineTo(x + 110, top + 13)
      .lineTo(x + 240, top + 16).lineTo(next, top + 3).strokePath();
    const cloth = [0xb39459, 0x9e6754, 0x668978, 0xbeb69a, 0x566f88];
    for (let j = 0; j < 5; j++) {
      const cx = x + 53 + j * 61;
      const cy = top + 7 + Math.sin(j / 4 * Math.PI) * 10;
      shape(cloth[(j + i) % cloth.length], [[cx, cy], [cx + 8, cy + 1], [cx + 10, cy + 17],
        [cx + 6, cy + 14], [cx + 3, cy + 20]], 0.8);
    }
    g.fillStyle(0x28382d).fillRect(x - 3, top - 8, 6, foot - top + 8);
    g.lineStyle(1, 0x8b8261, 0.65).lineBetween(x - 1, top - 5, x - 1, foot);
    // 육각 등롱과 따뜻한 빛 웅덩이.
    g.fillStyle(0xffc876, 0.025).fillCircle(x + 16, top + 27, 46);
    g.fillStyle(0xffc876, 0.05).fillCircle(x + 16, top + 27, 29);
    g.lineStyle(2, 0x7c7250).lineBetween(x, top - 2, x + 22, top - 2).lineBetween(x + 16, top - 2, x + 16, top + 12);
    shape(0x443b2d, [[x + 7, top + 11], [x + 25, top + 11], [x + 29, top + 18],
      [x + 26, top + 39], [x + 7, top + 39], [x + 3, top + 18]]);
    g.fillStyle(0xe4b96c).fillRoundedRect(x + 8, top + 16, 16, 20, 4);
    g.fillStyle(0xffe5a2).fillRoundedRect(x + 12, top + 18, 7, 15, 2);
    g.lineStyle(1, 0x7f5c39, 0.75).lineBetween(x + 16, top + 16, x + 16, top + 36);
    g.fillStyle(0xb6995d, 0.1).fillEllipse(x + 16, foot + 6, 90, 15);

    const sx = x + 213, sy = foot - 2;
    // 작은 길목 장승: 전투 유닛인 장승 망령과 구분되도록 어둡고 낮게 그린다.
    shape(0x182b24, [[sx - 10, sy], [sx - 7, sy - 38], [sx + 1, sy - 44], [sx + 9, sy - 37], [sx + 11, sy]]);
    g.fillStyle(0x5e6446, 0.7).fillRoundedRect(sx - 5, sy - 35, 12, 34, 3);
    g.lineStyle(2, 0x23392d).lineBetween(sx - 3, sy - 27, sx + 1, sy - 25)
      .lineBetween(sx + 3, sy - 25, sx + 6, sy - 28).lineBetween(sx - 2, sy - 18, sx + 5, sy - 17);
    g.lineStyle(1, 0x969269, 0.35).lineBetween(sx - 2, sy - 11, sx - 2, sy - 3);
  }

  // 소수의 반딧불만 천천히 움직여 배경에 생기를 준다.
  for (let i = 0; i < Math.ceil(width / 250); i++) {
    const x = i * 250 + 94, y = foot - 14 - i * 17 % 45;
    const glow = scene.add.circle(x, y, 1.5, 0xdfcc84, 0.5).setDepth(3);
    scene.tweens.add({ targets: glow, x: x + 13, y: y - 9, alpha: 0.12,
      duration: 2100 + i % 4 * 390, delay: i * 140, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }
}
