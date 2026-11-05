import Phaser from 'phaser';
import type { Rect } from '../../scenes/layout';
import { DEFAULT_UI as U } from './tokens';

/** 각 장의 문양과 다섯 관문 기록을 보여 주는 여정 표지. */
export class ChapterSelector {
  private readonly art: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly caption: Phaser.GameObjects.Text;
  private selected = false;
  private hovered = false;

  constructor(scene: Phaser.Scene, private readonly rect: Rect, private readonly chapter: number,
    title: string, private readonly cleared: readonly boolean[], onSelect: () => void) {
    const { x, y } = rect;
    this.art = scene.add.graphics();
    this.caption = scene.add.text(x + 63, y + 9, `제${chapter + 1}장`, {
      fontFamily: U.font, fontSize: '12px', color: U.muted,
    });
    this.title = scene.add.text(x + 63, y + 27, title, {
      fontFamily: U.font, fontSize: '17px', fontStyle: 'bold', color: U.text,
    });
    const hit = scene.add.zone(x, y, rect.w, rect.h).setOrigin(0).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', onSelect);
    hit.on('pointerover', () => { this.hovered = true; this.draw(); });
    hit.on('pointerout', () => { this.hovered = false; this.draw(); });
    this.draw();
  }

  setSelected(selected: boolean): void {
    if (this.selected === selected) return;
    this.selected = selected;
    this.draw();
  }

  private draw(): void {
    const { x, y, w, h } = this.rect;
    const g = this.art.clear(), cx = x + 30, cy = y + 31;
    const ink = this.selected ? U.gold : this.hovered ? 0xc8be9b : 0x819b92;
    if (this.selected || this.hovered) {
      g.fillStyle(this.selected ? U.gold : 0x9cb5ab, this.selected ? 0.065 : 0.04)
        .fillRoundedRect(x, y, w, h, 7);
    }
    g.fillStyle(0x0c1b23, 0.9).fillCircle(cx, cy + 2, 24);
    g.fillStyle(this.selected ? 0x35433a : 0x20332f).fillCircle(cx, cy, 22);
    g.lineStyle(this.selected ? 2 : 1, ink, this.selected ? 1 : 0.55).strokeCircle(cx, cy, 22);
    if (this.selected) {
      g.lineStyle(1, U.gold, 0.35).strokeCircle(cx, cy, 26);
      g.fillStyle(U.gold).fillTriangle(cx - 3, cy + 30, cx + 3, cy + 30, cx, cy + 34);
    }
    this.drawEmblem(cx, cy, ink);
    this.caption.setColor(this.selected ? U.goldText : '#8ea39d');
    this.title.setColor(this.selected ? '#ffe0a0' : this.hovered ? U.text : '#bbc9bf');
    for (let i = 0; i < 5; i++) {
      g.fillStyle(this.cleared[i] ? U.gold : 0x61746a, this.cleared[i] ? 0.9 : 0.45)
        .fillRoundedRect(x + 64 + i * 15, y + 53, 10, 3, 1);
    }
    if (this.selected) g.lineStyle(1, U.gold, 0.6).lineBetween(x + 63, y + h - 2, x + w - 8, y + h - 2);
  }

  private drawEmblem(x: number, y: number, ink: number): void {
    const g = this.art;
    g.lineStyle(1.7, ink, 0.95);
    switch (this.chapter) {
      case 0: // 장터 등롱
        g.lineBetween(x, y - 16, x, y - 10);
        g.strokeRoundedRect(x - 9, y - 10, 18, 22, 5);
        g.lineBetween(x - 10, y - 8, x + 10, y - 8).lineBetween(x - 10, y + 10, x + 10, y + 10);
        g.lineBetween(x, y - 6, x, y + 8).lineBetween(x, y + 12, x, y + 17);
        g.fillStyle(ink, 0.12).fillRoundedRect(x - 6, y - 6, 12, 14, 3);
        break;
      case 1: // 장승 고개
        g.strokeRoundedRect(x - 7, y - 14, 14, 29, 3);
        g.lineBetween(x - 4, y - 7, x - 1, y - 5).lineBetween(x + 1, y - 5, x + 4, y - 7);
        g.lineBetween(x - 4, y + 1, x + 4, y + 1).lineBetween(x - 3, y + 4, x + 3, y + 4);
        g.lineBetween(x, y + 8, x, y + 12);
        break;
      case 2: // 나루의 배와 물결
        g.beginPath().moveTo(x - 14, y + 1).lineTo(x - 8, y + 8).lineTo(x + 8, y + 8)
          .lineTo(x + 14, y + 1).closePath().strokePath();
        g.lineBetween(x, y + 1, x, y - 15);
        g.strokeTriangle(x + 2, y - 13, x + 2, y - 1, x + 12, y - 1);
        g.lineStyle(1, ink, 0.6).lineBetween(x - 12, y + 12, x - 2, y + 12)
          .lineBetween(x + 3, y + 14, x + 12, y + 14);
        break;
      case 3: // 달그림자 대숲
        for (const offset of [-8, 3, 11]) {
          g.lineStyle(1.7, ink, 0.9).lineBetween(x + offset, y + 15, x + offset - 2, y - 13 + Math.abs(offset) / 2);
          g.lineStyle(1, ink, 0.7).lineBetween(x + offset - 3, y + 4, x + offset + 2, y + 4);
          g.lineBetween(x + offset - 1, y - 2, x + offset - 7, y - 7);
        }
        g.lineStyle(1, ink, 0.6).strokeCircle(x - 6, y - 10, 5);
        break;
      default: // 혼불
        g.beginPath().moveTo(x, y - 17).lineTo(x + 9, y - 4).lineTo(x + 11, y + 4)
          .lineTo(x + 6, y + 12).lineTo(x - 3, y + 14).lineTo(x - 10, y + 6)
          .lineTo(x - 8, y - 3).lineTo(x - 3, y + 1).lineTo(x, y - 17).strokePath();
        g.fillStyle(ink, 0.2).fillEllipse(x, y + 6, 9, 12);
        g.lineStyle(1, ink, 0.6).lineBetween(x - 15, y - 3, x - 17, y - 7)
          .lineBetween(x + 14, y + 9, x + 17, y + 6);
    }
  }
}
