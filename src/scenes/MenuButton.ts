import Phaser from 'phaser';
import { HUD_FONT, MIN_TOUCH } from './layout';
import { DEFAULT_UI as U } from '../ui/default/tokens';

export interface MenuButtonStyle {
  fill?: number;
  textColor?: string;
  fontSize?: number;
  tone?: 'primary' | 'secondary' | 'danger';
}

/** The original skin's framed button. Input bounds include the entire card. */
export class MenuButton {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly hit: Phaser.GameObjects.Zone;
  private readonly label: Phaser.GameObjects.Text;
  private enabled = true;
  private hovered = false;
  private fill: number;
  private readonly w: number;
  private readonly h: number;

  constructor(
    scene: Phaser.Scene,
    private readonly cx: number,
    private readonly cy: number,
    w: number, h: number, text: string, onClick: () => void,
    private readonly style: MenuButtonStyle = {},
  ) {
    this.w = Math.max(w, MIN_TOUCH);
    this.h = Math.max(h, MIN_TOUCH);
    this.fill = style.fill ?? (style.tone === 'primary' ? U.gold : style.tone === 'danger' ? 0xf0c9b9 : U.paper);
    this.bg = scene.add.graphics();
    this.label = scene.add.text(cx, cy, text, {
      fontFamily: HUD_FONT, fontSize: String(style.fontSize ?? 18) + 'px',
      color: style.textColor ?? U.darkText, fontStyle: 'bold', align: 'center',
      lineSpacing: 3, wordWrap: { width: this.w - 16, useAdvancedWrap: true },
    }).setOrigin(0.5);
    this.hit = scene.add.zone(cx, cy, this.w, this.h).setInteractive({ useHandCursor: true });
    this.hit.on('pointerdown', () => {
      if (!this.enabled) return;
      this.hovered = true;
      this.draw();
      onClick();
    });
    this.hit.on('pointerover', () => { this.hovered = true; this.draw(); });
    for (const event of ['pointerout', 'pointerup', 'pointerupoutside']) {
      this.hit.on(event, () => { this.hovered = false; this.draw(); });
    }
    this.draw();
  }

  setText(text: string): void { if (this.label.text !== text) this.label.setText(text); }
  setFill(color: number): void { if (this.fill !== color) { this.fill = color; this.draw(); } }
  destroy(): void { this.bg.destroy(); this.label.destroy(); this.hit.destroy(); }
  setEnabled(enabled: boolean): void {
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    this.draw();
  }
  setDepth(depth: number): this {
    this.bg.setDepth(depth);
    this.label.setDepth(depth + 1);
    this.hit.setDepth(depth + 2);
    return this;
  }

  private draw(): void {
    const x = this.cx - this.w / 2, y = this.cy - this.h / 2;
    const active = this.enabled && this.hovered;
    const g = this.bg.clear();
    g.fillStyle(0x070e19, 0.25).fillRoundedRect(x, y + 4, this.w, this.h, 9);
    g.fillStyle(this.enabled ? this.fill : 0xc4bea9, 1).fillRoundedRect(x, y, this.w, this.h, 9);
    if (active) g.fillStyle(0xffffff, 0.2).fillRoundedRect(x, y, this.w, this.h, 9);
    g.lineStyle(active ? 2 : 1, active ? U.gold : 0xbda67e, 1).strokeRoundedRect(x, y, this.w, this.h, 9);
    g.lineStyle(1, 0xffffff, 0.4).strokeRoundedRect(x + 3, y + 3, this.w - 6, this.h - 6, 7);
    if (this.style.tone === 'primary') {
      g.fillStyle(U.ink, 0.4).fillCircle(x + 12, this.cy, 2).fillCircle(x + this.w - 12, this.cy, 2);
    }
    this.label.setAlpha(this.enabled ? 1 : 0.6);
  }
}
