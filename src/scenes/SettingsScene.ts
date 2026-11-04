import Phaser from 'phaser';
import { settings } from '../game/settings';
import { GAME_HEIGHT, GAME_WIDTH, HUD_FONT } from './layout';
import { KEY_MAP, KeyInput } from './input';
import { MenuButton } from './MenuButton';
import { INK, PAPER } from './palette';
import { Slider } from './Slider';

const DEPTH = 1000;
const PANEL = { w: 600, h: 440 };

/** PC 조작표 (design.md 7번) */
const CONTROLS: readonly (readonly [string, string])[] = [
  ['이동', 'A / D 또는 ← / →'],
  ['유닛 소환', '1 ~ 0'],
  ['스킬 (부채 바람 / 축원 / 작두 타기)', 'Q / W / E'],
  ['기운 모으기', 'R'],
  ['일시정지', 'Esc 또는 P'],
  ['결과 화면 (다시 / 다음 / 지도)', 'R / N / M'],
];

/** 설정 오버레이: 소리 크기 슬라이더와 조작 안내. 부모 씬 위에 얹어 연다 */
export class SettingsScene extends Phaser.Scene {
  private parentKey = '';
  private keyInput!: KeyInput;

  constructor() {
    super('Settings');
  }

  init(data: { parent?: string }): void {
    this.parentKey = data.parent ?? '';
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    const left = cx - PANEL.w / 2;
    const top = (GAME_HEIGHT - PANEL.h) / 2;
    const font = { fontFamily: HUD_FONT, color: '#2b2622' };

    // 뒤 화면을 어둡게. 클릭이 아래로 새지 않게 입력도 받는다
    this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.65).setDepth(DEPTH).setInteractive();
    this.add.rectangle(cx, GAME_HEIGHT / 2, PANEL.w, PANEL.h, PAPER).setStrokeStyle(3, INK).setDepth(DEPTH + 1);
    this.add.text(cx, top + 22, '설정', { ...font, fontSize: '30px', fontStyle: 'bold' }).setOrigin(0.5, 0).setDepth(DEPTH + 2);

    const rows: [string, number, (v: number) => void][] = [
      ['배경음', settings.musicVolume, (v) => settings.setMusicVolume(v)],
      ['효과음', settings.sfxVolume, (v) => settings.setSfxVolume(v)],
    ];
    rows.forEach(([name, value, onChange], i) => {
      const y = top + 100 + i * 44;
      this.add.text(left + 40, y, name, { ...font, fontSize: '18px' }).setOrigin(0, 0.5).setDepth(DEPTH + 2);
      new Slider(this, left + 140, y, 300, value, onChange, DEPTH + 2);
    });

    this.add.text(left + 40, top + 176, '조작 안내', { ...font, fontSize: '16px', fontStyle: 'bold' }).setDepth(DEPTH + 2);
    const names = CONTROLS.map(([n]) => n).join('\n');
    const keys = CONTROLS.map(([, k]) => k).join('\n');
    this.add.text(left + 40, top + 204, names, { ...font, fontSize: '15px', lineSpacing: 8 }).setDepth(DEPTH + 2);
    this.add.text(left + 380, top + 204, keys, { ...font, fontSize: '15px', lineSpacing: 8, fontStyle: 'bold' }).setDepth(DEPTH + 2);

    new MenuButton(this, cx, top + PANEL.h - 36, 180, 66, '닫기 (Esc)', () => this.close()).setDepth(DEPTH + 2);

    this.keyInput = new KeyInput(window, (code) => {
      if (code === KEY_MAP.back) this.close();
    });
    this.keyInput.attach();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.keyInput.detach());
  }

  /**
   * 부모 씬을 다시 켜고 스스로 끝낸다.
   * 부모의 keydown 리스너가 먼저 등록돼 있어 같은 Esc 입력에서는 부모가 아직 멈춘 상태로 먼저 처리된다.
   */
  private close(): void {
    const manager = this.game.scene;
    if (this.parentKey) manager.resume(this.parentKey);
    manager.stop('Settings');
  }
}
