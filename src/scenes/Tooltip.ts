import Phaser from 'phaser';
import { placeTooltip } from '../game/tooltipPlacement';
import type { TooltipStatus, TooltipText } from '../game/tooltipText';
import { BATTLE_LAYOUT, GAME_HEIGHT, GAME_WIDTH, HUD_FONT, TOOLTIP_LAYOUT as T, type Rect } from './layout';
import { DEFAULT_UI as U } from '../ui/default/tokens';

/** Scrollable detail panel. Status remains visible even for long awakened abilities. */
export class Tooltip {
  private readonly box: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Text;
  private readonly status: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly hit: Phaser.GameObjects.Zone;
  private open = false;
  private offset = 0;
  private maxScroll = 0;
  private bodyTop = 0;
  private dragging = false;
  private lastY = 0;

  constructor(scene: Phaser.Scene) {
    const text = (size: number, color: string, bold = false) => scene.add.text(0, 0, '', {
      fontFamily: HUD_FONT, fontSize: String(size) + 'px', color, lineSpacing: 4,
      fontStyle: bold ? 'bold' : 'normal', wordWrap: { width: T.width - T.padding * 2, useAdvancedWrap: true },
    }).setScrollFactor(0).setDepth(T.depth + 1).setVisible(false);
    this.box = scene.add.graphics().setScrollFactor(0).setDepth(T.depth).setVisible(false);
    this.title = text(T.titleSize, U.text, true);
    this.body = text(T.bodySize, U.muted);
    this.status = text(T.bodySize, U.goodText, true);
    this.hint = text(12, U.goldText);
    this.hit = scene.add.zone(0, 0, T.width, 1).setOrigin(0).setScrollFactor(0).setDepth(T.depth + 2).setVisible(false);
    this.hit.setInteractive().on('pointerdown', (p: Phaser.Input.Pointer) => { this.dragging = true; this.lastY = p.y; });
    const move = (p: Phaser.Input.Pointer) => {
      if (!this.dragging || !this.open) return;
      this.scroll(this.lastY - p.y);
      this.lastY = p.y;
    };
    const release = () => { this.dragging = false; };
    const wheel = (p: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) => {
      if (this.open && this.hit.getBounds().contains(p.x, p.y)) this.scroll(dy * 0.5);
    };
    scene.input.on('pointermove', move);
    scene.input.on('pointerup', release);
    scene.input.on('wheel', wheel);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input.off('pointermove', move);
      scene.input.off('pointerup', release);
      scene.input.off('wheel', wheel);
    });
  }

  get isOpen(): boolean { return this.open; }

  show(anchor: Rect, content: TooltipText, status: TooltipStatus): void {
    const p = T.padding;
    this.offset = 0;
    this.title.setText(content.title);
    this.body.setText(content.lines.join('\n'));
    const footer = 76;
    // Keep every summon row and the close button exposed, including lower-row details.
    const anchorTop = Math.min(anchor.y, BATTLE_LAYOUT.summonFlange.y);
    const available = anchorTop - T.gap - T.margin - p * 2 - this.title.height - 12 - footer;
    const bodyHeight = Math.min(this.body.height, 260, Math.max(80, available));
    this.maxScroll = Math.max(0, this.body.height - bodyHeight);
    const h = p * 2 + this.title.height + 12 + bodyHeight + footer;
    const pos = placeTooltip({ ...anchor, y: anchorTop, h: 0 }, { w: T.width, h }, { w: GAME_WIDTH, h: GAME_HEIGHT }, T.gap, T.margin);
    this.title.setPosition(pos.x + p, pos.y + p);
    this.bodyTop = this.title.y + this.title.height + 12;
    this.body.setPosition(pos.x + p, this.bodyTop);
    this.body.setCrop(0, 0, T.width - p * 2, bodyHeight);
    this.status.setPosition(pos.x + p, this.bodyTop + bodyHeight + 12);
    this.hint.setPosition(pos.x + p, pos.y + h - p - 14)
      .setText(this.maxScroll > 0 ? '↕ 드래그 / 휠로 자세히 보기' : '설명 모드: I 또는 설명 닫기');
    this.setStatus(status);
    this.box.clear()
      .fillStyle(0x080e19, 0.4).fillRoundedRect(pos.x, pos.y + 5, T.width, h, 12)
      .fillStyle(U.panel, 1).fillRoundedRect(pos.x, pos.y, T.width, h, 12)
      .lineStyle(1, U.gold, 0.8).strokeRoundedRect(pos.x, pos.y, T.width, h, 12)
      .lineStyle(1, U.edge, 0.4).lineBetween(pos.x + p, this.bodyTop - 6, pos.x + T.width - p, this.bodyTop - 6);
    this.hit.setPosition(pos.x + p, this.bodyTop).setSize(T.width - p * 2, bodyHeight);
    for (const o of [this.box, this.title, this.body, this.status, this.hint, this.hit]) o.setVisible(true);
    if (this.hit.input) this.hit.input.enabled = true;
    this.open = true;
  }

  setStatus(status: TooltipStatus): void {
    const message = (status.ok ? '✓ ' : '• ') + status.text;
    const color = status.ok ? U.goodText : U.dangerText;
    if (this.status.text !== message) this.status.setText(message);
    if (this.status.style.color !== color) this.status.setColor(color);
  }

  hide(): void {
    if (!this.open) return;
    this.open = false;
    this.dragging = false;
    for (const o of [this.box, this.title, this.body, this.status, this.hint, this.hit]) o.setVisible(false);
    if (this.hit.input) this.hit.input.enabled = false;
  }

  private scroll(delta: number): void {
    this.offset = Math.max(0, Math.min(this.maxScroll, this.offset + delta));
    this.body.setY(this.bodyTop - this.offset);
    this.body.setCrop(0, this.offset, T.width - T.padding * 2, this.hit.height);
  }
}
