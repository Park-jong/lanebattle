import Phaser from 'phaser';
import { HUD_FONT, type Rect } from './layout';
import { addArtImage } from '../render/CharacterRenderer';
import { DEFAULT_UI as U } from '../ui/default/tokens';

export interface HudButtonStyle {
  fill?: number;
  border?: number;
  borderWidth?: number;
  shape?: 'rect' | 'round';
  center?: boolean;
  labelSize?: number;
  bigLabel?: boolean;
  depth?: number;
  key?: string;
  glyph?: string;
  /** A single large portrait with only a cost badge and optional cooldown. */
  portraitTile?: boolean;
}

export interface HudButtonHandlers {
  onPress: () => void;
  onRelease?: () => void;
  onHover?: () => void;
  onHoverOut?: () => void;
  /** Return true when detail mode consumed this input, including unavailable cards. */
  onInspect?: () => boolean;
}

export class HudButton {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly zone: Phaser.GameObjects.Zone;
  private readonly label: Phaser.GameObjects.Text;
  private readonly sub: Phaser.GameObjects.Text;
  private readonly badge: Phaser.GameObjects.Text;
  private readonly stateText: Phaser.GameObjects.Text;
  private readonly glyph: Phaser.GameObjects.Text;
  private rect: Rect;
  private cooldown = 0;
  private enabled = true;
  private visible = true;
  private held = false;
  private heldPointer: number | null = null;
  private hovered = false;
  private reason = '';
  private portrait?: Phaser.GameObjects.Image;
  private readonly overlay: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, rect: Rect, private readonly style: HudButtonStyle, private readonly handlers: HudButtonHandlers) {
    this.rect = { ...rect };
    const d = style.depth ?? 100;
    this.gfx = scene.add.graphics().setScrollFactor(0).setDepth(d);
    this.overlay = scene.add.graphics().setScrollFactor(0).setDepth(d + 0.8);
    const text = (size: number, color: string) => scene.add.text(0, 0, '', {
      fontFamily: HUD_FONT, fontSize: String(size) + 'px', fontStyle: 'bold', color, align: 'center',
    }).setScrollFactor(0).setDepth(d + 1);
    this.label = text(style.labelSize ?? 13, U.text).setWordWrapWidth(rect.w - 12, true);
    this.sub = text(style.portraitTile ? 18 : 14, U.goldText);
    this.badge = text(12, U.goldText).setText(style.key ?? '');
    this.stateText = text(style.portraitTile ? 24 : 12, U.muted);
    this.glyph = text(30, U.goldText).setText(style.glyph ?? '');
    this.zone = scene.add.zone(rect.x, rect.y, rect.w, rect.h)
      .setOrigin(0).setScrollFactor(0).setDepth(d + 2).setInteractive({ useHandCursor: true });
    this.zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.visible || this.handlers.onInspect?.()) return;
      if (!this.enabled || this.heldPointer !== null) return;
      this.heldPointer = pointer.id;
      this.held = true;
      this.redraw();
      this.handlers.onPress();
    });
    this.zone.on('pointerover', () => {
      this.hovered = true;
      this.redraw();
      if (this.visible) this.handlers.onHover?.();
    });
    this.zone.on('pointerout', () => {
      this.hovered = false;
      this.handlers.onHoverOut?.();
      this.redraw();
    });
    for (const ev of ['pointerup', 'pointerout', 'pointerupoutside']) {
      this.zone.on(ev, (pointer: Phaser.Input.Pointer) => {
        if (pointer.id === this.heldPointer) this.release();
      });
    }
    this.layout();
    this.redraw();
  }

  get isHeld(): boolean { return this.held; }
  release(): void {
    if (!this.held) return;
    this.held = false;
    this.heldPointer = null;
    this.handlers.onRelease?.();
    this.redraw();
  }
  moveTo(x: number, y: number): void {
    this.rect.x = x; this.rect.y = y;
    this.zone.setPosition(x, y);
    this.layout(); this.redraw();
  }
  setTexts(label: string, sub: string): void {
    if (this.style.portraitTile) label = this.portrait ? '' : label.slice(0, 2);
    if (this.label.text !== label) this.label.setText(label);
    if (this.sub.text !== sub) this.sub.setText(sub);
  }
  setPortrait(subject: string): void {
    this.portrait?.destroy();
    const size = this.style.portraitTile ? Math.min(this.rect.w - 8, this.rect.h - 2) : 34;
    this.portrait = addArtImage(this.gfx.scene, subject, 'icon', 0, 0, size, size)
      ?.setScrollFactor(0).setDepth((this.style.depth ?? 100) + 0.5);
    if (this.style.portraitTile && this.portrait) this.label.setText('');
    this.layout();
  }
  setVisible(visible: boolean): void {
    if (visible === this.visible) return;
    this.visible = visible;
    for (const o of [this.gfx, this.label, this.sub, this.badge, this.stateText, this.glyph, this.overlay, this.portrait]) o?.setVisible(visible);
    if (this.zone.input) this.zone.input.enabled = visible;
    if (!visible) { this.hovered = false; this.release(); }
    else this.redraw();
  }
  setState(cooldownRatio: number, enabled: boolean, reason = ''): void {
    const ratio = Math.max(0, Math.min(1, cooldownRatio));
    if (ratio === this.cooldown && enabled === this.enabled && reason === this.reason) return;
    this.cooldown = ratio; this.enabled = enabled; this.reason = reason;
    const state = this.style.portraitTile ? this.cooldown > 0 ? reason.replace('초', '') : enabled ? '' : '!' : reason;
    if (this.stateText.text !== state) this.stateText.setText(state);
    const color = enabled ? U.goodText : this.cooldown > 0 ? U.muted : U.dangerText;
    if (this.stateText.style.color !== color) this.stateText.setColor(color);
    if (this.style.portraitTile) {
      this.stateText.setOrigin(0.5).setPosition(this.rect.x + (this.cooldown > 0 ? this.rect.w / 2 : this.rect.w - 11),
        this.rect.y + (this.cooldown > 0 ? this.rect.h / 2 - 4 : 11));
      this.stateText.setFontSize(this.cooldown > 0 ? 24 : 16).setStroke('#0b1324', 4);
    }
    if (!enabled) this.release();
    this.redraw();
  }
  private layout(): void {
    const { x, y, w, h } = this.rect;
    const s = this.style;
    this.badge.setOrigin(0.5).setPosition(x + w - 12, y + 12);
    this.stateText.setOrigin(0.5).setPosition(x + w / 2, y + h - 10);
    if (s.portraitTile) {
      this.portrait?.setPosition(x + w / 2, y + h / 2 - 2);
      this.label.setOrigin(0.5).setFontSize(24).setPosition(x + w / 2, y + h / 2 - 4);
      this.badge.setOrigin(0.5).setPosition(x + 11, y + 11);
      this.sub.setOrigin(0.5).setPosition(x + w - 20, y + h - 12);
      this.stateText.setOrigin(0.5).setPosition(x + w / 2, y + h / 2 - 4);
    } else if (s.bigLabel) {
      this.label.setOrigin(0.5).setPosition(x + w / 2, y + h / 2);
      this.sub.setOrigin(0.5).setPosition(x + w / 2, y + h - 16);
    } else if (s.key && h <= 72) {
      this.label.setOrigin(0, 0).setPosition(x + 5, y + 4).setWordWrapWidth(w - 21, true).setFontSize(12);
      this.portrait?.setPosition(x + 23, y + 37);
      this.sub.setOrigin(1, 0.5).setPosition(x + w - 7, y + 38);
    } else {
      this.glyph.setOrigin(0.5).setPosition(x + w / 2, y + 35);
      this.label.setOrigin(0.5, 0).setPosition(x + w / 2, y + (s.glyph ? 59 : 20));
      this.sub.setOrigin(0.5).setPosition(x + w / 2, y + h - 32);
    }
  }
  private redraw(): void {
    const { x, y, w, h } = this.rect;
    const s = this.style;
    const g = this.gfx.clear(), overlay = this.overlay.clear();
    const border = this.hovered || this.held ? U.gold : s.border ?? U.edge;
    const fill = this.held ? U.panelRaised : s.fill ?? U.panel;
    if (s.portraitTile) {
      const radius = 13;
      g.fillStyle(0x070e19, 0.6).fillRoundedRect(x, y + 3, w, h, radius);
      g.fillStyle(fill).fillRoundedRect(x, y, w, h, radius);
      g.fillStyle(border, 0.18).fillCircle(x + w / 2, y + h / 2 - 2, h / 2 - 2);
      g.lineStyle(this.hovered || this.held ? 2 : 1, border, this.enabled ? 0.9 : 0.45)
        .strokeRoundedRect(x + 0.5, y + 0.5, w - 1, h - 1, radius);
      if (this.cooldown > 0) {
        overlay.fillStyle(0x091221, 0.72).slice(x + w / 2, y + h / 2 - 2, h / 2 - 1,
          -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.cooldown, false).fillPath();
      }
      // Badges sit above the portrait and cooldown, as part of the icon frame.
      overlay.fillStyle(0x0b1424, 0.95).fillRoundedRect(x + 2, y + 2, 19, 19, 6);
      if (!this.enabled && this.cooldown <= 0) overlay.fillStyle(0x0b1424, 0.95).fillCircle(x + w - 11, y + 11, 9);
      overlay.fillStyle(0x0b1424, 0.96).fillRoundedRect(x + w - 39, y + h - 24, 37, 22, 8);
      overlay.lineStyle(1, U.gold, 0.25).strokeRoundedRect(x + w - 39, y + h - 24, 37, 22, 8);
      const costColor = this.enabled || this.cooldown > 0 ? U.goldText : U.dangerText;
      if (this.sub.style.color !== costColor) this.sub.setColor(costColor);
      this.portrait?.setAlpha(this.enabled || this.cooldown > 0 ? 1 : 0.55);
      return;
    }
    g.fillStyle(0x050b15, 0.6).fillRoundedRect(x, y + 3, w, h, 9);
    g.fillStyle(fill, 1).fillRoundedRect(x, y, w, h, 9);
    g.fillStyle(border, this.enabled ? 0.14 : 0.05).fillRoundedRect(x + 2, y + 2, w - 4, h - 4, 8);
    g.lineStyle(this.hovered ? 2 : 1, border, this.enabled ? 0.9 : 0.45).strokeRoundedRect(x, y, w, h, 9);
    if (s.borderWidth) g.fillStyle(border, 0.85).fillRoundedRect(x + 8, y, w - 16, 3, 1);
    if (s.key) g.fillStyle(0x0c1422, 0.85).fillRoundedRect(x + w - 21, y + 3, 18, 18, 4);
    if (this.cooldown > 0) {
      const height = (h - 4) * this.cooldown;
      overlay.fillStyle(0x070d1a, 0.5).fillRect(x + 2, y + h - 2 - height, w - 4, height);
    }
    this.label.setAlpha(this.enabled ? 1 : 0.8);
    this.portrait?.setAlpha(this.enabled ? 1 : 0.65);
  }
}
