import Phaser from 'phaser';
import { placeTooltip } from '../game/tooltipPlacement';
import type { TooltipStatus, TooltipText } from '../game/tooltipText';
import { GAME_HEIGHT, GAME_WIDTH, HUD_FONT, TOOLTIP_LAYOUT as T, type Rect } from './layout';
import { TOOLTIP_COLORS as C } from './palette';

/** 버튼 위에 띄우는 설명 상자. 입력을 받지 않고 화면 안에 머문다 */
export class Tooltip {
  private readonly box: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Text;
  private readonly status: Phaser.GameObjects.Text;
  private open = false;

  constructor(scene: Phaser.Scene) {
    const text = (size: number, color: string, bold = false) =>
      scene.add
        .text(0, 0, '', {
          fontFamily: HUD_FONT, fontSize: `${size}px`, color, lineSpacing: 3,
          fontStyle: bold ? 'bold' : 'normal', wordWrap: { width: T.width - T.padding * 2 },
        })
        .setScrollFactor(0).setDepth(T.depth + 1).setVisible(false);
    this.box = scene.add.graphics().setScrollFactor(0).setDepth(T.depth).setVisible(false);
    this.title = text(T.titleSize, C.title, true);
    this.body = text(T.bodySize, C.body);
    this.status = text(T.bodySize, C.ok, true);
  }

  get isOpen(): boolean {
    return this.open;
  }

  /** anchor(버튼) 위쪽에 내용을 연다. 내용이 바뀔 때만 부른다 */
  show(anchor: Rect, content: TooltipText, status: TooltipStatus): void {
    const p = T.padding;
    this.title.setText(content.title);
    this.body.setText(content.lines.join('\n'));
    this.setStatus(status);
    const h = p + this.title.height + 4 + this.body.height + 6 + this.status.height + p;
    const pos = placeTooltip(anchor, { w: T.width, h }, { w: GAME_WIDTH, h: GAME_HEIGHT }, T.gap, T.margin);
    this.title.setPosition(pos.x + p, pos.y + p);
    this.body.setPosition(pos.x + p, this.title.y + this.title.height + 4);
    this.status.setPosition(pos.x + p, this.body.y + this.body.height + 6);
    this.box.clear()
      .fillStyle(C.fill, 0.95).fillRoundedRect(pos.x, pos.y, T.width, h, 6)
      .lineStyle(2, C.border, 1).strokeRoundedRect(pos.x, pos.y, T.width, h, 6);
    for (const o of [this.box, this.title, this.body, this.status]) o.setVisible(true);
    this.open = true;
  }

  /** 열려 있는 동안 상태 줄만 갱신한다 (한 줄이라 상자 크기는 변하지 않는다) */
  setStatus(status: TooltipStatus): void {
    this.status.setText(status.text).setColor(status.ok ? C.ok : C.blocked);
  }

  hide(): void {
    if (!this.open) return;
    this.open = false;
    for (const o of [this.box, this.title, this.body, this.status]) o.setVisible(false);
  }
}
