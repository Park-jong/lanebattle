import Phaser from 'phaser';

/** 제목 뒤로 펼쳐지는 굿판 현수막. 승리 기록과 버튼의 영역은 침범하지 않는다. */
export function resultBanner(g: Phaser.GameObjects.Graphics, cx: number, y: number, victory: boolean): void {
  const gold = victory ? 0xecc777 : 0xaa9c96;
  const cloth = victory ? 0x863e2d : 0x434356;
  const shape = (color: number, points: number[][], alpha = 1) => {
    g.fillStyle(color, alpha).fillPoints(points.map(([x, py]) => new Phaser.Math.Vector2(x, py)), true);
  };
  g.fillStyle(gold, 0.045).fillEllipse(cx, y + 25, 390, 91);
  for (const side of [-1, 1]) {
    shape(cloth, [[cx + side * 137, y + 3], [cx + side * 205, y - 1],
      [cx + side * 190, y + 26], [cx + side * 208, y + 46], [cx + side * 137, y + 42]]);
    g.lineStyle(1, gold, 0.6).lineBetween(cx + side * 158, y + 8, cx + side * 196, y + 6);
    g.lineStyle(1, gold, 0.3).lineBetween(cx + side * 158, y + 39, cx + side * 196, y + 40);
    g.lineStyle(1.5, gold, 0.6).lineBetween(cx + side * 211, y + 13, cx + side * 220, y + 8);
    g.fillStyle(gold, 0.7).fillCircle(cx + side * 219, y + 30, 1.5);
  }
  shape(0x351f20, [[cx - 160, y + 9], [cx + 160, y + 9], [cx + 154, y + 60], [cx - 154, y + 60]]);
  shape(cloth, [[cx - 162, y - 3], [cx + 162, y - 3], [cx + 155, y + 51], [cx - 155, y + 51]]);
  g.lineStyle(1.5, gold, 0.85).lineBetween(cx - 160, y - 3, cx + 160, y - 3);
  g.lineStyle(1, gold, 0.65).lineBetween(cx - 154, y + 49, cx + 154, y + 49);
  g.fillStyle(gold, 0.8).fillTriangle(cx - 4, y - 13, cx + 4, y - 13, cx, y - 8);
}
