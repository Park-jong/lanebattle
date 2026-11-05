import Phaser from 'phaser';
import { BATTLE_LAYOUT as L, GAME_WIDTH, type Rect } from '../../scenes/layout';
import { knot, lacquerFrame } from './meters';
import { DEFAULT_UI as U } from './tokens';

export type CommandKind = 'move' | 'inspect' | 'gather' | 'skill';
export type SkillMark = 'fan' | 'blessing' | 'blade';

interface ButtonLook {
  accent: number;
  enabled: boolean;
  active: boolean;
  cooldown: number;
}

/** 아래 조작판도 상단과 같은 옻칠 바탕·동제 테두리·매듭으로 연결한다. */
export function commandDockFrame(scene: Phaser.Scene): void {
  const g = scene.add.graphics().setScrollFactor(0).setDepth(89);
  const y = L.panel.y;
  g.fillGradientStyle(0x28332b, 0x28332b, 0x101c1b, 0x101c1b, 1).fillRect(0, y, GAME_WIDTH, L.panel.h);
  for (const flange of [L.summonFlange, L.skillFlange]) {
    lacquerFrame(g, flange, 0x24362b, 0xb59259, 6);
    g.fillStyle(0x24362b).fillRect(flange.x + 1, flange.y + flange.h - 5, flange.w - 2, 6);
  }
  for (const [left, right] of [[0, L.summonFlange.x], [L.summonFlange.x + L.summonFlange.w, L.skillFlange.x],
    [L.skillFlange.x + L.skillFlange.w, GAME_WIDTH]]) {
    g.lineStyle(2, 0xb59259, 1).lineBetween(left, y + 1, right, y + 1);
  }
  g.lineStyle(1, 0x4e7c65, 1).lineBetween(0, y + 4, GAME_WIDTH, y + 4);
  g.lineStyle(1, 0x9c4f38, 0.8).lineBetween(0, 537, GAME_WIDTH, 537);
  g.lineStyle(2, 0x9e804d, 1).lineBetween(0, 539, GAME_WIDTH, 539);
  for (let row = 0; row < 8; row++) {
    g.lineStyle(1, 0x8d9b75, 0.035).lineBetween(0, y + 12 + row * 18, GAME_WIDTH, y + 12 + row * 18);
  }
  g.fillStyle(0x090f11, 0.55).fillRect(170, y + 4, 432, 142);
  for (const x of [166, 604, 716]) {
    g.lineStyle(1, 0xc4a16a, 0.3).lineBetween(x, y + 12, x, 528);
    g.fillStyle(0xc4a16a, 0.7).fillCircle(x, y + 9, 2);
    g.fillCircle(x, 531, 2);
    knot(g, x, y + 66, 0xbb9b64, 0.65);
  }
}

export function summonTile(g: Phaser.GameObjects.Graphics, overlay: Phaser.GameObjects.Graphics, r: Rect, look: ButtonLook): void {
  const { x, y, w, h } = r;
  const edge = look.active ? U.gold : look.enabled ? 0x9c8556 : 0x625f49;
  g.fillStyle(0x070f10, 0.65).fillRect(x + 2, y + 3, w - 4, h - 2);
  lacquerFrame(g, { x: x + 1, y: y + 1, w: w - 2, h: h - 2 }, look.active ? 0x344b39 : 0x20332b, edge, 6);
  g.fillStyle(look.accent, 0.09).fillCircle(x + w / 2, y + h / 2 - 2, h / 2 - 5);
  g.lineStyle(1, 0xb69d6e, 0.15).strokeCircle(x + w / 2, y + h / 2 - 2, h / 2 - 5);
  g.fillStyle(look.accent, 0.7).fillRect(x + 25, y + 2, w - 36, 2);
  for (const dx of [5, w - 5]) {
    g.lineStyle(1, edge, 0.75).lineBetween(x + dx, y + 7, x + dx, y + 16);
  }
  if (look.cooldown > 0) {
    overlay.fillStyle(0x0c1916, 0.72).slice(x + w / 2, y + h / 2 - 2, h / 2 - 1,
      -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * look.cooldown, false).fillPath();
  }
  if (!look.enabled && look.cooldown <= 0) {
    overlay.fillStyle(0x793e30, 1).fillCircle(x + w - 11, y + 11, 8);
  }
  lacquerFrame(overlay, { x: x + w - 39, y: y + h - 23, w: 36, h: 21 }, 0xe2cea1, 0x927646, 3);
}

function skillMark(g: Phaser.GameObjects.Graphics, x: number, y: number, mark: SkillMark, color: number): void {
  g.lineStyle(2, color, 1);
  if (mark === 'fan') {
    g.fillStyle(0x447a73, 0.16).slice(x, y + 10, 24, -Math.PI * 0.88, -Math.PI * 0.12, false).fillPath();
    g.lineStyle(2, color, 1).beginPath().arc(x, y + 10, 24, -Math.PI * 0.88, -Math.PI * 0.12).strokePath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI * 0.88 + i * Math.PI * 0.19;
      g.lineBetween(x, y + 10, x + Math.cos(a) * 23, y + 10 + Math.sin(a) * 23);
    }
    g.fillStyle(0x8c633a).fillCircle(x, y + 10, 3);
  } else if (mark === 'blessing') {
    for (const [dx, dy] of [[-7, 0], [7, 0], [0, -8], [0, 8]]) g.strokeEllipse(x + dx, y + dy, 14, 14);
    g.fillStyle(color).fillCircle(x, y, 4);
    g.lineBetween(x - 11, y + 16, x + 11, y + 16);
    g.lineStyle(1, 0x9d4d37, 0.8).strokeRect(x - 3, y + 12, 6, 8);
  } else {
    g.lineStyle(3, color, 1).lineBetween(x - 19, y + 7, x + 19, y + 7);
    g.lineStyle(1.5, color, 1).lineBetween(x - 19, y + 7, x - 22, y + 2).lineBetween(x + 19, y + 7, x + 22, y + 2);
    g.lineBetween(x - 13, y + 8, x - 13, y + 15).lineBetween(x + 13, y + 8, x + 13, y + 15);
    g.lineStyle(2, 0x9d4d37, 1).lineBetween(x - 6, y + 2, x, y - 10).lineBetween(x, y - 10, x + 6, y + 2);
    g.fillStyle(0xb78d44).fillCircle(x, y - 15, 3);
  }
}

export function commandFace(g: Phaser.GameObjects.Graphics, overlay: Phaser.GameObjects.Graphics, r: Rect,
  look: ButtonLook & { kind: CommandKind; mark?: SkillMark; level: number; maxLevel: number }): void {
  const { x, y, w, h } = r, cx = x + w / 2;
  const edge = look.active ? U.gold : look.enabled ? 0xb2965d : 0x766e51;
  g.fillStyle(0x080f10, 0.65).fillRect(x + 2, y + 4, w - 4, h - 3);
  lacquerFrame(g, { x: x + 1, y: y + 1, w: w - 2, h: h - 2 }, look.active ? 0x38513d : 0x24392e, edge, 7);
  if (look.kind === 'skill') {
    lacquerFrame(g, { x: x + 6, y: y + 7, w: w - 12, h: 88 }, look.enabled ? 0xefdfb8 : 0xd5c8a8, 0xa68c58, 3);
    g.fillStyle(look.accent, 0.12).fillCircle(cx, y + 34, 23);
    g.lineStyle(1, 0xb09967, 0.35).lineBetween(x + 14, y + 52, x + w - 14, y + 52);
    skillMark(g, cx, y + 32, look.mark ?? 'fan', look.accent);
    g.fillStyle(0x854332, 1).fillRect(x + 13, y + 5, w - 26, 3);
    g.fillStyle(0xb69757, 1).fillCircle(x + 12, y + 7, 2);
    g.fillCircle(x + w - 12, y + 7, 2);
    if (look.cooldown > 0) overlay.fillStyle(0x142d26, 0.65).slice(cx, y + 32, 23,
      -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * look.cooldown, false).fillPath();
  } else if (look.kind === 'gather') {
    g.fillStyle(0xb69757).fillCircle(cx, y + 35, 23);
    g.fillStyle(0x254d40).fillCircle(cx, y + 35, 20);
    g.lineStyle(1, 0xd5bb7e, 0.75).strokeCircle(cx, y + 35, 16);
    for (let i = 0; i < look.maxLevel; i++) {
      const bx = cx + (i - (look.maxLevel - 1) / 2) * 12;
      g.fillStyle(i < look.level ? 0xe9be63 : 0x11251d, 1).fillCircle(bx, y + 89, 3.5);
      g.lineStyle(1, 0x9f8554, 0.8).strokeCircle(bx, y + 89, 3.5);
    }
  } else if (look.kind === 'move') {
    g.fillStyle(0x10241d, 0.5).fillCircle(cx, y + h / 2 + 1, 23);
    g.lineStyle(1, 0xb69d6e, 0.2).strokeCircle(cx, y + h / 2 + 1, 23);
  } else {
    const bx = x + 23, by = y + h / 2;
    g.lineStyle(1.5, 0xd9c18a, 1).strokeRect(bx - 7, by - 11, 14, 21);
    g.lineBetween(bx - 3, by - 6, bx + 3, by - 6).lineBetween(bx - 3, by - 1, bx + 3, by - 1);
    g.lineBetween(bx, by + 3, bx, by + 7);
  }
  if (look.kind === 'skill' || look.kind === 'gather') {
    g.lineStyle(1, 0xb2955e, 0.25).lineBetween(x + 10, y + h - 24, x + w - 10, y + h - 24);
  }
}
