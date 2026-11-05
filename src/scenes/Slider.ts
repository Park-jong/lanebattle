import Phaser from 'phaser';
import { VOLUME } from '../data/settings';
import { volumeFromRatio } from '../game/settings';
import { HUD_FONT } from './layout';
import { DEFAULT_UI as U } from '../ui/default/tokens';

/** 0~100 가로 슬라이더. 클릭하거나 끌어서 값을 바꾼다 */
export class Slider {
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly knob: Phaser.GameObjects.Arc;
  private readonly valueText: Phaser.GameObjects.Text;
  private dragging = false;
  private value: number;
  private readonly objects: (Phaser.GameObjects.Rectangle | Phaser.GameObjects.Arc | Phaser.GameObjects.Text)[] = [];
  private readonly hit: Phaser.GameObjects.Rectangle;

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
    this.objects.push(scene.add.rectangle(x, y, width, 8, 0xc9b992).setOrigin(0, 0.5).setDepth(depth));
    this.fill = scene.add.rectangle(x, y, 0, 8, 0x477e73).setOrigin(0, 0.5).setDepth(depth + 1);
    this.knob = scene.add.circle(x, y, 14, U.paper).setStrokeStyle(3, 0x477e73).setDepth(depth + 2);
    this.valueText = scene.add
      .text(x + width + 16, y, '', { fontFamily: HUD_FONT, fontSize: '18px', color: '#2b2622', fontStyle: 'bold' })
      .setOrigin(0, 0.5)
      .setDepth(depth);
    // 막대보다 넓은 눌림 영역
    const hit = this.hit = scene.add.rectangle(x + width / 2, y, width + 24, 66, 0x000000, 0).setDepth(depth + 3);
    this.objects.push(this.fill, this.knob, this.valueText, hit);
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

  setVisible(visible: boolean): void {
    for (const object of this.objects) object.setVisible(visible);
    if (this.hit.input) this.hit.input.enabled = visible;
    if (!visible) this.dragging = false;
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
