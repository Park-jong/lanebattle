import Phaser from 'phaser';
import { HUD_FONT, type Rect } from './layout';
import { addArtImage } from '../render/CharacterRenderer';
import { DEFAULT_UI as U } from '../ui/default/tokens';
import { skinText } from '../game/skinText';
import { commandFace, summonTile, type CommandKind, type SkillMark } from '../ui/default/commandDock';

export interface HudButtonStyle {
  fill?: number;
  border?: number;
  borderWidth?: number;
  shape?: 'rect' | 'round';
  compact?: boolean;
  center?: boolean;
  labelSize?: number;
  bigLabel?: boolean;
  depth?: number;
  key?: string;
  glyph?: string;
  /** A single large portrait with only a cost badge and optional cooldown. */
  portraitTile?: boolean;
  command?: CommandKind;
  mark?: SkillMark;
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
  private level = -1;
  private maxLevel = 5;
  private portraitKey = '';

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
  setProgress(level: number, maxLevel: number): void {
    if (this.level === level && this.maxLevel === maxLevel) return;
    this.level = level;
    this.maxLevel = maxLevel;
    this.glyph.setText(String(level));
    this.redraw();
  }
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
    label = skinText(label); sub = skinText(sub).replace('지휘 에너지', '에너지');
    if (this.style.portraitTile) label = this.portrait ? '' : label.slice(0, 2);
    if (this.label.text !== label) this.label.setText(label);
    if (this.sub.text !== sub) this.sub.setText(sub);
  }
  setPortrait(subject: string, frame = 'icon'): void {
    const key = subject + ':' + frame;
    if (key === this.portraitKey) return;
    this.portraitKey = key;
    this.portrait?.destroy();
    const size = this.style.portraitTile ? Math.min(this.rect.w - 8, this.rect.h - 2) : this.style.command === 'skill' ? 40 : 34;
    this.portrait = addArtImage(this.gfx.scene, subject, frame, 0, 0, size, size)
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
    reason = skinText(reason).replace('지휘 에너지', '에너지');
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
    } else if (s.command) {
      this.badge.setOrigin(0.5).setPosition(s.command === 'move' ? x + 12.5 : x + w - 12.5, y + 12.5);
      this.label.setColor(s.command === 'skill' ? '#473b2b' : U.text);
      if (s.command === 'move') {
        this.label.setOrigin(0.5).setPosition(x + w / 2, y + h / 2 + 1).setColor(U.goldText);
      } else if (s.command === 'inspect') {
        this.label.setOrigin(0.5).setPosition(x + w / 2 + 12, y + 26).setWordWrapWidth(w - 52, true);
        this.stateText.setOrigin(0.5).setPosition(x + w / 2 + 12, y + 49).setFontSize(11);
      } else {
        this.portrait?.setPosition(x + w / 2, y + 30);
        this.label.setOrigin(0.5, 0).setPosition(x + w / 2, y + (s.command === 'skill' ? 58 : 63))
          .setWordWrapWidth(w - 14, true);
        this.sub.setOrigin(0.5).setPosition(x + w / 2, y + 106).setFontSize(14);
        this.stateText.setOrigin(0.5).setPosition(x + w / 2, y + h - 11).setFontSize(11);
        this.glyph.setOrigin(0.5).setPosition(x + w / 2, y + 35).setFontSize(22);
      }
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
    if (s.shape === 'round') {
      const cx = x + w / 2, cy = y + h / 2, radius = s.compact ? 22 : Math.min(w, h) / 2 - 2;
      g.fillStyle(0x080f12, 0.8).fillCircle(cx, cy + 3, radius + 1);
      g.fillStyle(0xb28c4d, 1).fillCircle(cx, cy, radius);
      g.fillStyle(fill, 1).fillCircle(cx, cy, radius - 3);
      g.lineStyle(this.hovered ? 2 : 1, border, 0.8).strokeCircle(cx, cy, radius - 6);
      g.lineStyle(1, 0x85b89a, 0.35).strokeCircle(cx, cy, radius - 9);
      for (let i = 0; i < 4; i++) {
        const angle = i * Math.PI / 2;
        const px = cx + Math.cos(angle) * (radius - 1), py = cy + Math.sin(angle) * (radius - 1);
        g.fillStyle(0x9d4b37, 1).fillCircle(px, py, 2);
      }
      return;
    }
    if (s.portraitTile) {
      summonTile(g, overlay, this.rect, { accent: s.border ?? U.gold, enabled: this.enabled,
        active: this.hovered || this.held, cooldown: this.cooldown });
      const costColor = this.enabled || this.cooldown > 0 ? '#403321' : '#963c2e';
      if (this.sub.style.color !== costColor) this.sub.setColor(costColor);
      this.portrait?.setAlpha(this.enabled || this.cooldown > 0 ? 1 : 0.7);
      return;
    }
    if (s.command) {
      commandFace(g, overlay, this.rect, { kind: s.command, mark: s.mark, accent: s.border ?? U.gold,
        enabled: this.enabled, active: this.hovered || this.held, cooldown: this.cooldown,
        level: Math.max(0, this.level), maxLevel: this.maxLevel });
      this.label.setAlpha(this.enabled ? 1 : 0.85);
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
