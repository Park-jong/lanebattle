import Phaser from 'phaser';
import { HUD_FONT, MIN_TOUCH } from './layout';
import { INK, PAPER } from './palette';

export interface MenuButtonStyle {
  fill?: number;
  textColor?: string;
  fontSize?: number;
}

/** 메뉴용 버튼: 가운데 기준 사각형 + 글자 한 줄 */
export class MenuButton {
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.Text;
  private enabled = true;

  constructor(
    scene: Phaser.Scene,
    cx: number,
    cy: number,
    w: number,
    h: number,
    text: string,
    onClick: () => void,
    style: MenuButtonStyle = {},
  ) {
    // 터치 기준: 모든 메뉴 버튼은 최소 66x66
    this.bg = scene.add.rectangle(cx, cy, Math.max(w, MIN_TOUCH), Math.max(h, MIN_TOUCH), style.fill ?? PAPER).setStrokeStyle(2, INK);
    this.label = scene.add
      .text(cx, cy, text, {
        fontFamily: HUD_FONT,
        fontSize: `${style.fontSize ?? 18}px`,
        color: style.textColor ?? '#2b2622',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.bg
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (this.enabled) onClick();
      })
      .on('pointerover', () => {
        if (this.enabled) this.bg.setAlpha(0.85);
      })
      .on('pointerout', () => this.applyAlpha());
  }

  setText(text: string): void {
    this.label.setText(text);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.applyAlpha();
  }

  /** 겹치는 씬 위에 그릴 때 깊이를 올린다 */
  setDepth(depth: number): this {
    this.bg.setDepth(depth);
    this.label.setDepth(depth + 1);
    return this;
  }

  private applyAlpha(): void {
    const a = this.enabled ? 1 : 0.45;
    this.bg.setAlpha(a);
    this.label.setAlpha(a);
  }
}
