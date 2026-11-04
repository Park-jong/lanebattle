import Phaser from 'phaser';
import { drawNightSky } from './background';
import { GAME_HEIGHT, GAME_WIDTH, HUD_FONT } from './layout';
import { KEY_MAP, KeyInput } from './input';
import { MenuButton } from './MenuButton';
import { FIVE_COLORS } from './palette';
import { isBlockedByOverlay, openSettings } from './openSettings';
import { addTestBadge } from './testBadge';
import { addArtImage } from '../render/CharacterRenderer';

/** 등불 위치(x)와 줄 길이 */
const LANTERNS = [
  { x: 110, drop: 70 },
  { x: 250, drop: 76 },
  { x: 380, drop: 60 },
  { x: 580, drop: 60 },
  { x: 710, drop: 80 },
  { x: 850, drop: 75 },
] as const;

/** 타이틀: 제목, 시작·설정 버튼 */
export class TitleScene extends Phaser.Scene {
  private keyInput!: KeyInput;

  constructor() {
    super('Title');
  }

  create(): void {
    drawNightSky(this);
    this.drawLanterns();
    addTestBadge(this);
    this.drawTexts();
    addArtImage(this, 'hero:kkomaMudang', 'preview', 250, 364, 160, 160);
    addArtImage(this, 'ally:clubGoblin', 'preview', 710, 364, 150, 150);

    new MenuButton(this, GAME_WIDTH / 2, 322, 220, 66, '시작', () => this.start(), { fontSize: 24 });
    new MenuButton(this, GAME_WIDTH / 2, 398, 220, 66, `설정 (${KEY_MAP.openSettings.slice(3)})`, () => openSettings(this), { fontSize: 18 });

    this.keyInput = new KeyInput(window, (code) => this.onKeyDown(code));
    this.keyInput.attach();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.keyInput.detach());
  }

  private drawTexts(): void {
    const cx = GAME_WIDTH / 2;
    this.add
      .text(cx, 170, '꼬마 무당 대소동', {
        fontFamily: HUD_FONT, fontSize: '68px', fontStyle: 'bold', color: '#f3ead4',
        stroke: '#1b1d26', strokeThickness: 8,
      })
      .setOrigin(0.5);
    this.add
      .text(cx, 236, '도깨비들과 함께 한밤의 원귀를 막아라', {
        fontFamily: HUD_FONT, fontSize: '20px', color: '#e0b52e',
      })
      .setOrigin(0.5);
    this.add
      .text(cx, GAME_HEIGHT - 40, 'Enter / Space / 클릭으로 시작', {
        fontFamily: HUD_FONT, fontSize: '14px', color: '#9aa5c0',
      })
      .setOrigin(0.5);

    // 제목 아래 오방색 띠
    const g = this.add.graphics();
    const w = 44;
    const startX = cx - (FIVE_COLORS.length * w) / 2;
    FIVE_COLORS.forEach((c, i) => g.fillStyle(c, 1).fillRect(startX + i * w, 270, w - 4, 6));
  }

  /** 등불: 줄, 몸통, 깜박이는 불빛 (트윈은 씬이 끝나면 함께 정리된다) */
  private drawLanterns(): void {
    const g = this.add.graphics();
    LANTERNS.forEach((l, i) => {
      const color = FIVE_COLORS[i % 4];
      g.lineStyle(2, 0x8a7a5a, 1).lineBetween(l.x, 0, l.x, l.drop);
      g.fillStyle(color, 1).fillRoundedRect(l.x - 14, l.drop, 28, 38, 8);
      g.lineStyle(2, 0x1b1d26, 0.7).strokeRoundedRect(l.x - 14, l.drop, 28, 38, 8);
      g.fillStyle(0x1b1d26, 1).fillRect(l.x - 9, l.drop - 3, 18, 4).fillRect(l.x - 9, l.drop + 37, 18, 4);
      const glow = this.add.circle(l.x, l.drop + 19, 44, color, 0.2);
      this.tweens.add({
        targets: glow,
        alpha: { from: 0.4, to: 1 },
        duration: 1100 + i * 230,
        yoyo: true,
        repeat: -1,
      });
    });
  }

  private start(): void {
    this.scene.start('Map');
  }

  private onKeyDown(code: string): void {
    if (isBlockedByOverlay(this)) return;
    if ((KEY_MAP.confirm as readonly string[]).includes(code)) this.start();
    else if (code === KEY_MAP.openSettings) openSettings(this);
  }
}
