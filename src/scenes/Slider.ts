import Phaser from 'phaser';
import { VOLUME } from '../data/settings';
import { volumeFromRatio } from '../game/settings';
import { HUD_FONT } from './layout';
import { INK } from './palette';

/** 0~100 가로 슬라이더. 클릭하거나 끌어서 값을 바꾼다 */
export class Slider {
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly knob: Phaser.GameObjects.Arc;
  private readonly valueText: Phaser.GameObjects.Text;
  private dragging = false;
  private value: number;

  constructor(
    scene: Phaser.Scene,
    private readonly x: number,
    y: number,
    private readonly width: number,
    initial: number,
    private readonly onChange: (value: number) => void,
    depth: number,
  ) {
    this.value = initial;
    scene.add.rectangle(x, y, width, 8, 0xb9a97f).setOrigin(0, 0.5).setStrokeStyle(1, INK).setDepth(depth);
    this.fill = scene.add.rectangle(x, y, 0, 8, 0xd9473b).setOrigin(0, 0.5).setDepth(depth + 1);
    this.knob = scene.add.circle(x, y, 11, 0xf3ead4).setStrokeStyle(2, INK).setDepth(depth + 2);
    this.valueText = scene.add
      .text(x + width + 16, y, '', { fontFamily: HUD_FONT, fontSize: '18px', color: '#2b2622', fontStyle: 'bold' })
      .setOrigin(0, 0.5)
      .setDepth(depth);
    // 막대보다 넓은 눌림 영역
    const hit = scene.add.rectangle(x + width / 2, y, width + 24, 32, 0x000000, 0).setDepth(depth + 3);
    hit.setInteractive({ useHandCursor: true }).on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragging = true;
      this.setFromPointer(p.x);
    });
    // 씬 입력 리스너는 씬이 끝날 때 Phaser가 함께 정리한다
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.dragging) this.setFromPointer(p.x);
    });
    scene.input.on('pointerup', () => {
      this.dragging = false;
    });
    this.refresh();
  }

  private setFromPointer(px: number): void {
    const next = volumeFromRatio((px - this.x) / this.width);
    if (next === this.value) return;
    this.value = next;
    this.onChange(next);
    this.refresh();
  }

  private refresh(): void {
    const ratio = this.value / VOLUME.max;
    this.fill.setSize(this.width * ratio, 8);
    this.knob.setX(this.x + this.width * ratio);
    this.valueText.setText(String(this.value));
  }
}
