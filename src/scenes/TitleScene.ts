import Phaser from 'phaser';
import { drawNightSky } from './background';
import { FULLSCREEN_LAYOUT, GAME_HEIGHT, GAME_WIDTH, HUD_FONT, TITLE_SETTINGS } from './layout';
import { FULLSCREEN_KEY, shouldAutoEnter, type FullscreenController } from '../fullscreen';
import { FullscreenButton } from './FullscreenButton';
import { KEY_MAP, KeyInput } from './input';
import { isBlockedByOverlay, openSettings } from './openSettings';
import { addTestBadge } from './testBadge';
import { addArtImage } from '../render/CharacterRenderer';
import { DEFAULT_UI as U } from '../ui/default/tokens';

const TITLE_ART = 'midnight-title-art-v1';

/** 한밤의 요괴 소동을 전면에 보여 주는 타이틀. 조작부는 실제 게임 UI로 그린다. */
export class TitleScene extends Phaser.Scene {
  private keyInput!: KeyInput;
  private launching = false;

  constructor() { super('Title'); }

  preload(): void {
    if (!this.textures.exists(TITLE_ART)) this.load.image(TITLE_ART, `${import.meta.env.BASE_URL}assets/title/midnight-charge-v1.png`);
  }

  create(): void {
    this.launching = false;
    if (this.textures.exists(TITLE_ART)) {
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, TITLE_ART).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    } else {
      drawNightSky(this);
      addArtImage(this, 'hero:kkomaMudang', 'preview', 716, 304, 440, 440);
      addArtImage(this, 'ally:clubGoblin', 'preview', 863, 387, 160, 160);
    }
    // 글자 쪽과 화면 가장자리만 살짝 어둡게 한다.
    const shade = this.add.graphics();
    shade.fillGradientStyle(0x06151b, 0x06151b, 0x06151b, 0x06151b, 0.18, 0, 0.3, 0).fillRect(0, 0, 530, GAME_HEIGHT);
    shade.fillGradientStyle(0x061117, 0x061117, 0x061117, 0x061117, 0, 0, 0.7, 0.55).fillRect(0, 468, GAME_WIDTH, 72);
    this.drawLogo();
    this.drawStartButton();
    this.drawSettings();
    new FullscreenButton(this, FULLSCREEN_LAYOUT.title, 'icon');
    this.drawMotes();
    addTestBadge(this);
    this.cameras.main.fadeIn(220, 5, 17, 23);
    this.keyInput = new KeyInput(window, code => this.onKeyDown(code));
    this.keyInput.attach();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.keyInput.detach());
  }

  private drawLogo(): void {
    this.add.text(67, 92, '오늘 밤, 요괴들이 깨어난다', {
      fontFamily: HUD_FONT, fontSize: '15px', fontStyle: 'bold', color: '#b1c8bd', letterSpacing: 1,
    });
    const logo = this.add.container(59, 133).setAngle(-4);
    const textStyle = { fontFamily: U.displayFont, stroke: '#09191e', strokeThickness: 10,
      padding: { x: 5, y: 5 } };
    const small = this.add.text(0, 0, '꼬마 무당', { ...textStyle, fontSize: '64px', color: '#fff1cb',
      shadow: { offsetX: 3, offsetY: 5, color: '#b6572e', blur: 0, fill: true, stroke: true } });
    const big = this.add.text(0, 67, '대소동!', { ...textStyle, fontSize: '96px', color: '#ffcb63',
      shadow: { offsetX: 4, offsetY: 6, color: '#9e3529', blur: 0, fill: true, stroke: true } });
    logo.add([small, big]);
    this.add.text(70, 324, '부적 날리고, 요괴 부르고. 한바탕 퇴마!', {
      fontFamily: HUD_FONT, fontSize: '16px', color: '#d0d4c0',
    });
    const seal = this.add.container(394, 215).setAngle(8);
    const stamp = this.add.graphics();
    stamp.lineStyle(2, 0xcf5b3e, 0.8).strokeRoundedRect(-15, -27, 30, 54, 3);
    const letters = this.add.text(0, 0, '퇴\n마', { fontFamily: HUD_FONT, fontSize: '17px',
      fontStyle: 'bold', color: '#d46c4d', align: 'center', lineSpacing: 2 }).setOrigin(0.5);
    seal.add([stamp, letters]);
  }

  private drawStartButton(): void {
    const x = 68, y = 390, w = 302, h = 72;
    const art = this.add.graphics();
    const label = this.add.text(x + w / 2 - 9, y + h / 2 - 1, '모험 시작', {
      fontFamily: U.displayFont, fontSize: '30px', color: '#fff1cc', stroke: '#6d2920', strokeThickness: 2,
      padding: { top: 4, bottom: 2 },
    }).setOrigin(0.5);
    const arrow = this.add.text(x + w - 31, y + h / 2 - 2, '›', {
      fontFamily: HUD_FONT, fontSize: '38px', color: '#ffd683',
    }).setOrigin(0.5);
    const draw = (hovered: boolean) => {
      const points = [[x + 9, y], [x + w - 16, y], [x + w, y + 13], [x + w - 7, y + h],
        [x + 7, y + h], [x, y + h - 12]].map(([px, py]) => new Phaser.Math.Vector2(px, py));
      art.clear().fillStyle(0x020e12, 0.7).fillRoundedRect(x + 2, y + 7, w, h, 5);
      art.fillStyle(hovered ? 0xc75132 : 0xad3d29).fillPoints(points, true);
      art.lineStyle(2, 0xf1bd68, hovered ? 1 : 0.85).strokePoints(points, true);
      art.lineStyle(1, 0xffd993, 0.28).lineBetween(x + 15, y + 6, x + w - 20, y + 6);
      art.lineStyle(1, 0x582b21, 0.7).lineBetween(x + 14, y + h - 7, x + w - 15, y + h - 7);
      art.fillStyle(0xffd48b, 0.9).fillCircle(x + 17, y + h / 2, 2);
      label.setColor(hovered ? '#ffffff' : '#fff1cc');
    };
    draw(false);
    const hit = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => draw(true));
    hit.on('pointerout', () => draw(false));
    // 터치에서 전체화면 요청이 제스처로 인정되도록 손을 뗄 때 시작한다
    hit.on('pointerup', (pointer: Phaser.Input.Pointer) => this.start(pointerTypeOf(pointer)));
    this.tweens.add({ targets: arrow, x: arrow.x + 4, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.add.text(x + w / 2, y + h + 15, 'ENTER / SPACE', {
      fontFamily: HUD_FONT, fontSize: '11px', color: '#8dada5', letterSpacing: 2,
    }).setOrigin(0.5);
  }

  private drawSettings(): void {
    const { x, y, w, h } = TITLE_SETTINGS;
    const g = this.add.graphics();
    const text = this.add.text(x + w / 2, y + h / 2, '설정', {
      fontFamily: HUD_FONT, fontSize: '16px', color: '#e8dfc6', fontStyle: 'bold',
    }).setOrigin(0.5);
    const draw = (hovered: boolean) => {
      g.clear().fillStyle(0x091c21, hovered ? 0.95 : 0.78).fillRoundedRect(x, y, w, h, 7);
      g.lineStyle(1, U.gold, hovered ? 0.8 : 0.3).strokeRoundedRect(x, y, w, h, 7);
      text.setColor(hovered ? '#ffe4aa' : '#e8dfc6');
    };
    draw(false);
    const hit = this.add.zone(x, y, w, h).setOrigin(0).setInteractive({ useHandCursor: true });
    hit.on('pointerover', () => draw(true));
    hit.on('pointerout', () => draw(false));
    hit.on('pointerdown', () => { if (!this.launching && !isBlockedByOverlay(this)) openSettings(this); });
  }

  private drawMotes(): void {
    for (let i = 0; i < 14; i++) {
      const x = 420 + i * 137 % 510, y = 80 + i * 71 % 380;
      const mote = this.add.circle(x, y, i % 3 ? 1 : 2, i % 3 ? 0xffcb7d : 0x8ce4b4, 0.35);
      this.tweens.add({ targets: mote, y: y - 24, x: x - 12, alpha: 0.05,
        duration: 2300 + i % 5 * 330, delay: i * 103, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
  }

  /** 터치로 시작 버튼을 눌렀을 때만 전체화면도 함께 시도한다 (실패해도 진행한다). 키보드는 pointerType이 없다 */
  private start(pointerType?: string): void {
    if (this.launching || isBlockedByOverlay(this)) return;
    this.launching = true;
    const fullscreen = this.registry.get(FULLSCREEN_KEY) as FullscreenController | undefined;
    if (shouldAutoEnter(pointerType) && fullscreen?.isSupported && !fullscreen.isActive) void fullscreen.enter();
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('Map'));
    this.cameras.main.fadeOut(180, 5, 17, 23);
  }

  private onKeyDown(code: string): void {
    if (this.launching || isBlockedByOverlay(this)) return;
    if ((KEY_MAP.confirm as readonly string[]).includes(code)) this.start();
    else if (code === KEY_MAP.openSettings) openSettings(this);
  }
}

/** Phaser 포인터의 종류. 브라우저 이벤트가 없으면 wasTouch로 touch만 판정한다 */
function pointerTypeOf(pointer: Phaser.Input.Pointer): string | undefined {
  const type = (pointer.event as PointerEvent | undefined)?.pointerType;
  return type || (pointer.wasTouch ? 'touch' : undefined);
}
