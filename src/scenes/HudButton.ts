import Phaser from 'phaser';
import { HUD_FONT } from './layout';

/** 간단한 HUD 버튼: 사각형 + 두 줄 글자 + 쿨타임 가림막 */
export class HudButton {
  private readonly bg: Phaser.GameObjects.Rectangle;
  private readonly cover: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.Text;
  private readonly sub: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly w: number,
    private readonly h: number,
    fillColor: number,
    onClick: () => void,
  ) {
    this.bg = scene.add.rectangle(x, y, w, h, fillColor).setOrigin(0).setStrokeStyle(2, 0x000000, 0.6);
    this.cover = scene.add.rectangle(x, y + h, w, 0, 0x000000, 0.6).setOrigin(0, 1);
    this.label = scene.add.text(x + 3, y + 3, '', {
      fontFamily: HUD_FONT, fontSize: '11px', color: '#ffffff', wordWrap: { width: w - 6 },
    });
    this.sub = scene.add.text(x + 3, y + h - 16, '', {
      fontFamily: HUD_FONT, fontSize: '12px', color: '#ffd166',
    });
    for (const o of [this.bg, this.cover, this.label, this.sub]) o.setScrollFactor(0).setDepth(100);
    this.bg.setInteractive({ useHandCursor: true }).on('pointerdown', onClick);
  }

  /** 버튼을 다른 위치로 옮긴다 */
  moveTo(x: number, y: number): void {
    this.bg.setPosition(x, y);
    this.cover.setPosition(x, y + this.h);
    this.label.setPosition(x + 3, y + 3);
    this.sub.setPosition(x + 3, y + this.h - 16);
  }

  setTexts(label: string, sub: string): void {
    this.label.setText(label);
    this.sub.setText(sub);
  }

  setVisible(visible: boolean): void {
    for (const o of [this.bg, this.cover, this.label, this.sub]) o.setVisible(visible);
    if (this.bg.input) this.bg.input.enabled = visible;
  }

  /** 0~1: 쿨타임 비율, enabled=false면 어둡게 */
  setState(cooldownRatio: number, enabled: boolean): void {
    this.cover.setSize(this.w, this.h * cooldownRatio);
    this.bg.setAlpha(enabled ? 1 : 0.55);
  }
}
