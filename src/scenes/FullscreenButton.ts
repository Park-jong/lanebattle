import Phaser from 'phaser';
import { FULLSCREEN_KEY, PressTracker, type FullscreenController } from '../fullscreen';
import { HUD_FONT, type Rect } from './layout';
import { DEFAULT_UI as U } from '../ui/default/tokens';

export type FullscreenButtonKind = 'icon' | 'label';

/** 씬이 레지스트리에서 같은 FullscreenController를 꺼낸다 (없으면 undefined) */
export function fullscreenOf(scene: Phaser.Scene): FullscreenController | undefined {
  return scene.registry.get(FULLSCREEN_KEY) as FullscreenController | undefined;
}

/**
 * 전체화면 토글 버튼. 미지원이면 만들지 않은 것처럼 숨긴다.
 * 브라우저가 사용자 제스처로 인정하도록 손을 뗄 때(pointerup) 요청한다.
 * icon: 구석의 작은 아이콘, label: 일시정지 패널 안의 글자 버튼.
 */
export class FullscreenButton {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly hit: Phaser.GameObjects.Zone;
  private readonly label?: Phaser.GameObjects.Text;
  private readonly fullscreen?: FullscreenController;
  private hovered = false;
  private shown = true;
  private readonly press = new PressTracker();

  constructor(
    scene: Phaser.Scene,
    private readonly rect: Rect,
    private readonly kind: FullscreenButtonKind,
    depth = 100,
  ) {
    this.fullscreen = fullscreenOf(scene);
    this.gfx = scene.add.graphics().setScrollFactor(0).setDepth(depth);
    if (kind === 'label') {
      this.label = scene.add.text(rect.x + rect.w / 2, rect.y + rect.h / 2, '', {
        fontFamily: HUD_FONT, fontSize: '18px', fontStyle: 'bold', color: U.text, align: 'center',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 1);
    }
    this.hit = scene.add.zone(rect.x, rect.y, rect.w, rect.h)
      .setOrigin(0).setScrollFactor(0).setDepth(depth + 2).setInteractive({ useHandCursor: true });
    this.hit.on('pointerover', () => { this.hovered = true; this.redraw(); });
    this.hit.on('pointerout', () => { this.hovered = false; this.press.cancel(); this.redraw(); });
    // 이 버튼 위에서 누른 포인터가 같은 버튼 위에서 떨어질 때만 토글한다
    // (다른 버튼의 pointerdown으로 열린 화면에서 떨어진 손가락은 무시)
    this.hit.on('pointerdown', (pointer: Phaser.Input.Pointer) => { if (this.shown) this.press.down(pointer.id); });
    // pointerdown은 브라우저가 제스처로 인정하지 않을 수 있어 손을 뗄 때 요청한다
    this.hit.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.press.consumeUp(pointer.id) && this.shown) void this.fullscreen?.toggle();
    });

    const off = this.fullscreen?.subscribe(() => this.redraw());
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => off?.());
    this.redraw();
  }

  /** 호출하는 쪽의 표시 조건(예: 일시정지 중)을 반영한다. 미지원이면 항상 숨김 */
  setVisible(visible: boolean): void {
    this.shown = visible && !!this.fullscreen?.isSupported;
    this.redraw();
  }

  private redraw(): void {
    const show = this.shown && !!this.fullscreen?.isSupported;
    this.gfx.setVisible(show);
    this.label?.setVisible(show);
    if (this.hit.input) this.hit.input.enabled = show;
    if (!show) this.press.cancel();
    if (!show) return;
    const active = !!this.fullscreen?.isActive;
    const { x, y, w, h } = this.rect;
    const g = this.gfx.clear();
    if (this.kind === 'icon') {
      g.fillStyle(0x091c21, this.hovered ? 0.95 : 0.78).fillRoundedRect(x, y, w, h, 7);
      g.lineStyle(1, U.gold, this.hovered ? 0.8 : 0.3).strokeRoundedRect(x, y, w, h, 7);
      this.drawIcon(g, x + w / 2, y + h / 2, active, this.hovered ? 0xffe4aa : 0xe8dfc6);
    } else {
      g.fillStyle(0x050b15, 0.6).fillRoundedRect(x, y + 3, w, h, 9);
      g.fillStyle(0x3a5a6b, 1).fillRoundedRect(x, y, w, h, 9);
      g.lineStyle(this.hovered ? 2 : 1, this.hovered ? U.gold : U.edge, 0.9).strokeRoundedRect(x, y, w, h, 9);
      this.label?.setText(active ? '전체화면 끄기' : '전체화면');
    }
  }

  /** 네 모서리 꺾쇠. 전체화면이면 안쪽을, 아니면 바깥쪽을 향한다 */
  private drawIcon(g: Phaser.GameObjects.Graphics, cx: number, cy: number, active: boolean, color: number): void {
    const r = 13, a = 7, dir = active ? -1 : 1;
    g.lineStyle(3, color, 1);
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const px = cx + sx * (active ? r - 4 : r), py = cy + sy * (active ? r - 4 : r);
      // 꺾쇠의 두 변: 바깥 모서리를 향해(dir=1) 또는 안쪽으로(dir=-1) 뻗는다
      g.beginPath();
      g.moveTo(px - sx * a * dir, py);
      g.lineTo(px, py);
      g.lineTo(px, py - sy * a * dir);
      g.strokePath();
    }
  }
}
