import Phaser from 'phaser';
import { HUD_FONT, type Rect } from './layout';
import { BUTTON_FILL } from './palette';

export interface HudButtonStyle {
  fill?: number;
  /** 테두리 색 (태그 오방색 등) */
  border?: number;
  borderWidth?: number;
  /** round면 둥근 버튼 (눌림 영역은 그대로 사각형 전체) */
  shape?: 'rect' | 'round';
  /** 글자를 가운데 정렬 (기본은 왼쪽 위) */
  center?: boolean;
  labelSize?: number;
  /** 글자만 크게 가운데 하나 (이동 화살표 등) */
  bigLabel?: boolean;
  depth?: number;
}

export interface HudButtonHandlers {
  onPress: () => void;
  /** 손가락·마우스를 떼거나 버튼 밖으로 나갔을 때 (누르고 있는 동안 동작하는 버튼용) */
  onRelease?: () => void;
}

/** HUD 버튼: 도형 한 장 + 글자 두 줄 + 쿨타임 덮개. 눌림 영역은 항상 rect 전체 */
export class HudButton {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly zone: Phaser.GameObjects.Zone;
  private readonly label: Phaser.GameObjects.Text;
  private readonly sub: Phaser.GameObjects.Text;
  private rect: Rect;
  private cooldown = 0;
  private enabled = true;
  private visible = true;
  private held = false;

  constructor(
    scene: Phaser.Scene,
    rect: Rect,
    private readonly style: HudButtonStyle,
    private readonly handlers: HudButtonHandlers,
  ) {
    this.rect = { ...rect };
    const depth = style.depth ?? 100;
    this.gfx = scene.add.graphics().setScrollFactor(0).setDepth(depth);
    const font = { fontFamily: HUD_FONT, color: '#ffffff' };
    const round = style.shape === 'round';
    const wrap = { width: rect.w - (round ? 16 : 6) };
    this.label = scene.add
      .text(0, 0, '', {
        ...font,
        fontSize: `${style.labelSize ?? 11}px`,
        wordWrap: wrap,
        align: style.center ? 'center' : 'left',
        fontStyle: style.bigLabel ? 'bold' : 'normal',
      })
      .setScrollFactor(0).setDepth(depth + 1);
    this.sub = scene.add
      .text(0, 0, '', { ...font, fontSize: '12px', color: '#ffd166', align: style.center ? 'center' : 'left' })
      .setScrollFactor(0).setDepth(depth + 1);
    this.zone = scene.add
      .zone(rect.x, rect.y, rect.w, rect.h)
      .setOrigin(0).setScrollFactor(0).setDepth(depth + 2)
      .setInteractive({ useHandCursor: true });
    this.zone.on('pointerdown', () => {
      if (!this.visible) return;
      this.held = true;
      this.redraw();
      this.handlers.onPress();
    });
    for (const ev of ['pointerup', 'pointerout', 'pointerupoutside']) this.zone.on(ev, () => this.release());
    this.layout();
    this.redraw();
  }

  /** 지금 눌려 있는지 */
  get isHeld(): boolean {
    return this.held;
  }

  /** 누름 상태를 강제로 푼다 (일시정지·화면 숨김 때) */
  release(): void {
    if (!this.held) return;
    this.held = false;
    this.handlers.onRelease?.();
    this.redraw();
  }

  /** 버튼을 다른 위치로 옮긴다 */
  moveTo(x: number, y: number): void {
    this.rect.x = x;
    this.rect.y = y;
    this.zone.setPosition(x, y);
    this.layout();
    this.redraw();
  }

  setTexts(label: string, sub: string): void {
    this.label.setText(label);
    this.sub.setText(sub);
  }

  setVisible(visible: boolean): void {
    if (visible === this.visible) return;
    this.visible = visible;
    for (const o of [this.gfx, this.label, this.sub]) o.setVisible(visible);
    if (this.zone.input) this.zone.input.enabled = visible;
    if (!visible) this.release();
    else this.redraw();
  }

  /** cooldownRatio 0~1: 쿨타임 비율, enabled=false면 흐리게 */
  setState(cooldownRatio: number, enabled: boolean): void {
    const ratio = Math.max(0, Math.min(1, cooldownRatio));
    if (ratio === this.cooldown && enabled === this.enabled && !this.held) return;
    this.cooldown = ratio;
    this.enabled = enabled;
    this.redraw();
  }

  private layout(): void {
    const { x, y, w, h } = this.rect;
    const s = this.style;
    if (s.bigLabel) {
      this.label.setOrigin(0.5).setPosition(x + w / 2, y + h / 2);
      this.sub.setPosition(x + 3, y + h - 16);
    } else if (s.center) {
      const round = s.shape === 'round';
      this.label.setOrigin(0.5, 0).setPosition(x + w / 2, y + (round ? 12 : 4));
      this.sub.setOrigin(0.5, 0).setPosition(x + w / 2, y + h - (round ? 22 : 18));
    } else {
      this.label.setOrigin(0).setPosition(x + 3, y + 3);
      this.sub.setOrigin(0).setPosition(x + 3, y + h - 16);
    }
  }

  private redraw(): void {
    const g = this.gfx;
    const { x, y, w, h } = this.rect;
    const s = this.style;
    const alpha = this.enabled ? 1 : 0.5;
    const fill = this.held ? lighten(s.fill ?? BUTTON_FILL) : (s.fill ?? BUTTON_FILL);
    const bw = s.borderWidth ?? 2;
    const border = s.border ?? 0x000000;
    g.clear();
    this.label.setAlpha(alpha);
    this.sub.setAlpha(alpha);
    if (s.shape === 'round') {
      const cx = x + w / 2, cy = y + h / 2, r = Math.min(w, h) / 2 - 1;
      g.fillStyle(fill, alpha).fillCircle(cx, cy, r);
      if (this.cooldown > 0) {
        // 남은 쿨타임만큼 위에서 시계 방향으로 어둡게 덮는다
        const start = -Math.PI / 2;
        g.fillStyle(0x000000, 0.6).slice(cx, cy, r, start, start + Math.PI * 2 * this.cooldown, false).fillPath();
      }
      g.lineStyle(bw, border, alpha).strokeCircle(cx, cy, r);
      return;
    }
    g.fillStyle(fill, alpha).fillRoundedRect(x, y, w, h, 6);
    if (this.cooldown > 0) {
      g.fillStyle(0x000000, 0.6).fillRect(x + 1, y + h - h * this.cooldown, w - 2, h * this.cooldown - 1);
    }
    g.lineStyle(bw, border, alpha).strokeRoundedRect(x, y, w, h, 6);
  }
}

/** 눌렀을 때 살짝 밝게 */
function lighten(color: number): number {
  const ch = (shift: number) => Math.min(255, ((color >> shift) & 0xff) + 40);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
