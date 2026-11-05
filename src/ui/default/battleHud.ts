import Phaser from 'phaser';
import { BATTLE_LAYOUT as L } from '../../scenes/layout';
import { knot, lacquerFrame } from './meters';
import { commandDockFrame } from './commandDock';

/** 상단에는 중앙 통합 띠와 오른쪽 관문 표지만 남긴다. */
export function battleHudFrame(scene: Phaser.Scene): void {
  const g = scene.add.graphics().setScrollFactor(0).setDepth(89);
  const f = L.frontline;
  lacquerFrame(g, f, 0x172721, 0xb3955e, 8);
  g.lineStyle(1, 0x608b70, 0.5).lineBetween(f.x + 30, f.y + f.h - 4, f.x + f.w - 30, f.y + f.h - 4);
  knot(g, f.x + f.w / 2, f.y + f.h - 4, 0xc4a268, 0.4);
  const r = L.infoText;
  lacquerFrame(g, r, 0x1e2923, 0x7c7956, 5);
  g.fillStyle(0xb18d53).fillRect(r.x + 5, r.y + 7, 2, r.h - 14);
  commandDockFrame(scene);
}
