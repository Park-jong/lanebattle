import type Phaser from 'phaser';
import { DEFAULT_UI as U } from './tokens';

type Box = { x: number; y: number; w: number; h: number };
export type MeterIcon = 'talisman' | 'spirit' | 'shrine' | 'castle';

/** Rounded track and highlight, with no square fill protruding at either end. */
export function meterFill(g: Phaser.GameObjects.Graphics, box: Box, ratio: number, color: number): void {
  const { x, y, w, h } = box;
  const width = w * Math.max(0, Math.min(1, ratio));
  g.fillStyle(0x050e1b, 0.8).fillRoundedRect(x, y, w, h, h / 2);
  if (width < 0.5) return;
  const radius = Math.min(h / 2, width / 2);
  g.fillStyle(color, 0.95).fillRoundedRect(x, y, width, h, radius);
  if (width > 2) g.fillStyle(0xffffff, 0.22).fillRoundedRect(x + 1, y + 1, width - 2, Math.max(1, h * 0.35), Math.min(radius, 2));
}

export function resourceMeter(g: Phaser.GameObjects.Graphics, box: Box, ratio: number, color: number, icon: MeterIcon): void {
  const { x, y, w, h } = box;
  g.fillStyle(0x0d1828, 0.8).fillRoundedRect(x, y, w, h, h / 2);
  const radius = Math.min(13, h / 2 - 2), cx = x + radius + 4, cy = y + h / 2;
  g.fillStyle(color, 0.13).fillCircle(cx, cy, radius);
  g.lineStyle(1.5, color, 0.95);
  if (icon === 'talisman') {
    g.strokeRoundedRect(cx - 5, cy - 8, 10, 16, 2);
    g.lineBetween(cx - 2, cy - 4, cx + 2, cy - 4).lineBetween(cx, cy - 1, cx, cy + 5);
    g.lineBetween(cx - 3, cy + 2, cx + 3, cy + 2);
  } else if (icon === 'spirit') {
    g.fillStyle(color).fillTriangle(cx, cy - 8, cx - 5, cy, cx + 5, cy);
    g.fillTriangle(cx, cy + 8, cx - 5, cy, cx + 5, cy);
  } else {
    g.lineBetween(cx - 7, cy - 2, cx, cy - 7).lineBetween(cx, cy - 7, cx + 7, cy - 2);
    g.lineBetween(cx - 7, cy - 1, cx + 7, cy - 1).lineBetween(cx - 5, cy + 7, cx + 5, cy + 7);
    g.lineBetween(cx - 4, cy, cx - 4, cy + 7).lineBetween(cx + 4, cy, cx + 4, cy + 7);
    if (icon === 'castle') g.lineBetween(cx, cy + 2, cx, cy + 7);
  }
  meterFill(g, { x: x + 36, y: y + h - 8, w: w - 46, h: h <= 26 ? 3 : 5 }, ratio, color);
  if ((icon === 'shrine' || icon === 'castle') && ratio < 0.25) {
    g.lineStyle(1, U.danger, 0.6).strokeRoundedRect(x, y, w, h, h / 2);
  }
}
