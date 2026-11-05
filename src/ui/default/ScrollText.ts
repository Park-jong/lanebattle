import Phaser from 'phaser';
import { DEFAULT_UI as U } from './tokens';

/** A fixed readable viewport; content can grow without covering action buttons. */
export class ScrollText {
  readonly text: Phaser.GameObjects.Text;
  private offset = 0;
  private dragging = false;
  private lastY = 0;
  private readonly hit: Phaser.GameObjects.Zone;
  private readonly hint: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, private readonly rect: { x: number; y: number; w: number; h: number }, depth = 1) {
    this.text = scene.add.text(rect.x, rect.y, '', {
      fontFamily: U.font, fontSize: '14px', color: U.darkText, lineSpacing: 5,
      wordWrap: { width: rect.w - 8, useAdvancedWrap: true },
    }).setDepth(depth);
    this.hint = scene.add.text(rect.x, rect.y + rect.h + 2, '', {
      fontFamily: U.font, fontSize: '12px', color: '#716345',
    }).setDepth(depth);
    this.hit = scene.add.zone(rect.x, rect.y, rect.w, rect.h).setOrigin(0).setDepth(depth + 1).setInteractive();
    this.hit.on('pointerdown', (p: Phaser.Input.Pointer) => { this.dragging = true; this.lastY = p.y; });
    const move = (p: Phaser.Input.Pointer) => {
      if (!this.dragging) return;
      this.scroll(this.lastY - p.y); this.lastY = p.y;
    };
    const up = () => { this.dragging = false; };
    const wheel = (p: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) => {
      if (this.hit.getBounds().contains(p.x, p.y)) this.scroll(dy * 0.5);
    };
    scene.input.on('pointermove', move);
    scene.input.on('pointerup', up);
    scene.input.on('wheel', wheel);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input.off('pointermove', move); scene.input.off('pointerup', up); scene.input.off('wheel', wheel);
    });
  }

  setText(text: string, color: string = U.darkText): void {
    this.offset = 0;
    this.text.setText(text).setColor(color).setY(this.rect.y);
    this.text.setCrop(0, 0, this.rect.w, this.rect.h);
    this.hint.setText(this.text.height > this.rect.h ? '↕ 드래그 / 휠로 자세히 보기' : '');
  }

  private scroll(delta: number): void {
    this.offset = Math.max(0, Math.min(Math.max(0, this.text.height - this.rect.h), this.offset + delta));
    this.text.setY(this.rect.y - this.offset);
    this.text.setCrop(0, this.offset, this.rect.w, this.rect.h);
  }
}
