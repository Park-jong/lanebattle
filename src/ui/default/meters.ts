import Phaser from 'phaser';
import { DEFAULT_UI as U } from './tokens';
import { frontlineTrack, type Rect } from '../../scenes/layout';

type Box = { x: number; y: number; w: number; h: number };
export type MeterIcon = 'talisman' | 'spirit' | 'shrine' | 'castle';

/** 한 띠에 두 기지 체력을 좌우에서 채우고, 그 위에 전장 위치를 겹쳐 쓴다. */
export function frontlineMeter(g: Phaser.GameObjects.Graphics, frame: Rect, ally: number, enemy: number, shielded: boolean): void {
  const r = frontlineTrack(frame), half = r.w / 2;
  const left = half * Math.max(0, Math.min(1, ally)), right = half * Math.max(0, Math.min(1, enemy));
  lacquerFrame(g, r, 0x0c1816, 0xad915a, 3);
  g.fillStyle(ally < 0.25 ? 0xcc7556 : 0x487f68, 1).fillRect(r.x + 2, r.y + 2, Math.max(0, left - 2), r.h - 4);
  g.fillStyle(shielded ? 0x7d7b77 : enemy < 0.25 ? 0xd68b59 : 0x98534b, 1)
    .fillRect(r.x + r.w - Math.max(2, right), r.y + 2, Math.max(0, right - 2), r.h - 4);
  g.fillStyle(0xffedbd, 0.16).fillRect(r.x + 2, r.y + 2, Math.max(0, left - 2), 2);
  g.fillRect(r.x + r.w - Math.max(2, right), r.y + 2, Math.max(0, right - 2), 2);
  g.lineStyle(1, 0xd0b47b, 0.65).lineBetween(r.x + half, r.y + 2, r.x + half, r.y + r.h - 2);
  for (const [cx, color] of [[frame.x + 19, 0x7bd1af], [frame.x + frame.w - 19, shielded ? 0xb6b4aa : 0xebac95]]) {
    const cy = frame.y + frame.h / 2;
    g.fillStyle(0x101e1a).fillCircle(cx, cy, 16);
    g.lineStyle(1.5, color, 0.8).strokeCircle(cx, cy, 15);
    g.fillStyle(color).fillTriangle(cx - 8, cy - 2, cx, cy - 8, cx + 8, cy - 2);
    g.lineStyle(1.5, color, 1).lineBetween(cx - 9, cy, cx + 9, cy);
    g.lineBetween(cx - 5, cy, cx - 5, cy + 7).lineBetween(cx + 5, cy, cx + 5, cy + 7);
    g.lineBetween(cx - 6, cy + 8, cx + 6, cy + 8);
  }
}

/** 모서리를 깎은 옻칠 금속틀. 한지·단청 장식과 함께 쓰는 공통 도형이다. */
export function lacquerFrame(g: Phaser.GameObjects.Graphics, box: Box, fill: number, edge: number, cut = 5): void {
  const { x, y, w, h } = box;
  const c = Math.min(cut, h / 3, w / 3);
  const points = [[x + c, y], [x + w - c, y], [x + w, y + c], [x + w, y + h - c],
    [x + w - c, y + h], [x + c, y + h], [x, y + h - c], [x, y + c]]
    .map(([px, py]) => new Phaser.Math.Vector2(px, py));
  g.fillStyle(fill, 1).fillPoints(points, true);
  g.lineStyle(1, edge, 0.8).strokePoints(points, true);
  g.lineStyle(1, 0xffedbf, 0.12).lineBetween(x + c + 2, y + 2, x + w - c - 2, y + 2);
}

/** 네 고리를 엮은 매듭과 짧은 술 장식. */
export function knot(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number, scale = 1): void {
  const s = scale;
  g.lineStyle(1.2, color, 0.85);
  for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) {
    g.strokeEllipse(x + dx * s, y + dy * s, 6 * s, 6 * s);
  }
  g.fillStyle(color, 1).fillCircle(x, y, 1.5 * s);
  g.lineBetween(x, y + 6 * s, x, y + 12 * s);
  g.lineBetween(x - 2 * s, y + 10 * s, x - 2 * s, y + 14 * s);
  g.lineBetween(x + 2 * s, y + 10 * s, x + 2 * s, y + 14 * s);
}

/** 작은 전투 체력바는 얇게, HUD 게이지는 금빛 틀과 굵은 색면으로 표시한다. */
export function meterFill(g: Phaser.GameObjects.Graphics, box: Box, ratio: number, color: number, reverse = false): void {
  const { x, y, w, h } = box;
  const inset = h >= 8 ? 2 : 0;
  const width = (w - inset * 2) * Math.max(0, Math.min(1, ratio));
  if (h >= 8) lacquerFrame(g, box, 0x161b1a, 0xb48d51, 3);
  else g.fillStyle(0x0e191a, 0.85).fillRect(x, y, w, h);
  if (width < 0.5) return;
  const fillH = h - inset * 2;
  const fillX = reverse ? x + w - inset - width : x + inset;
  g.fillStyle(color, 1).fillRect(fillX, y + inset, width, fillH);
  g.fillStyle(0xffffff, 0.24).fillRect(fillX, y + inset, width, Math.max(1, fillH * 0.25));
  if (h >= 8) {
    g.fillStyle(0x081413, 0.2).fillRect(fillX, y + h - inset - 2, width, 2);
    if (width > 3) g.fillStyle(0xfff4ce, 0.8).fillRect(reverse ? fillX : fillX + width - 2, y + inset, 2, fillH);
  }
}

export function resourceMeter(g: Phaser.GameObjects.Graphics, box: Box, ratio: number, color: number, icon: MeterIcon): void {
  const { x, y, w, h } = box;
  const reverse = icon === 'castle';
  lacquerFrame(g, { x: x + (reverse ? 0 : 14), y: y + 1, w: w - 14, h: h - 2 }, 0x1b2725, 0x65715a);
  const radius = h / 2 - 1, cx = reverse ? x + w - 18 : x + 18, cy = y + h / 2;
  g.fillStyle(0x080f13, 1).fillCircle(cx, cy + 1, radius + 1);
  g.fillStyle(0xb28c4d, 1).fillCircle(cx, cy, radius);
  g.fillStyle(icon === 'castle' ? 0x572e30 : icon === 'spirit' ? 0x234b59 : 0x25453b, 1).fillCircle(cx, cy, radius - 2);
  g.lineStyle(1, color, 0.65).strokeCircle(cx, cy, radius - 4);
  g.lineStyle(1.5, color, 1);
  if (icon === 'talisman') {
    g.fillStyle(0xf5d984).fillRect(cx - 6, cy - 10, 12, 20);
    g.fillStyle(0xb04c35).fillRect(cx - 4, cy - 7, 8, 2);
    g.lineStyle(1.5, 0xa94030, 1).lineBetween(cx, cy - 3, cx, cy + 7);
    g.lineBetween(cx - 3, cy, cx + 3, cy).lineBetween(cx - 3, cy + 3, cx, cy + 6).lineBetween(cx, cy + 3, cx + 3, cy + 6);
  } else if (icon === 'spirit') {
    g.fillStyle(0x72d4d5).fillCircle(cx, cy + 2, 7);
    g.fillTriangle(cx - 6, cy, cx + 1, cy - 11, cx + 5, cy + 3);
    g.fillStyle(0xe0f5d6).fillCircle(cx + 1, cy + 3, 3);
    g.lineStyle(1, 0xb9e6cc, 0.8).lineBetween(cx - 9, cy + 9, cx - 4, cy + 11).lineBetween(cx + 4, cy + 11, cx + 9, cy + 9);
  } else {
    g.fillStyle(color).fillTriangle(cx - 10, cy - 2, cx, cy - 9, cx + 10, cy - 2);
    g.lineBetween(cx - 11, cy, cx + 11, cy).lineBetween(cx - 7, cy + 8, cx + 7, cy + 8);
    g.lineBetween(cx - 6, cy + 1, cx - 6, cy + 8).lineBetween(cx + 6, cy + 1, cx + 6, cy + 8);
    g.fillStyle(color).fillRect(cx - 2, cy + 3, 4, 5);
  }
  meterFill(g, { x: x + (reverse ? 9 : 42), y: y + h - 13, w: w - 51, h: 10 }, ratio, color, reverse);
  // 단청 색점과 금빛 귀 장식은 수치를 가리지 않는 틀 끝에만 둔다.
  const tip = reverse ? x + 5 : x + w - 5, side = reverse ? -3 : 3;
  g.fillStyle(color, 0.8).fillTriangle(tip, y + h / 2, tip + side, y + h / 2 - 3, tip + side, y + h / 2 + 3);
  if ((icon === 'shrine' || icon === 'castle') && ratio < 0.25) {
    g.lineStyle(2, U.danger, 0.85).strokeCircle(cx, cy, radius);
  }
}
